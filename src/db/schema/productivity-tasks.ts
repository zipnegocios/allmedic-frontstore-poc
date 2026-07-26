import { pgTable, text, integer, decimal, boolean, timestamp, jsonb, pgEnum, uuid as pgUuid, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuid } from "@/lib/uuid";
import { users } from "./auth";
import { catalogEntityTypeEnum } from "./rbac";
import { productivityRateTiers } from "./productivity-rate-tiers";

export { productivityRateTiers, productivityRateComponentEnum, productivityRates, productivityRatesRelations } from "./productivity-rate-tiers";

// ─── Catalog Tasks (asignación de trabajo Admin → Gestor del Catálogo) ───
// SET_PRODUCT_SLOT (2026-07-26): subtarea transitoria generada automáticamente al crear una
// tarea CREATE_SET (una por línea de Bloque A/B) — ver `parentTaskId` abajo. No es un encargo
// de producto real, es un medio para trabajar el armado del set pieza por pieza.
export const catalogTaskTypeEnum = pgEnum("catalog_task_type", [
  "CREATE_PRODUCT", "CREATE_SET", "UPLOAD_MEDIA", "EDIT_PRODUCT", "EDIT_SET", "GENERIC", "SET_PRODUCT_SLOT",
]);
export const catalogTaskStatusEnum = pgEnum("catalog_task_status", [
  "PENDING", "IN_PROGRESS", "COMPLETED", "APPROVED", "REJECTED",
]);
// Entidad objetivo de una tarea tipada — subconjunto de catalogEntityTypeEnum (sin MEDIA:
// las tareas de medios no apuntan a una entidad ya existente, ver decisión 4 del plan).
export const catalogTaskTargetEntityEnum = pgEnum("catalog_task_target_entity", ["PRODUCT", "SET"]);

// ─── Grupos de tareas (2026-07-26, redefinido tras feedback del usuario) ───
// Un grupo agrupa varias tareas (ej. "Cargar Colección XYZ - Fase 1") con un plazo de
// cumplimiento opcional (`dueDate`, fecha límite exacta — NO frecuencia de pago) y, también
// de forma opcional, un pago fijo (`hasPayment` + `paymentAmount`) que se acredita una sola
// vez cuando TODAS sus tareas llegan a APPROVED (ver `completedAt` abajo y el trigger en
// task-service.ts). Un grupo sin `hasPayment` es puramente organizativo — nunca genera fila
// en `payment_period_task_group_items` (ver el filtro en productivity-rates/index.ts). Los
// grupos son siempre editables, incluso después de `completedAt` (sin excepción de
// inmutabilidad, a diferencia de un `payment_period` en estado PAID).
export const catalogTaskGroups = pgTable("catalog_task_groups", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  name: text("name").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }),
  hasPayment: boolean("has_payment").notNull().default(false),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }),
  createdBy: pgUuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  // Se setea cuando la última tarea del grupo pasa a APPROVED (task-service.ts) — dispara la
  // elegibilidad del grupo para el cálculo de pago fijo (solo si hasPayment = true).
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const catalogTaskGroupsRelations = relations(catalogTaskGroups, ({ one, many }) => ({
  creator: one(users, { fields: [catalogTaskGroups.createdBy], references: [users.id] }),
  tasks: many(catalogTasks),
}));

export const catalogTasks = pgTable("catalog_tasks", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  type: catalogTaskTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  // Estilo aún no creado (tarea tipada "crear") — no es FK porque el producto no existe todavía.
  targetCode: text("target_code"),
  // Entidad ya existente (tarea tipada "editar") — sin FK real: es polimórfica (PRODUCT|SET
  // viven en tablas distintas), igual patrón que catalogActivityLog.entityId.
  targetEntityType: catalogTaskTargetEntityEnum("target_entity_type"),
  targetEntityId: text("target_entity_id"),
  // Campos específicos por tipo (2026-07-26), todos nullable — no todos los tipos los usan.
  // `gender` reutiliza los mismos valores de texto libre que `products.gender` (sin enum
  // nuevo, para no duplicar la validación de "Hombre/Mujer/Unisex" en dos lugares).
  gender: text("gender"),
  // URL fuente de referencia para CREATE_PRODUCT.
  sourceUrl: text("source_url"),
  // Los dos "bloques" de CREATE_SET — cada uno relaciona 2 productos (2 pares código+URL),
  // ya que normalmente el Bloque A y el Bloque B agrupan 2 piezas cada uno. jsonb en vez de
  // columnas planas porque solo aplican a un tipo de tarea, mismo patrón que
  // quoteItems.pricingBreakdown (ver corporate.ts).
  blockA: jsonb("block_a").$type<Array<{ code: string; url: string }>>(),
  blockB: jsonb("block_b").$type<Array<{ code: string; url: string }>>(),
  groupId: pgUuid("group_id").references(() => catalogTaskGroups.id, { onDelete: "set null" }),
  // Tarea CREATE_SET que generó esta subtarea SET_PRODUCT_SLOT (2026-07-26) — separado de
  // `groupId` (que es el agrupador de pago/plazo, no de subtareas). Sin FK real: es una
  // auto-referencia dentro de la misma tabla, mismo criterio ya usado en `targetEntityId`
  // para no complicar el tipado circular de Drizzle — se resuelve a nivel de aplicación
  // (borrar la tarea padre no borra las subtareas en cascada automáticamente; el servicio
  // debe limpiarlas explícitamente si llega a implementarse borrado de tareas).
  parentTaskId: pgUuid("parent_task_id"),
  assignedTo: pgUuid("assigned_to").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedBy: pgUuid("assigned_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: catalogTaskStatusEnum("status").notNull().default("PENDING"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
}, (table) => [
  index("idx_catalog_tasks_assigned_to").on(table.assignedTo),
  index("idx_catalog_tasks_status").on(table.status),
  index("idx_catalog_tasks_group").on(table.groupId),
  index("idx_catalog_tasks_parent").on(table.parentTaskId),
]);

export const catalogTasksRelations = relations(catalogTasks, ({ one, many }) => ({
  assignee: one(users, { fields: [catalogTasks.assignedTo], references: [users.id], relationName: "taskAssignee" }),
  assigner: one(users, { fields: [catalogTasks.assignedBy], references: [users.id], relationName: "taskAssigner" }),
  group: one(catalogTaskGroups, { fields: [catalogTasks.groupId], references: [catalogTaskGroups.id] }),
  comments: many(catalogTaskComments),
}));

// ─── Comentarios: dos hilos independientes (decisión 2 del plan) ───
export const catalogTaskComments = pgTable("catalog_task_comments", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  taskId: pgUuid("task_id").notNull().references(() => catalogTasks.id, { onDelete: "cascade" }),
  authorId: pgUuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_catalog_task_comments_task").on(table.taskId),
]);

export const catalogTaskCommentsRelations = relations(catalogTaskComments, ({ one }) => ({
  task: one(catalogTasks, { fields: [catalogTaskComments.taskId], references: [catalogTasks.id] }),
  author: one(users, { fields: [catalogTaskComments.authorId], references: [users.id] }),
}));

// entityType aquí reutiliza catalogEntityTypeEnum completo (incluye MEDIA/VARIANT) aunque
// el plan solo contempla PRODUCT|SET en la práctica — se deja abierto sin nueva restricción
// de enum para no duplicar un tercer enum casi idéntico.
export const catalogEntityComments = pgTable("catalog_entity_comments", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  entityType: catalogEntityTypeEnum("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  authorId: pgUuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_catalog_entity_comments_entity").on(table.entityType, table.entityId),
]);

export const catalogEntityCommentsRelations = relations(catalogEntityComments, ({ one }) => ({
  author: one(users, { fields: [catalogEntityComments.authorId], references: [users.id] }),
}));

// ─── Notificaciones (badges + disparo de correo para eventos críticos) ───
export const catalogNotificationTypeEnum = pgEnum("catalog_notification_type", [
  "TASK_ASSIGNED", "TASK_REJECTED", "TASK_STATUS_CHANGED", "TASK_COMMENT", "ENTITY_COMMENT",
]);

export const catalogNotifications = pgTable("catalog_notifications", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  userId: pgUuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: catalogNotificationTypeEnum("type").notNull(),
  relatedTaskId: pgUuid("related_task_id").references(() => catalogTasks.id, { onDelete: "cascade" }),
  relatedCommentId: pgUuid("related_comment_id"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_catalog_notifications_user_unread").on(table.userId, table.readAt),
]);

export const catalogNotificationsRelations = relations(catalogNotifications, ({ one }) => ({
  user: one(users, { fields: [catalogNotifications.userId], references: [users.id] }),
  relatedTask: one(catalogTasks, { fields: [catalogNotifications.relatedTaskId], references: [catalogTasks.id] }),
}));

// ─── Relación tiers ↔ users (declarada aquí, no en productivity-rate-tiers.ts, porque
// ese archivo no puede importar `auth.ts` sin crear un ciclo con `users.tier_id`) ───
export const productivityRateTiersUsersRelations = relations(productivityRateTiers, ({ many }) => ({
  users: many(users),
}));

// ─── Períodos de pago ───
export const paymentPeriodStatusEnum = pgEnum("payment_period_status", ["OPEN", "CLOSED", "PAID"]);

export const paymentPeriods = pgTable("payment_periods", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  status: paymentPeriodStatusEnum("status").notNull().default("OPEN"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const paymentPeriodsRelations = relations(paymentPeriods, ({ many }) => ({
  items: many(paymentPeriodItems),
}));

export const paymentPeriodItems = pgTable("payment_period_items", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  periodId: pgUuid("period_id").notNull().references(() => paymentPeriods.id, { onDelete: "cascade" }),
  userId: pgUuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  computedAmount: decimal("computed_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  manualAdjustment: decimal("manual_adjustment", { precision: 10, scale: 2 }).notNull().default("0"),
  adjustmentReason: text("adjustment_reason"),
  finalAmount: decimal("final_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  voidedItemsCount: integer("voided_items_count").notNull().default(0),
  computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_payment_period_items_period").on(table.periodId),
  index("idx_payment_period_items_user").on(table.userId),
]);

export const paymentPeriodItemsRelations = relations(paymentPeriodItems, ({ one }) => ({
  period: one(paymentPeriods, { fields: [paymentPeriodItems.periodId], references: [paymentPeriods.id] }),
  user: one(users, { fields: [paymentPeriodItems.userId], references: [users.id] }),
}));

// ─── Tabulador fijo por grupo de tareas (2026-07-26) ───
// Paralela a payment_period_items (que cubre el modo "por componente"), pero para el modo
// fijo: una fila por grupo completado dentro del rango de un período, acreditada al único
// Gestor del grupo (invariante: todas las tareas de un grupo comparten `assignedTo`). `amount`
// es un snapshot de `catalogTaskGroups.paymentAmount` al momento del cálculo — no una
// referencia viva, para que un cambio posterior al monto del grupo (antes de completarse) no
// altere pagos ya calculados de otros grupos.
export const paymentPeriodTaskGroupItems = pgTable("payment_period_task_group_items", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  periodId: pgUuid("period_id").notNull().references(() => paymentPeriods.id, { onDelete: "cascade" }),
  groupId: pgUuid("group_id").notNull().references(() => catalogTaskGroups.id, { onDelete: "cascade" }),
  userId: pgUuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_payment_period_task_group_items_period").on(table.periodId),
  index("idx_payment_period_task_group_items_user").on(table.userId),
  // Un grupo solo puede generar UN pago fijo por período — evita doble cómputo si
  // recalculatePeriod se ejecuta más de una vez sobre el mismo rango.
  unique("uq_payment_period_task_group_items_period_group").on(table.periodId, table.groupId),
]);

export const paymentPeriodTaskGroupItemsRelations = relations(paymentPeriodTaskGroupItems, ({ one }) => ({
  period: one(paymentPeriods, { fields: [paymentPeriodTaskGroupItems.periodId], references: [paymentPeriods.id] }),
  group: one(catalogTaskGroups, { fields: [paymentPeriodTaskGroupItems.groupId], references: [catalogTaskGroups.id] }),
  user: one(users, { fields: [paymentPeriodTaskGroupItems.userId], references: [users.id] }),
}));

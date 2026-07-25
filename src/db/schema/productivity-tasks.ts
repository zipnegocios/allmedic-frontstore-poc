import { pgTable, text, integer, decimal, timestamp, pgEnum, uuid as pgUuid, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuid } from "@/lib/uuid";
import { users } from "./auth";
import { catalogEntityTypeEnum } from "./rbac";
import { productivityRateTiers } from "./productivity-rate-tiers";

export { productivityRateTiers, productivityRateComponentEnum, productivityRates, productivityRatesRelations } from "./productivity-rate-tiers";

// ─── Catalog Tasks (asignación de trabajo Admin → Gestor del Catálogo) ───
export const catalogTaskTypeEnum = pgEnum("catalog_task_type", [
  "CREATE_PRODUCT", "CREATE_SET", "UPLOAD_MEDIA", "EDIT_PRODUCT", "EDIT_SET", "GENERIC",
]);
export const catalogTaskStatusEnum = pgEnum("catalog_task_status", [
  "PENDING", "IN_PROGRESS", "COMPLETED", "APPROVED", "REJECTED",
]);
// Entidad objetivo de una tarea tipada — subconjunto de catalogEntityTypeEnum (sin MEDIA:
// las tareas de medios no apuntan a una entidad ya existente, ver decisión 4 del plan).
export const catalogTaskTargetEntityEnum = pgEnum("catalog_task_target_entity", ["PRODUCT", "SET"]);

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
]);

export const catalogTasksRelations = relations(catalogTasks, ({ one, many }) => ({
  assignee: one(users, { fields: [catalogTasks.assignedTo], references: [users.id], relationName: "taskAssignee" }),
  assigner: one(users, { fields: [catalogTasks.assignedBy], references: [users.id], relationName: "taskAssigner" }),
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

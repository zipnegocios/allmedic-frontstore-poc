import { pgTable, text, integer, timestamp, pgEnum, uuid as pgUuid, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuid } from "@/lib/uuid";
import { users, userRoleEnum } from "./auth";

// ─── Productivity Targets (meta diaria por usuario, solo Gestores del Catálogo) ───
export const productivityTargets = pgTable("productivity_targets", {
  userId: pgUuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  dailyTarget: integer("daily_target").notNull().default(25),
});

export const productivityTargetsRelations = relations(productivityTargets, ({ one }) => ({
  user: one(users, { fields: [productivityTargets.userId], references: [users.id] }),
}));

// ─── Permissions (catálogo maestro módulo:acción) ───
export const permissions = pgTable("permissions", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  module: text("module").notNull(),
  action: text("action").notNull(),
}, (table) => [
  unique("uq_permissions_module_action").on(table.module, table.action),
]);

// ─── Role Permissions (asignación rol → permiso; presencia = concedido) ───
export const rolePermissions = pgTable("role_permissions", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  role: userRoleEnum("role").notNull(),
  permissionId: pgUuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
}, (table) => [
  unique("uq_role_permissions_role_permission").on(table.role, table.permissionId),
]);

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  permission: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}));

// ─── Permissions Version (singleton — invalida la caché de middleware sin relogin) ───
export const permissionsVersion = pgTable("permissions_version", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  version: integer("version").notNull().default(1),
});

// ─── Catalog Activity Log (tracking de productividad del Gestor del Catálogo) ───
export const catalogEntityTypeEnum = pgEnum("catalog_entity_type", ["PRODUCT", "VARIANT", "SET", "MEDIA"]);
export const catalogActivityActionEnum = pgEnum("catalog_activity_action", ["CREATE", "UPDATE"]);

export const catalogActivityLog = pgTable("catalog_activity_log", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  userId: pgUuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entityType: catalogEntityTypeEnum("entity_type").notNull(),
  entityId: text("entity_id"),
  action: catalogActivityActionEnum("action").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const catalogActivityLogRelations = relations(catalogActivityLog, ({ one }) => ({
  user: one(users, { fields: [catalogActivityLog.userId], references: [users.id] }),
}));

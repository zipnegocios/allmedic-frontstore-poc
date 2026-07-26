import { pgTable, text, timestamp, primaryKey, integer, boolean, pgEnum, uuid as pgUuid } from "drizzle-orm/pg-core";
import { uuid } from "@/lib/uuid";
import { productivityRateTiers } from "./productivity-rate-tiers";

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "SALES", "CATALOG_MANAGER", "DISPATCHER", "CORPORATE_CLIENT"]);
export const scopeLevelEnum = pgEnum("scope_level", ["OWN", "ALL"]);

export const users = pgTable("users", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  password: text("password"),
  role: userRoleEnum("role").notNull().default("CATALOG_MANAGER"),
  scopeLevel: scopeLevelEnum("scope_level").notNull().default("OWN"),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  isProtected: boolean("is_protected").notNull().default(false),
  sessionVersion: integer("session_version").notNull().default(0),
  tierId: pgUuid("tier_id").references(() => productivityRateTiers.id),
  requiresAssignedTaskForPayment: boolean("requires_assigned_task_for_payment").notNull().default(false),
  // Habilita el permiso `tareas:write` para un CATALOG_MANAGER sin necesitar un rol RBAC
  // nuevo — puede crear/asignar tareas y grupos a otros Gestores, mismas capacidades que
  // Admin dentro del módulo de tareas (2026-07-26).
  isTaskCoordinator: boolean("is_task_coordinator").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const accounts = pgTable("accounts", {
  userId: pgUuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (account) => [
  primaryKey({ columns: [account.provider, account.providerAccountId] }),
]);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").notNull().primaryKey(),
  userId: pgUuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
}, (vt) => [
  primaryKey({ columns: [vt.identifier, vt.token] }),
]);

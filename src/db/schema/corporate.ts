import { pgTable, text, integer, boolean, decimal, timestamp, jsonb, index, uuid as pgUuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuid } from "@/lib/uuid";
import { products, brands } from "./products";
import { users } from "./auth";

// ─── Set Groups (Grupos de Sets - categorías para sets corporativos) ───
export const setGroups = pgTable("set_groups", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const setGroupsRelations = relations(setGroups, ({ many }) => ({
  sets: many(corporateSets),
}));

// ─── Corporate Sets (Conjuntos corporativos — grupos de piezas con precio referencial) ───
export const corporateSets = pgTable("corporate_sets", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  setGroupId: pgUuid("set_group_id").references(() => setGroups.id),
  brandId: pgUuid("brand_id").references(() => brands.id),
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_corporate_sets_active").on(table.isActive),
  index("idx_corporate_sets_featured").on(table.isFeatured),
  index("idx_corporate_sets_group").on(table.setGroupId),
]);

export const corporateSetsRelations = relations(corporateSets, ({ one, many }) => ({
  group: one(setGroups, { fields: [corporateSets.setGroupId], references: [setGroups.id] }),
  brand: one(brands, { fields: [corporateSets.brandId], references: [brands.id] }),
  items: many(setItems),
}));

// ─── Set Items (Piezas dentro de cada set — relación many-to-many con cantidad) ───
export const setItems = pgTable("set_items", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  setId: pgUuid("set_id").notNull().references(() => corporateSets.id, { onDelete: "cascade" }),
  productId: pgUuid("product_id").notNull().references(() => products.id),
  quantityPerSet: integer("quantity_per_set").default(1),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("idx_set_items_set").on(table.setId),
  index("idx_set_items_product").on(table.productId),
]);

export const setItemsRelations = relations(setItems, ({ one }) => ({
  set: one(corporateSets, { fields: [setItems.setId], references: [corporateSets.id] }),
  product: one(products, { fields: [setItems.productId], references: [products.id] }),
}));

// ─── Business Rules (Motor de reglas — validación, precios, restricciones) ───
// NOTA: scopeId es text() porque referencia distintas tablas según el `scope`
// (BRAND, SET_GROUP, SET, PRODUCT) — no puede ser una FK tipada única.
export const businessRules = pgTable("business_rules", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  name: text("name").notNull(),
  ruleType: text("rule_type").notNull(),
  // Scope: GLOBAL, BRAND, SET_GROUP, SET, PRODUCT
  scope: text("scope").notNull(),
  scopeId: text("scope_id"), // null si GLOBAL; guarda el uuid como texto
  // JSON config depende del ruleType
  config: jsonb("config").notNull(),
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validTo: timestamp("valid_to", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_rules_type_scope").on(table.ruleType, table.scope),
  index("idx_rules_active").on(table.isActive),
]);

// ─── Corporate Accounts (Cuentas de clientes corporativos) ───
export const corporateAccounts = pgTable("corporate_accounts", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  userId: pgUuid("user_id").references(() => users.id),
  ruc: text("ruc").notNull(),
  razonSocial: text("razon_social").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  sector: text("sector"),
  // Status: PENDING, APPROVED, REJECTED, SUSPENDED
  status: text("status").notNull().default("PENDING"),
  approvedBy: pgUuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_corporate_accounts_status").on(table.status),
  index("idx_corporate_accounts_email").on(table.email),
]);

export const corporateAccountsRelations = relations(corporateAccounts, ({ one, many }) => ({
  user: one(users, { fields: [corporateAccounts.userId], references: [users.id] }),
  approver: one(users, { fields: [corporateAccounts.approvedBy], references: [users.id] }),
  carts: many(corporateCarts),
  quotes: many(quoteRequests),
}));

// ─── Corporate Carts (Carritos persistidos en BD para clientes corporativos logueados) ───
export const corporateCarts = pgTable("corporate_carts", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  accountId: pgUuid("account_id").notNull().unique().references(() => corporateAccounts.id, { onDelete: "cascade" }),
  // items: [{ setId, sizeMode, lines: [{ size?, pieceSelections?, quantity }] }]
  items: jsonb("items").notNull().default("[]"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const corporateCartsRelations = relations(corporateCarts, ({ one }) => ({
  account: one(corporateAccounts, { fields: [corporateCarts.accountId], references: [corporateAccounts.id] }),
}));

// ─── Quote Requests (Solicitudes de cotización) ───
export const quoteRequests = pgTable("quote_requests", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  code: text("code").notNull().unique(), // ej. COT-2026-0001
  accountId: pgUuid("account_id").references(() => corporateAccounts.id),
  // Snapshot de datos del cliente al momento de envío
  customerData: jsonb("customer_data").notNull(),
  // Snapshot de items (sets, tallas, cantidades, precios REFERENCIALES)
  items: jsonb("items").notNull(),
  // Precio referencial calculado en servidor
  referenceSubtotal: decimal("reference_subtotal", { precision: 10, scale: 2 }).notNull(),
  // Precios REALES escritos por el equipo de ventas (Fase 4)
  quotedItems: jsonb("quoted_items"),
  quotedTotal: decimal("quoted_total", { precision: 10, scale: 2 }),
  // Status: RECEIVED, IN_REVIEW, QUOTED, SENT, APPROVED, REJECTED, CLOSED
  status: text("status").notNull().default("RECEIVED"),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_quote_requests_code").on(table.code),
  index("idx_quote_requests_status").on(table.status),
  index("idx_quote_requests_account").on(table.accountId),
]);

export const quoteRequestsRelations = relations(quoteRequests, ({ one, many }) => ({
  account: one(corporateAccounts, { fields: [quoteRequests.accountId], references: [corporateAccounts.id] }),
  history: many(quoteStatusHistory),
  attachments: many(quoteAttachments),
}));

// ─── Quote Status History (Historial de cambios de estado de solicitudes) ───
export const quoteStatusHistory = pgTable("quote_status_history", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  quoteId: pgUuid("quote_id").notNull().references(() => quoteRequests.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: pgUuid("changed_by").references(() => users.id),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const quoteStatusHistoryRelations = relations(quoteStatusHistory, ({ one }) => ({
  quote: one(quoteRequests, { fields: [quoteStatusHistory.quoteId], references: [quoteRequests.id] }),
  user: one(users, { fields: [quoteStatusHistory.changedBy], references: [users.id] }),
}));

// ─── Quote Attachments (Documentos PDF adjuntos: cotización, factura, etc.) ───
export const quoteAttachments = pgTable("quote_attachments", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  quoteId: pgUuid("quote_id").notNull().references(() => quoteRequests.id, { onDelete: "cascade" }),
  // Type: COTIZACION, FACTURA, NOTA_ENTREGA, OTRO
  type: text("type").notNull(),
  fileName: text("file_name"),
  fileUrl: text("file_url").notNull(),
  uploadedBy: pgUuid("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const quoteAttachmentsRelations = relations(quoteAttachments, ({ one }) => ({
  quote: one(quoteRequests, { fields: [quoteAttachments.quoteId], references: [quoteRequests.id] }),
  uploader: one(users, { fields: [quoteAttachments.uploadedBy], references: [users.id] }),
}));

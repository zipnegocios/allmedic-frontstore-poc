import { pgTable, text, integer, boolean, decimal, timestamp, jsonb, index, uuid as pgUuid, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuid } from "@/lib/uuid";
import { products, brands, productVariants } from "./products";
import { users } from "./auth";
import { leads } from "./commerce";

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
  // Precio manual del set (override) — null significa "automático": suma de precios al
  // mayor de las piezas × cantidad, tal como se calculaba antes de este campo.
  priceManual: decimal("price_manual", { precision: 10, scale: 2 }),
  priceManualSale: decimal("price_manual_sale", { precision: 10, scale: 2 }),
  manualDiscountEnd: timestamp("manual_discount_end", { withTimezone: true }),
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_corporate_sets_active").on(table.isActive),
  index("idx_corporate_sets_featured").on(table.isFeatured),
  index("idx_corporate_sets_group").on(table.setGroupId),
  index("idx_corporate_sets_deleted").on(table.deletedAt),
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
  quotes: many(quotes),
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

// ─── Tax Presets (Presets de impuestos administrables) ───
export const taxPresets = pgTable("tax_presets", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  name: text("name").notNull(), // "IVA 15%", "IVA 0%", "Exento"
  rate: decimal("rate", { precision: 5, scale: 2 }).notNull(),
  pricesIncludeTaxDefault: boolean("prices_include_tax_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  unique("uq_tax_presets_name").on(table.name),
]);

// ─── Validity Presets (Presets de vigencia administrables) ───
export const validityPresets = pgTable("validity_presets", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  name: text("name").notNull(), // "7 días", "15 días", "30 días"
  days: integer("days").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  unique("uq_validity_presets_name").on(table.name),
]);

// ─── Quotes (Cotizaciones — corporativas e individuales) ───
export const quotes = pgTable("quotes", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  // Asignado solo al pasar a FINAL, formato COT-YYYY-NNNNN
  quoteNumber: text("quote_number").unique(),
  // Status: DRAFT | FINAL
  status: text("status").notNull().default("DRAFT"),
  // Outcome: ACCEPTED | REJECTED | null
  outcome: text("outcome"),
  // Channel: CORPORATE | RETAIL
  channel: text("channel").notNull(),
  accountId: pgUuid("account_id").references(() => corporateAccounts.id),
  leadId: pgUuid("lead_id").references(() => leads.id),
  // Snapshot del cliente — editable independientemente de la ficha origen
  customerName: text("customer_name").notNull(),
  customerIdNumber: text("customer_id_number"),
  customerContactName: text("customer_contact_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  customerAddress: text("customer_address"),
  customerCity: text("customer_city"),
  // Impuesto
  taxPresetId: pgUuid("tax_preset_id").references(() => taxPresets.id),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  pricesIncludeTax: boolean("prices_include_tax").notNull().default(false),
  // Descuento global: PERCENTAGE | FIXED
  discountType: text("discount_type"),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull().default("0"),
  // Vigencia
  validityPresetId: pgUuid("validity_preset_id").references(() => validityPresets.id),
  validityDays: integer("validity_days"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  // Totales cacheados (recalculados en cada guardado)
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  totalDiscount: decimal("total_discount", { precision: 10, scale: 2 }).notNull().default("0"),
  totalTax: decimal("total_tax", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  pdfKey: text("pdf_key"),
  pdfGeneratedAt: timestamp("pdf_generated_at", { withTimezone: true }),
  sentByEmailAt: timestamp("sent_by_email_at", { withTimezone: true }),
  publishedToPortalAt: timestamp("published_to_portal_at", { withTimezone: true }),
  createdBy: pgUuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_quotes_status").on(table.status),
  index("idx_quotes_channel").on(table.channel),
  index("idx_quotes_account").on(table.accountId),
  index("idx_quotes_lead").on(table.leadId),
  index("idx_quotes_expires").on(table.expiresAt),
]);

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  account: one(corporateAccounts, { fields: [quotes.accountId], references: [corporateAccounts.id] }),
  lead: one(leads, { fields: [quotes.leadId], references: [leads.id] }),
  taxPreset: one(taxPresets, { fields: [quotes.taxPresetId], references: [taxPresets.id] }),
  validityPreset: one(validityPresets, { fields: [quotes.validityPresetId], references: [validityPresets.id] }),
  creator: one(users, { fields: [quotes.createdBy], references: [users.id] }),
  items: many(quoteItems),
  documents: many(quoteDocuments),
}));

// ─── Quote Items (Líneas de cotización — catálogo o libres) ───
export const quoteItems = pgTable("quote_items", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  quoteId: pgUuid("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  // Kind: CATALOG | FREE
  kind: text("kind").notNull(),
  productId: pgUuid("product_id").references(() => products.id),
  variantId: pgUuid("variant_id").references(() => productVariants.id),
  setId: pgUuid("set_id").references(() => corporateSets.id, { onDelete: "set null" }),
  size: text("size"),
  color: text("color"),
  // Obligatoria en FREE; autogenerada (editable) en CATALOG
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  suggestedUnitPrice: decimal("suggested_unit_price", { precision: 10, scale: 2 }),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull().default("0"),
  // Descuento de línea: PERCENTAGE | FIXED
  discountType: text("discount_type"),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull().default("0"),
  taxRateOverride: decimal("tax_rate_override", { precision: 5, scale: 2 }),
  // Desglose del motor de reglas para esta línea (auditoría)
  pricingBreakdown: jsonb("pricing_breakdown"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_quote_items_quote").on(table.quoteId),
  index("idx_quote_items_product").on(table.productId),
  index("idx_quote_items_set").on(table.setId),
]);

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, { fields: [quoteItems.quoteId], references: [quotes.id] }),
  product: one(products, { fields: [quoteItems.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [quoteItems.variantId], references: [productVariants.id] }),
  set: one(corporateSets, { fields: [quoteItems.setId], references: [corporateSets.id] }),
}));

// ─── Quote Documents (Documentos adjuntos manuales: cotización, factura, nota de entrega, etc.) ───
export const quoteDocuments = pgTable("quote_documents", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  quoteId: pgUuid("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  // Type: COTIZACION, FACTURA, NOTA_ENTREGA, OTRO
  type: text("type").notNull(),
  fileName: text("file_name"),
  fileUrl: text("file_url").notNull(),
  uploadedBy: pgUuid("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const quoteDocumentsRelations = relations(quoteDocuments, ({ one }) => ({
  quote: one(quotes, { fields: [quoteDocuments.quoteId], references: [quotes.id] }),
  uploader: one(users, { fields: [quoteDocuments.uploadedBy], references: [users.id] }),
}));

// ─── Quote Number Counters (Contador atómico de numeración por año) ───
export const quoteNumberCounters = pgTable("quote_number_counters", {
  year: integer("year").primaryKey(),
  lastNumber: integer("last_number").notNull().default(0),
});

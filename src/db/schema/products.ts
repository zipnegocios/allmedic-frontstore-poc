import { pgTable, text, integer, boolean, decimal, timestamp, jsonb, index, uniqueIndex, unique, uuid as pgUuid } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { uuid } from "@/lib/uuid";

// ─── Brands ───
export const brands = pgTable("brands", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
});

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
  collections: many(collections),
  productTypeActivations: many(brandProductTypes),
}));

// ─── Collections ───
// Nota: `slug` era único global; se cambió a único compuesto (brand_id, slug) porque
// la jerarquía real es Marca → Colección (dos marcas pueden llamar "Infinity" a su
// colección). Auditoría confirmó 0 filas y 0 consumidores externos — cambio seguro.
export const collections = pgTable("collections", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  brandId: pgUuid("brand_id").notNull().references(() => brands.id),
  description: text("description"),
  fabricTech: text("fabric_tech"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  unique("uq_collections_brand_slug").on(table.brandId, table.slug),
]);

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  brand: one(brands, { fields: [collections.brandId], references: [brands.id] }),
  products: many(products),
}));

// ─── Product Types (catálogo GLOBAL, reutilizable entre marcas) ───
// La marca no es dueña de la taxonomía; la consume vía `brandProductTypes`
// (activación on-demand). Ver PROMPT-tipos-atributos-globales.md.
export const productTypes = pgTable("product_types", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const productTypesRelations = relations(productTypes, ({ many }) => ({
  products: many(products),
  typeAttributes: many(productTypeAttributes),
  brandActivations: many(brandProductTypes),
}));

// ─── Brand ↔ Product Type (activación: qué tipos globales ofrece cada marca) ───
export const brandProductTypes = pgTable("brand_product_types", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  brandId: pgUuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  productTypeId: pgUuid("product_type_id").notNull().references(() => productTypes.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  unique("uq_brand_product_types").on(table.brandId, table.productTypeId),
]);

export const brandProductTypesRelations = relations(brandProductTypes, ({ one }) => ({
  brand: one(brands, { fields: [brandProductTypes.brandId], references: [brands.id] }),
  productType: one(productTypes, { fields: [brandProductTypes.productTypeId], references: [productTypes.id] }),
}));

// ─── Attributes (estilos/especificaciones EAV) ───
export const attributes = pgTable("attributes", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  displayType: text("display_type").notNull().default("select"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const attributesRelations = relations(attributes, ({ many }) => ({
  values: many(attributeValues),
  typeAttributes: many(productTypeAttributes),
}));

// ─── Sizes (catálogo global de tallas) ───
// Sin relación con el sistema EAV de `attributes`/`attributeValues` — es un catálogo
// simple (agregar/quitar, activar/desactivar) que alimenta el selector de tallas del
// formulario de producto. `product_variants.size` sigue siendo texto libre (no FK):
// esta tabla solo gobierna qué valores ofrece el selector, no una relación referencial.
export const sizes = pgTable("sizes", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  value: text("value").notNull().unique(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Product Type ↔ Attribute (regla de dependencia) ───
export const productTypeAttributes = pgTable("product_type_attributes", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  productTypeId: pgUuid("product_type_id").notNull().references(() => productTypes.id, { onDelete: "cascade" }),
  attributeId: pgUuid("attribute_id").notNull().references(() => attributes.id, { onDelete: "cascade" }),
  isRequired: boolean("is_required").default(false),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  unique("uq_product_type_attributes").on(table.productTypeId, table.attributeId),
]);

export const productTypeAttributesRelations = relations(productTypeAttributes, ({ one }) => ({
  productType: one(productTypes, { fields: [productTypeAttributes.productTypeId], references: [productTypes.id] }),
  attribute: one(attributes, { fields: [productTypeAttributes.attributeId], references: [attributes.id] }),
}));

// ─── Attribute Values ───
export const attributeValues = pgTable("attribute_values", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  attributeId: pgUuid("attribute_id").notNull().references(() => attributes.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  code: text("code"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
}, (table) => [
  unique("uq_attribute_values_attribute_value").on(table.attributeId, table.value),
]);

export const attributeValuesRelations = relations(attributeValues, ({ one, many }) => ({
  attribute: one(attributes, { fields: [attributeValues.attributeId], references: [attributes.id] }),
  variantValues: many(variantAttributeValues),
}));

// ─── Colors ───
export const colors = pgTable("colors", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  hex: text("hex").notNull(),
});

export const colorsRelations = relations(colors, ({ many }) => ({
  variants: many(productVariants),
}));

// ─── Products ───
export const products = pgTable("products", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sku: text("sku"),
  // Código de estilo del fabricante (ej. "2624A"). Núcleo obligatorio de la
  // taxonomía EAV — identificador único del producto-estilo. Único global.
  code: text("code").notNull().unique(),
  brandId: pgUuid("brand_id").notNull().references(() => brands.id),
  collectionId: pgUuid("collection_id").references(() => collections.id),
  // `productTypeId` queda NULLABLE de forma deliberada (ver reporte de Fase 1):
  // el backfill lo puebla al 100% para los datos actuales, pero se deja opcional
  // a nivel de esquema porque el endurecimiento a NOT NULL depende de que el admin
  // (Fase 3) garantice que todo alta futura lo asigne — forzarlo aquí acoplaría el
  // esquema a un flujo de escritura que todavía no existe.
  productTypeId: pgUuid("product_type_id").references(() => productTypes.id),
  gender: text("gender").notNull(),
  priceNormal: decimal("price_normal", { precision: 10, scale: 2 }).notNull(),
  priceSale: decimal("price_sale", { precision: 10, scale: 2 }),
  discountPct: integer("discount_pct"),
  discountEnd: timestamp("discount_end", { withTimezone: true }),
  priceWholesale: decimal("price_wholesale", { precision: 10, scale: 2 }),
  priceWholesaleSale: decimal("price_wholesale_sale", { precision: 10, scale: 2 }),
  wholesaleDiscountEnd: timestamp("wholesale_discount_end", { withTimezone: true }),
  visibility: text("visibility").notNull().default("INDIVIDUAL"),
  // Origen de la portada dual (primaria+secundaria): 'CUSTOM' = subidas específicas
  // para el producto (media_links con role COVER/COVER_SECONDARY); 'FIRST_VARIANT' =
  // referencia viva a las 2 primeras imágenes (por sortOrder) del primer color del
  // producto — no se guardan vínculos COVER en ese modo, se resuelve en lectura.
  coverSource: text("cover_source").notNull().default("CUSTOM"),
  isNew: boolean("is_new").default(false),
  isBestSeller: boolean("is_best_seller").default(false),
  isActive: boolean("is_active").default(true),
  crossSellId: pgUuid("cross_sell_id"),
  features: jsonb("features"),
  careInstructions: jsonb("care_instructions"),
  // Papelera (mismo patrón que `corporate_sets`/`quotes`): no nulo = producto en
  // papelera, oculto de `/admin/productos` y del storefront (ver `softDeleteProduct`).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_products_brand").on(table.brandId),
  index("idx_products_gender").on(table.gender),
  index("idx_products_active").on(table.isActive),
  index("idx_products_deleted").on(table.deletedAt),
]);

export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  collection: one(collections, { fields: [products.collectionId], references: [collections.id] }),
  productType: one(productTypes, { fields: [products.productTypeId], references: [productTypes.id] }),
  variants: many(productVariants),
}));

// ─── Product Variants ───
export const productVariants = pgTable("product_variants", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  productId: pgUuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  colorId: pgUuid("color_id").notNull().references(() => colors.id),
  size: text("size").notNull(),
  // SKU de variante pasa a opcional (decisión ya tomada en el plan): el estilo se
  // identifica por `products.code`, el SKU de fabricante puede no existir aún al
  // dar de alta la matriz. Unicidad parcial: solo se exige entre los SKUs con valor.
  sku: text("sku"),
  // Payload desnormalizado para lectura pública (catálogo/filtros). Se rellena en la
  // Fase 2 (servicio de sincronización) — aquí solo se agrega la columna con su
  // default vacío, sin lógica de backfill real.
  attributesPayload: jsonb("attributes_payload").notNull().default({}),
  status: text("status").notNull().default("AVAILABLE"),
  // Orden de despliegue del color al que pertenece esta variante en el acordeón
  // "Variantes y Medios" del admin — denormalizado (se repite en cada variante del
  // mismo color) porque el color hoy es un concepto implícito derivado de las
  // variantes, no una entidad propia por producto.
  colorSortOrder: integer("color_sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_variants_product").on(table.productId),
  index("idx_variants_color").on(table.colorId),
  uniqueIndex("uq_variants_sku_not_null").on(table.sku).where(sql`${table.sku} IS NOT NULL`),
  index("idx_variants_attributes_payload").using("gin", table.attributesPayload),
]);

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  color: one(colors, { fields: [productVariants.colorId], references: [colors.id] }),
  attributeValues: many(variantAttributeValues),
}));

// ─── Variant ↔ Attribute Value ───
// Un solo valor por atributo por variante: se documenta como decisión de Fase 1 que
// esta invariante NO se fuerza con constraint compuesta a nivel de tabla (requeriría
// desnormalizar attributeId aquí o un trigger) — queda como validación de servicio en
// la Fase 2 (mismo criterio que el resto de la lógica de negocio de la taxonomía).
export const variantAttributeValues = pgTable("variant_attribute_values", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  variantId: pgUuid("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  attributeValueId: pgUuid("attribute_value_id").notNull().references(() => attributeValues.id, { onDelete: "cascade" }),
}, (table) => [
  index("idx_variant_attribute_values_variant").on(table.variantId),
  unique("uq_variant_attribute_value").on(table.variantId, table.attributeValueId),
]);

export const variantAttributeValuesRelations = relations(variantAttributeValues, ({ one }) => ({
  variant: one(productVariants, { fields: [variantAttributeValues.variantId], references: [productVariants.id] }),
  attributeValue: one(attributeValues, { fields: [variantAttributeValues.attributeValueId], references: [attributeValues.id] }),
}));

import { pgTable, text, integer, boolean, decimal, timestamp, jsonb, uuid, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Brands ───
export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
});

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
  collections: many(collections),
}));

// ─── Collections ───
export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  brandId: uuid("brand_id").notNull().references(() => brands.id),
});

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  brand: one(brands, { fields: [collections.brandId], references: [brands.id] }),
  products: many(products),
}));

// ─── Colors ───
export const colors = pgTable("colors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  hex: text("hex").notNull(),
});

export const colorsRelations = relations(colors, ({ many }) => ({
  variants: many(productVariants),
}));

// ─── Products ───
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sku: text("sku"),
  brandId: uuid("brand_id").notNull().references(() => brands.id),
  collectionId: uuid("collection_id").references(() => collections.id),
  category: text("category").notNull(),
  productType: text("product_type"),
  gender: text("gender").notNull(),
  priceNormal: decimal("price_normal", { precision: 10, scale: 2 }).notNull(),
  priceSale: decimal("price_sale", { precision: 10, scale: 2 }),
  discountPct: integer("discount_pct"),
  discountEnd: timestamp("discount_end", { withTimezone: true }),
  isNew: boolean("is_new").default(false),
  isBestSeller: boolean("is_best_seller").default(false),
  isActive: boolean("is_active").default(true),
  crossSellId: uuid("cross_sell_id"),
  features: jsonb("features"),
  careInstructions: jsonb("care_instructions"),
  styles: jsonb("styles"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_products_brand").on(table.brandId),
  index("idx_products_category").on(table.category),
  index("idx_products_gender").on(table.gender),
  index("idx_products_active").on(table.isActive),
]);

export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  collection: one(collections, { fields: [products.collectionId], references: [collections.id] }),
  variants: many(productVariants),
  images: many(productImages),
}));

// ─── Product Variants ───
export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  colorId: uuid("color_id").notNull().references(() => colors.id),
  size: text("size").notNull(),
  fit: text("fit"),
  sku: text("sku").notNull().unique(),
  status: text("status").notNull().default("AVAILABLE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_variants_product").on(table.productId),
  index("idx_variants_color").on(table.colorId),
]);

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  color: one(colors, { fields: [productVariants.colorId], references: [colors.id] }),
}));

// ─── Product Images ───
export const productImages = pgTable("product_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  colorId: uuid("color_id"),
  url: text("url").notNull(),
  alt: text("alt"),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("idx_images_product").on(table.productId),
]);

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

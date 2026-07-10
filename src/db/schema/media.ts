import { pgTable, text, integer, timestamp, jsonb, index, primaryKey, unique, uuid as pgUuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuid } from "@/lib/uuid";
import { users } from "./auth";

// ─── Media Assets (fuente única de verdad) ───
export const mediaAssets = pgTable("media_assets", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  storageKey: text("storage_key").notNull().unique(),
  fileName: text("file_name").notNull(),
  folder: text("folder").notNull(), // PRODUCTS | SETS | BRANDS | BANNERS | SITE
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  checksumSha256: text("checksum_sha256"),
  altText: text("alt_text"),
  title: text("title"),
  caption: text("caption"),
  createdBy: pgUuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_media_assets_folder").on(table.folder),
  index("idx_media_assets_checksum").on(table.checksumSha256),
]);

export const mediaAssetsRelations = relations(mediaAssets, ({ many, one }) => ({
  tags: many(mediaAssetTags),
  links: many(mediaLinks),
  comments: many(mediaComments),
  audit: many(mediaAudit),
  createdByUser: one(users, { fields: [mediaAssets.createdBy], references: [users.id] }),
}));

// ─── Etiquetas libres ───
export const mediaTags = pgTable("media_tags", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const mediaTagsRelations = relations(mediaTags, ({ many }) => ({
  assets: many(mediaAssetTags),
}));

export const mediaAssetTags = pgTable("media_asset_tags", {
  assetId: pgUuid("asset_id").notNull().references(() => mediaAssets.id, { onDelete: "cascade" }),
  tagId: pgUuid("tag_id").notNull().references(() => mediaTags.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.assetId, table.tagId] }),
]);

export const mediaAssetTagsRelations = relations(mediaAssetTags, ({ one }) => ({
  asset: one(mediaAssets, { fields: [mediaAssetTags.assetId], references: [mediaAssets.id] }),
  tag: one(mediaTags, { fields: [mediaAssetTags.tagId], references: [mediaTags.id] }),
}));

// ─── Vínculos polimórficos con SEO contextual ───
export const mediaLinks = pgTable("media_links", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  assetId: pgUuid("asset_id").notNull().references(() => mediaAssets.id, { onDelete: "restrict" }),
  entityType: text("entity_type").notNull(), // PRODUCT | SET | BRAND | BANNER
  entityId: pgUuid("entity_id").notNull(),
  colorId: pgUuid("color_id"), // solo para PRODUCT: galería por color
  role: text("role").notNull().default("GALLERY"), // GALLERY | LOGO | DESKTOP | MOBILE | COVER
  sortOrder: integer("sort_order").default(0),
  altOverride: text("alt_override"),
  titleOverride: text("title_override"),
  captionOverride: text("caption_override"),
}, (table) => [
  index("idx_media_links_entity").on(table.entityType, table.entityId),
  index("idx_media_links_asset").on(table.assetId),
  unique("uniq_media_links").on(table.entityType, table.entityId, table.colorId, table.role, table.assetId),
]);

export const mediaLinksRelations = relations(mediaLinks, ({ one }) => ({
  asset: one(mediaAssets, { fields: [mediaLinks.assetId], references: [mediaAssets.id] }),
}));

// ─── Comentarios ───
export const mediaComments = pgTable("media_comments", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  assetId: pgUuid("asset_id").notNull().references(() => mediaAssets.id, { onDelete: "cascade" }),
  userId: pgUuid("user_id").references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_media_comments_asset").on(table.assetId),
]);

export const mediaCommentsRelations = relations(mediaComments, ({ one }) => ({
  asset: one(mediaAssets, { fields: [mediaComments.assetId], references: [mediaAssets.id] }),
  user: one(users, { fields: [mediaComments.userId], references: [users.id] }),
}));

// ─── Auditoría ───
export const mediaAudit = pgTable("media_audit", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  assetId: pgUuid("asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  action: text("action").notNull(), // UPLOAD | RENAME | REPLACE | UPDATE_SEO | DELETE | LINK | UNLINK
  payload: jsonb("payload"),
  userId: pgUuid("user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_media_audit_asset").on(table.assetId),
]);

export const mediaAuditRelations = relations(mediaAudit, ({ one }) => ({
  asset: one(mediaAssets, { fields: [mediaAudit.assetId], references: [mediaAssets.id] }),
  user: one(users, { fields: [mediaAudit.userId], references: [users.id] }),
}));

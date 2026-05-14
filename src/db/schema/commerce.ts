import { pgTable, text, integer, boolean, decimal, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { uuid } from "@/lib/uuid";

// ─── Stores ───
export const stores = pgTable("stores", {
  id: text("id").primaryKey().$defaultFn(() => uuid()),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone"),
  hours: text("hours"),
  mapUrl: text("map_url"),
  isMain: boolean("is_main").default(false),
  isActive: boolean("is_active").default(true),
  acceptsOnline: boolean("accepts_online").default(false),
  sortOrder: integer("sort_order").default(0),
});

// ─── Leads ───
export const leads = pgTable("leads", {
  id: text("id").primaryKey().$defaultFn(() => uuid()),
  customerName: text("customer_name").notNull(),
  customerCity: text("customer_city").notNull(),
  customerPhone: text("customer_phone"),
  items: jsonb("items").notNull(),
  totalItems: integer("total_items").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discountPct: integer("discount_pct").default(0),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("SENT"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_leads_status").on(table.status),
  index("idx_leads_created").on(table.createdAt),
]);

// ─── Banners ───
export const banners = pgTable("banners", {
  id: text("id").primaryKey().$defaultFn(() => uuid()),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  imageDesktop: text("image_desktop").notNull(),
  imageMobile: text("image_mobile"),
  ctaText: text("cta_text"),
  ctaLink: text("cta_link"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
});

// ─── Search Logs ───
export const searchLogs = pgTable("search_logs", {
  id: text("id").primaryKey().$defaultFn(() => uuid()),
  query: text("query").notNull(),
  results: integer("results").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── WhatsApp Clicks ───
export const whatsappClicks = pgTable("whatsapp_clicks", {
  id: text("id").primaryKey().$defaultFn(() => uuid()),
  productId: text("product_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

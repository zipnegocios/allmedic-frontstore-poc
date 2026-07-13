import { pgTable, text, timestamp, uuid as pgUuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuid } from "@/lib/uuid";
import { mediaAssets } from "./media";

// ─── Company Settings (Datos de empresa — tabla singleton, una sola fila) ───
export const companySettings = pgTable("company_settings", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  logoMediaId: pgUuid("logo_media_id").references(() => mediaAssets.id),
  razonSocial: text("razon_social").notNull().default(""),
  ruc: text("ruc").notNull().default(""),
  address: text("address"),
  phones: text("phones"),
  email: text("email"),
  website: text("website"),
  footerNote: text("footer_note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const companySettingsRelations = relations(companySettings, ({ one }) => ({
  logo: one(mediaAssets, { fields: [companySettings.logoMediaId], references: [mediaAssets.id] }),
}));

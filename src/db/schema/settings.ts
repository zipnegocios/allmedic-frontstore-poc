import { pgTable, text, timestamp, boolean, uuid as pgUuid } from "drizzle-orm/pg-core";
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

// ─── System Settings (interruptores globales — tabla singleton, una sola fila) ───
// Nace con `payment_module_enabled` (plan tareas/pagos, 2026-07-25, decisión 10): apagado
// por defecto, tiene precedencia sobre la matriz de permisos (ver Fase 7 del plan).
export const systemSettings = pgTable("system_settings", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  paymentModuleEnabled: boolean("payment_module_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

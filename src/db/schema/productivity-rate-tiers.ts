import { pgTable, text, boolean, decimal, timestamp, pgEnum, uuid as pgUuid, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuid } from "@/lib/uuid";

// Tablas sin dependencia de `users` a propósito: `users.tier_id` referencia
// `productivityRateTiers.id`, así que este archivo no puede importar `auth.ts`
// (rompería el ciclo ESM auth.ts ↔ productivity-tasks.ts). La relación con `users`
// se declara del lado de productivity-tasks.ts, que sí importa ambos módulos.
export const productivityRateTiers = pgTable("productivity_rate_tiers", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const productivityRateComponentEnum = pgEnum("productivity_rate_component", [
  "VARIANT", "PRODUCT", "SET", "MEDIA", "TIME_BONUS",
]);

export const productivityRates = pgTable("productivity_rates", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  tierId: pgUuid("tier_id").notNull().references(() => productivityRateTiers.id, { onDelete: "cascade" }),
  componentType: productivityRateComponentEnum("component_type").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  // Solo aplican cuando componentType = TIME_BONUS.
  bonusPerUnitUnderTarget: decimal("bonus_per_unit_under_target", { precision: 10, scale: 2 }),
  penaltyPerUnitOverTarget: decimal("penalty_per_unit_over_target", { precision: 10, scale: 2 }),
}, (table) => [
  index("idx_productivity_rates_tier").on(table.tierId),
]);

export const productivityRatesRelations = relations(productivityRates, ({ one }) => ({
  tier: one(productivityRateTiers, { fields: [productivityRates.tierId], references: [productivityRateTiers.id] }),
}));

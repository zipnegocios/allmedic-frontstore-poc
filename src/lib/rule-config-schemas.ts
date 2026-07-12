import { z } from 'zod';
import type { BusinessRule } from '@/lib/rules-engine';

// ─── Validación de `config` por `ruleType` — un schema exacto por cada tipo definido
// en `src/lib/rules-engine/types.ts`, para que el panel de admin nunca pueda persistir
// una config con la forma incorrecta para el tipo elegido.

export const RULE_CONFIG_SCHEMAS = {
  MIN_QUANTITY: z.object({
    min: z.number().int().positive(),
    countUnit: z.enum(['SETS', 'PIECES']),
  }),
  MULTIPLES_ONLY: z.object({
    multipleOf: z.number().int().positive(),
  }),
  QUANTITY_RANGE: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().positive().nullable(),
  }),
  SIZE_MODE: z.object({
    mode: z.enum(['MATRIX', 'PER_PIECE', 'NO_SIZES']),
  }),
  PRICE_VISIBILITY: z.object({
    showPrices: z.boolean(),
    catalog: z.enum(['INDIVIDUAL', 'CORPORATE', 'BOTH']),
  }),
  INVENTORY_MODE: z.object({
    mode: z.enum(['IGNORE', 'BLOCK', 'INFORMATIVE']),
  }),
  VOLUME_SCALE: z.object({
    tiers: z.array(z.object({ minQty: z.number().int().positive(), discountPct: z.number().min(0).max(100) })).min(1),
  }),
  PROMO: z.object({
    kind: z.string().min(1),
    buy: z.number().int().positive(),
    free: z.number().int().positive(),
  }),
  COLOR_RESTRICTION: z.object({
    colorCode: z.string().min(1),
    min: z.number().int().positive(),
  }),
  VOLUME_DISCOUNT_RETAIL: z.object({
    tiers: z.array(z.object({ minItems: z.number().int().positive(), pct: z.number().min(0).max(100) })).min(1),
  }),
} as const;

export type RuleTypeKey = keyof typeof RULE_CONFIG_SCHEMAS;

export const RULE_TYPE_LABELS: Record<RuleTypeKey, string> = {
  MIN_QUANTITY: 'Cantidad mínima',
  MULTIPLES_ONLY: 'Solo múltiplos',
  QUANTITY_RANGE: 'Rango de cantidad',
  SIZE_MODE: 'Modo de tallas',
  PRICE_VISIBILITY: 'Visibilidad de precios',
  INVENTORY_MODE: 'Modo de inventario',
  VOLUME_SCALE: 'Escala por volumen (corporativo)',
  PROMO: 'Promoción',
  COLOR_RESTRICTION: 'Restricción por color',
  VOLUME_DISCOUNT_RETAIL: 'Descuento por volumen (individual)',
};

export function validateRuleConfig(ruleType: string, config: unknown) {
  const schema = RULE_CONFIG_SCHEMAS[ruleType as RuleTypeKey];
  if (!schema) throw new Error(`Tipo de regla desconocido: ${ruleType}`);
  return schema.parse(config);
}

/** Convierte una fila de `business_rules` (tal como la devuelve Drizzle) al shape `BusinessRule` del motor. */
export function toBusinessRule(row: {
  id: string; name: string; ruleType: string; scope: string; scopeId: string | null;
  config: unknown; isActive: boolean | null; priority: number | null;
  validFrom: Date | null; validTo: Date | null;
}): BusinessRule {
  return {
    id: row.id,
    name: row.name,
    ruleType: row.ruleType as BusinessRule['ruleType'],
    scope: row.scope as BusinessRule['scope'],
    scopeId: row.scopeId,
    config: row.config as Record<string, unknown>,
    isActive: row.isActive ?? true,
    priority: row.priority ?? 0,
    validFrom: row.validFrom,
    validTo: row.validTo,
  };
}

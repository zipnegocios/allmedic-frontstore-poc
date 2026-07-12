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
  // PROMO: unión discriminada por `kind` — 8 tipos. Los refinamientos cruzados (THRESHOLD_DISCOUNT:
  // exactamente uno de pct/amount; GIFT: al menos una condición) se validan con `.superRefine` sobre
  // la unión completa, no dentro de cada miembro — z.discriminatedUnion exige que cada miembro sea
  // un z.object "plano" (sin .refine propio) para poder indexar por el discriminante.
  PROMO: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('N_PLUS_ONE'), buy: z.number().int().positive(), free: z.number().int().positive() }),
    z.object({ kind: z.literal('PERCENT_OFF'), pct: z.number().min(0).max(100) }),
    z.object({ kind: z.literal('FIXED_AMOUNT_OFF'), amountPerUnit: z.number().positive() }),
    z.object({ kind: z.literal('FIXED_PRICE'), price: z.number().positive() }),
    z.object({ kind: z.literal('NTH_UNIT_PCT'), n: z.number().int().min(2), pct: z.number().min(0).max(100) }),
    z.object({
      kind: z.literal('THRESHOLD_DISCOUNT'),
      minSubtotal: z.number().positive(),
      pct: z.number().min(0).max(100).optional(),
      amount: z.number().positive().optional(),
    }),
    z.object({
      kind: z.literal('GIFT'),
      minQty: z.number().int().positive().optional(),
      minSubtotal: z.number().positive().optional(),
      description: z.string().min(1),
    }),
    z.object({
      kind: z.literal('COMBO'),
      triggerSetId: z.string().min(1),
      triggerMinQty: z.number().int().positive(),
      targetSetId: z.string().min(1),
      pct: z.number().min(0).max(100),
    }),
  ]).superRefine((val, ctx) => {
    if (val.kind === 'THRESHOLD_DISCOUNT') {
      const hasPct = val.pct !== undefined;
      const hasAmount = val.amount !== undefined;
      if (hasPct === hasAmount) {
        ctx.addIssue({ code: 'custom', message: 'THRESHOLD_DISCOUNT requiere exactamente uno de "pct" o "amount"' });
      }
    }
    if (val.kind === 'GIFT' && val.minQty === undefined && val.minSubtotal === undefined) {
      ctx.addIssue({ code: 'custom', message: 'GIFT requiere al menos una condición: "minQty" o "minSubtotal"' });
    }
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

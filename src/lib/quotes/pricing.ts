// ─── Servicio de precios sugeridos para líneas de cotización ───
// Módulo puro y testeable — sin dependencias de base de datos. Consume el motor de reglas
// (`src/lib/rules-engine/`) exactamente como lo hace `computeCartPricing` para el carrito
// corporativo, pero resolviendo UNA línea de cotización a la vez (una cotización es curada
// manualmente por un vendedor, no un carrito de compra). El motor NO se modifica.

import {
  resolveRules,
  resolveBestRule,
  type BusinessRule,
  type RuleContext,
  type PromoKind,
  type VolumeScaleConfig,
  type VolumeDiscountRetailConfig,
} from "@/lib/rules-engine";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface QuoteLineContext {
  channel: "CORPORATE" | "RETAIL";
  quantity: number;
  /** Precio base ya resuelto por el caller: precio de set (corporativo) o precio retail/mayorista (individual). */
  basePrice: number;
  setId?: string | null;
  brandId?: string | null;
  productId?: string | null;
  /** Piezas del set, para reglas de ámbito PRODUCT — ver `RuleContext.productIds`. */
  productIds?: string[];
}

export interface QuotePricingBreakdownEntry {
  ruleId: string;
  ruleName: string;
  kind: PromoKind | "VOLUME_SCALE" | "VOLUME_DISCOUNT_RETAIL";
  amount: number;
}

export interface SuggestedPriceResult {
  basePrice: number;
  suggestedUnitPrice: number;
  breakdown: QuotePricingBreakdownEntry[];
}

/** Una pieza del set elegida por el cliente al armar el carrito corporativo (ver `CartLineSchema` en `/api/corporate/quotes`). */
export interface QuoteLineCompositionPiece {
  productId: string;
  size?: string;
  color?: string;
}

/**
 * `quoteItems.pricingBreakdown` tiene dos formas legítimas según el origen de la línea:
 * - Array de `QuotePricingBreakdownEntry`: ajustes del motor de reglas sobre una línea resuelta
 *   por `resolveSuggestedPrice` (recalcular sugeridos en el editor admin).
 * - `{ composition }`: piezas de un set elegidas por el cliente en el carrito corporativo
 *   público (`POST /api/corporate/quotes`) — no hay ajuste de reglas que mostrar, solo qué
 *   producto/talla/color componen esa línea.
 * Ambas formas deben poder ir y volver intactas en cada `PATCH` del editor admin.
 */
export type QuoteItemPricingBreakdown =
  | QuotePricingBreakdownEntry[]
  | { composition: QuoteLineCompositionPiece[] }
  | null;

/**
 * Resuelve el precio sugerido de una línea de cotización: precio base + ajustes del motor de
 * reglas (volumen y promociones) para el contexto de esa línea. No acumula entre líneas (a
 * diferencia del carrito, cada línea de cotización es independiente) y no aplica los tipos de
 * PROMO de nivel-carrito (THRESHOLD_DISCOUNT, GIFT, COMBO) — esos requieren ver todas las líneas
 * a la vez y quedan fuera del alcance de "sugerido por línea" (el vendedor puede aplicarlos como
 * descuento global manual si corresponde).
 */
export function resolveSuggestedPrice(
  line: QuoteLineContext,
  allRules: BusinessRule[],
  now: Date = new Date()
): SuggestedPriceResult {
  const context: RuleContext = {
    setId: line.setId ?? undefined,
    brandId: line.brandId ?? undefined,
    productId: line.productId ?? undefined,
    productIds: line.productIds,
  };

  const resolved = resolveRules(allRules, context, now);
  const breakdown: QuotePricingBreakdownEntry[] = [];
  const lineSubtotal = round2(line.basePrice * line.quantity);
  let discountTotal = 0;

  // ── Escala por volumen ──
  if (line.channel === "CORPORATE") {
    const volumeRule = resolveBestRule(allRules, "VOLUME_SCALE", context, now);
    if (volumeRule) {
      const config = volumeRule.config as unknown as VolumeScaleConfig;
      const applicableTiers = config.tiers.filter((t) => line.quantity >= t.minQty).sort((a, b) => b.minQty - a.minQty);
      if (applicableTiers.length > 0) {
        const amount = round2(lineSubtotal * (applicableTiers[0].discountPct / 100));
        if (amount > 0) {
          discountTotal += amount;
          breakdown.push({ ruleId: volumeRule.id, ruleName: volumeRule.name, kind: "VOLUME_SCALE", amount });
        }
      }
    }
  } else if (resolved.volumeDiscountRetail) {
    const config = resolved.volumeDiscountRetail as VolumeDiscountRetailConfig;
    const applicableTiers = config.tiers.filter((t) => line.quantity >= t.minItems).sort((a, b) => b.minItems - a.minItems);
    if (applicableTiers.length > 0) {
      const amount = round2(lineSubtotal * (applicableTiers[0].pct / 100));
      if (amount > 0) {
        discountTotal += amount;
        breakdown.push({ ruleId: "volume-discount-retail", ruleName: "Descuento por volumen (individual)", kind: "VOLUME_DISCOUNT_RETAIL", amount });
      }
    }
  }

  // ── PROMO por ítem (mismos 5 tipos por-ítem que `computeCartPricing`) ──
  for (const { id: ruleId, name: ruleName, config } of resolved.promos) {
    let amount = 0;
    switch (config.kind) {
      case "N_PLUS_ONE":
        if (config.buy > 0) {
          const cycles = Math.floor(line.quantity / config.buy);
          amount = round2(cycles * config.free * line.basePrice);
        }
        break;
      case "PERCENT_OFF":
        amount = round2(lineSubtotal * (config.pct / 100));
        break;
      case "FIXED_AMOUNT_OFF":
        amount = round2(line.quantity * config.amountPerUnit);
        break;
      case "FIXED_PRICE":
        amount = round2(line.quantity * Math.max(0, line.basePrice - config.price));
        break;
      case "NTH_UNIT_PCT":
        if (config.n > 0) {
          const cycles = Math.floor(line.quantity / config.n);
          amount = round2(cycles * line.basePrice * (config.pct / 100));
        }
        break;
      default:
        // THRESHOLD_DISCOUNT, GIFT, COMBO son de nivel carrito — fuera de alcance por línea.
        break;
    }
    if (amount > 0) {
      discountTotal += amount;
      breakdown.push({ ruleId, ruleName, kind: config.kind, amount });
    }
  }

  const cappedDiscount = Math.min(discountTotal, lineSubtotal);
  const suggestedLineTotal = round2(Math.max(0, lineSubtotal - cappedDiscount));
  const suggestedUnitPrice = line.quantity > 0 ? round2(suggestedLineTotal / line.quantity) : line.basePrice;

  return { basePrice: line.basePrice, suggestedUnitPrice, breakdown };
}

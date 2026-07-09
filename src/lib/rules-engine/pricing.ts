import type { BusinessRule, CorporateCart, PricingResult, SetPriceInfo } from "./types";
import { resolveRules } from "./resolve";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula subtotales, escala de volumen y total referencial de un carrito corporativo.
 * Se usa IDÉNTICO en cliente (preview) y servidor (fuente de verdad) — sin efectos
 * secundarios, solo funciones puras sobre los datos recibidos.
 */
export function computeCartPricing(
  cart: CorporateCart,
  setPrices: Record<string, SetPriceInfo>,
  allRules: BusinessRule[],
  now: Date = new Date()
): PricingResult {
  const lines = cart.items.map((item) => {
    const quantity = item.lines.reduce((sum, line) => sum + line.quantity, 0);
    const priceInfo = setPrices[item.setId];
    const unitPrice = priceInfo?.pricePerSet ?? 0;
    return {
      setId: item.setId,
      quantity,
      unitPrice,
      lineSubtotal: round2(unitPrice * quantity),
    };
  });

  const hasMissingPrices = cart.items.some((item) => setPrices[item.setId]?.hasMissingPrices ?? true);

  const subtotalBeforeDiscount = round2(lines.reduce((sum, l) => sum + l.lineSubtotal, 0));
  const totalSets = cart.items.reduce(
    (sum, item) => sum + item.lines.reduce((lineSum, line) => lineSum + line.quantity, 0),
    0
  );

  // Escala de volumen resuelta a nivel GLOBAL (MVP — no diferenciada por set/marca)
  const resolved = resolveRules(allRules, {}, now);
  let volumeDiscountPct = 0;
  if (resolved.volumeScale) {
    const applicableTiers = resolved.volumeScale.tiers
      .filter((t) => totalSets >= t.minQty)
      .sort((a, b) => b.minQty - a.minQty);
    if (applicableTiers.length > 0) {
      volumeDiscountPct = applicableTiers[0].discountPct;
    }
  }

  const volumeDiscountAmount = round2(subtotalBeforeDiscount * (volumeDiscountPct / 100));
  const total = round2(subtotalBeforeDiscount - volumeDiscountAmount);

  return {
    lines,
    subtotalBeforeDiscount,
    volumeDiscountPct,
    volumeDiscountAmount,
    total,
    hasMissingPrices,
  };
}

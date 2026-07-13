// ─── Cálculo de totales de una cotización ───
// Módulo puro y testeable — mismo resultado en cliente (preview en vivo) y servidor (fuente de
// verdad al guardar). Orden fijo: subtotal (con descuento de línea) → descuento global →
// subtotal neto → impuesto (agrupado por tarifa efectiva) → total. Redondeo a 2 decimales en
// cada paso intermedio, mismo patrón `round2` que `rules-engine/pricing.ts`, para evitar
// arrastre de error de punto flotante.

export type DiscountType = "PERCENTAGE" | "FIXED";

export interface QuoteTotalsLineInput {
  quantity: number;
  unitPrice: number;
  discountType?: DiscountType | null;
  discountValue?: number;
  /** Tasa de impuesto específica de esta línea — si se omite, se usa la tasa de cabecera. */
  taxRateOverride?: number | null;
}

export interface QuoteTotalsConfig {
  discountType?: DiscountType | null;
  discountValue?: number;
  /** Tasa de impuesto de cabecera (%), aplicada a las líneas sin `taxRateOverride`. */
  taxRate: number;
  /** true: `unitPrice` ya incluye el impuesto (se desglosa hacia atrás). false: el impuesto se suma al final. */
  pricesIncludeTax: boolean;
}

export interface TaxBreakdownEntry {
  rate: number;
  taxableBase: number;
  taxAmount: number;
}

export interface QuoteTotals {
  subtotal: number;
  lineDiscountTotal: number;
  globalDiscount: number;
  totalDiscount: number;
  netSubtotal: number;
  taxBreakdown: TaxBreakdownEntry[];
  totalTax: number;
  total: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function applyDiscount(base: number, type: DiscountType | null | undefined, value: number): number {
  if (!type || !value) return 0;
  const raw = type === "PERCENTAGE" ? base * (value / 100) : value;
  return round2(Math.max(0, Math.min(raw, base)));
}

export function computeQuoteTotals(lines: QuoteTotalsLineInput[], config: QuoteTotalsConfig): QuoteTotals {
  let subtotal = 0;
  let lineDiscountTotal = 0;
  // Base neta (post-descuento de línea) agrupada por tarifa efectiva — para el desglose de
  // impuestos por tarifa cuando hay overrides de línea mezclados con la tasa de cabecera.
  const netByRate = new Map<number, number>();

  for (const line of lines) {
    const gross = round2(line.quantity * line.unitPrice);
    const discount = applyDiscount(gross, line.discountType, line.discountValue ?? 0);
    const net = round2(gross - discount);
    subtotal = round2(subtotal + gross);
    lineDiscountTotal = round2(lineDiscountTotal + discount);

    const rate = line.taxRateOverride ?? config.taxRate;
    netByRate.set(rate, round2((netByRate.get(rate) ?? 0) + net));
  }

  const netSubtotalBeforeGlobalDiscount = round2(subtotal - lineDiscountTotal);
  const globalDiscount = applyDiscount(netSubtotalBeforeGlobalDiscount, config.discountType, config.discountValue ?? 0);

  // El descuento global se prorratea proporcionalmente entre los grupos de tarifa para no
  // perder la relación base-imponible↔tarifa que ya se armó por línea.
  const globalDiscountRatio = netSubtotalBeforeGlobalDiscount > 0 ? globalDiscount / netSubtotalBeforeGlobalDiscount : 0;

  const taxBreakdown: TaxBreakdownEntry[] = [];
  let totalTax = 0;
  let netSubtotal = 0;

  for (const [rate, netBeforeGlobal] of netByRate.entries()) {
    const netAfterGlobal = round2(netBeforeGlobal * (1 - globalDiscountRatio));
    netSubtotal = round2(netSubtotal + netAfterGlobal);

    let taxableBase: number;
    let taxAmount: number;
    if (config.pricesIncludeTax) {
      taxableBase = round2(netAfterGlobal / (1 + rate / 100));
      taxAmount = round2(netAfterGlobal - taxableBase);
    } else {
      taxableBase = netAfterGlobal;
      taxAmount = round2(netAfterGlobal * (rate / 100));
    }
    if (netAfterGlobal !== 0 || rate !== 0) {
      taxBreakdown.push({ rate, taxableBase, taxAmount });
    }
    totalTax = round2(totalTax + taxAmount);
  }

  const total = config.pricesIncludeTax ? netSubtotal : round2(netSubtotal + totalTax);

  return {
    subtotal,
    lineDiscountTotal,
    globalDiscount,
    totalDiscount: round2(lineDiscountTotal + globalDiscount),
    netSubtotal,
    taxBreakdown,
    totalTax,
    total,
  };
}

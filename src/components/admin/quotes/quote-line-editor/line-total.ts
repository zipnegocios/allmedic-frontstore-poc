/**
 * Cálculo del importe de una línea de cotización (cantidad × precio unitario
 * menos su descuento propio). Módulo puro compartido entre la vista tabla
 * (desktop) y la vista de tarjetas editables (mobile) de `QuoteLineEditor`
 * — un único punto de verdad, sin forkear la lógica entre presentaciones.
 *
 * Nota: esto es un cálculo de *display* por línea, distinto de
 * `computeQuoteTotals` (`src/lib/quotes/totals.ts`), que calcula los totales
 * agregados de la cotización completa (incluye descuento global e
 * impuestos). Ambos módulos son la fuente de verdad para su respectivo
 * cálculo — ninguno se duplica en otro lugar del código.
 */

export type LineDiscountType = 'PERCENTAGE' | 'FIXED';

export interface LineTotalInput {
  quantity: number;
  unitPrice: number;
  discountType?: LineDiscountType | null;
  discountValue?: number;
}

export function computeLineTotal({ quantity, unitPrice, discountType, discountValue }: LineTotalInput): number {
  const gross = quantity * unitPrice;
  const discount = discountType === 'PERCENTAGE' ? gross * ((discountValue ?? 0) / 100) : (discountValue ?? 0);
  return Math.max(0, gross - Math.min(discount, gross));
}

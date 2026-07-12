// ─── Precio manual (override) de un set corporativo ───
// Módulo puro y testeable — sin dependencias de base de datos. Vive separado de
// `corporate-data-service.ts` (que sí importa la conexión a BD) para poder testear esta regla
// de negocio con Vitest sin arrastrar la configuración de conexión a Postgres.

/**
 * Precio manual (override) del set, si está definido — `null` si el set no tiene uno
 * configurado (en cuyo caso se usa la suma automática de piezas). Si la rebaja manual venció
 * (`manualDiscountEnd` en el pasado), cae al precio manual base, igual que el precio al mayor
 * de un producto.
 */
export function effectiveManualPrice(
  priceManual: string | null,
  priceManualSale: string | null,
  manualDiscountEnd: Date | null,
  now: Date = new Date()
): number | null {
  if (!priceManual) return null;
  const saleVigente = !!priceManualSale && (!manualDiscountEnd || manualDiscountEnd > now);
  return saleVigente ? Number(priceManualSale) : Number(priceManual);
}

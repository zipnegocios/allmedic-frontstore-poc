import type { EligibleProduct } from './schema';

export interface PairedColorWarning {
  /** Pieza a la que le falta el color (para resaltarla en la UI si hace falta). */
  missingProductId: string;
  message: string;
}

/**
 * Para el modo "Piezas combinadas por color": calcula, para cada pieza del set, qué colores
 * tienen las DEMÁS piezas pero a ella le faltan — esos colores no tendrán paridad completa y por
 * lo tanto no se ofrecerán en el armador público (ver SetDetailContent.tsx). Puramente
 * informativo para el admin, nunca bloquea el guardado. `items` es la lista aplanada de las 4
 * opciones de bloque (2 bloques × 2 opciones) — nunca incluye piezas recomendadas.
 */
export function computePairedColorWarnings(
  items: Array<{ productId: string }>,
  products: EligibleProduct[]
): PairedColorWarning[] {
  const pieces = items
    .map((item) => products.find((p) => p.id === item.productId))
    .filter((p): p is EligibleProduct => Boolean(p));

  if (pieces.length < 2) return [];

  const warnings: PairedColorWarning[] = [];
  for (const piece of pieces) {
    const ownCodes = new Set(piece.colors.map((c) => c.code).filter(Boolean));
    const missingByOther = new Map<string, string>(); // colorCode -> colorName
    for (const other of pieces) {
      if (other.id === piece.id) continue;
      for (const c of other.colors) {
        if (c.code && !ownCodes.has(c.code) && !missingByOther.has(c.code)) {
          missingByOther.set(c.code, c.name);
        }
      }
    }
    for (const [colorCode, colorName] of missingByOther) {
      const otherWithColor = pieces.find((p) => p.id !== piece.id && p.colors.some((c) => c.code === colorCode));
      warnings.push({
        missingProductId: piece.id,
        message: `Producto ${piece.code ?? piece.name} le falta el color ${colorName} para poder combinarlo con Producto ${otherWithColor?.code ?? otherWithColor?.name ?? ''}`,
      });
    }
  }
  return warnings;
}

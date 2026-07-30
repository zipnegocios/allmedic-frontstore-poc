import type { EligibleProduct, SetColorComboData } from './schema';

/** Colores disponibles para portada (Set × Color, ver `SetColorsSection`) — la intersección
 * entre TODOS los bloques del set: en modo PAIRED, colores presentes en TODAS las piezas de
 * bloque (mismo criterio que `strictPairedColors` de `SetDetailContent.tsx`, sin el filtro de
 * stock/imagen que es exclusivo del armador público); en modo MIXED, la unión de colores
 * usados en los combos activos. Devuelve `{ id, name, code, hex }` únicos por `id`. */
export function computeSetColorIntersection(
  colorMode: 'PAIRED' | 'MIXED' | undefined,
  items: Array<{ productId: string }>,
  products: EligibleProduct[],
  colorCombos: SetColorComboData[]
): EligibleProduct['colors'] {
  const pieces = items
    .map((item) => products.find((p) => p.id === item.productId))
    .filter((p): p is EligibleProduct => Boolean(p));

  if (colorMode === 'MIXED') {
    const colorMap = new Map<string, EligibleProduct['colors'][number]>();
    for (const combo of colorCombos) {
      if (!combo.isActive) continue;
      for (const item of combo.items) {
        const piece = pieces.find((p) => p.id === item.productId);
        const color = piece?.colors.find((c) => c.code === item.colorCode);
        if (color && !colorMap.has(color.id)) colorMap.set(color.id, color);
      }
    }
    return Array.from(colorMap.values());
  }

  if (pieces.length === 0) return [];
  let intersectionCodes = new Set(pieces[0].colors.map((c) => c.code));
  for (const piece of pieces.slice(1)) {
    const codes = new Set(piece.colors.map((c) => c.code));
    intersectionCodes = new Set(Array.from(intersectionCodes).filter((c) => codes.has(c)));
  }
  const colorMap = new Map<string, EligibleProduct['colors'][number]>();
  for (const piece of pieces) {
    for (const c of piece.colors) {
      if (intersectionCodes.has(c.code) && !colorMap.has(c.id)) colorMap.set(c.id, c);
    }
  }
  return Array.from(colorMap.values());
}

export interface PairedColorWarning {
  /** Pieza a la que le falta el color (para resaltarla en la UI si hace falta). */
  missingProductId: string;
  message: string;
}

/**
 * Para el modo "Piezas combinadas por color": calcula, para cada pieza del set, qué colores
 * tienen las DEMÁS piezas pero a ella le faltan — esos colores no tendrán paridad completa y por
 * lo tanto no se ofrecerán en el armador público (ver SetDetailContent.tsx). Puramente
 * informativo para el admin, nunca bloquea el guardado. `items` es la lista aplanada de las
 * opciones de bloque (2 bloques, 1 o 2 opciones cada uno) — nunca incluye piezas recomendadas.
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

import type { ProductColor, ProductVariant } from './types';
import type { Gender } from './types';
import type { MediaItem } from './media';

export interface SetPiece {
  /** Id de la fila `set_block_options` (opción de bloque) o `set_recommended_items` según el
   * arreglo donde aparezca esta pieza — no hay más un `set_items.id` único. */
  setItemId: string;
  productId: string;
  productName: string;
  productSlug: string;
  /** Presente solo en piezas que son opción de un bloque (ausente en `recommendedPieces`,
   * que no tienen cantidad propia — la cantidad la define el cliente en la PDP). */
  quantityPerSet?: number;
  priceWholesale: number | null;
  priceWholesaleSale: number | null;
  colors: ProductColor[];
  availableSizes: string[];
  variants: ProductVariant[];
}

/** Un bloque de alternancia — el cliente elige 1 de las 2 `options`. `quantityPerSet` es
 * único por bloque (compartido entre sus 2 opciones), no por pieza individual. */
export interface SetBlock {
  id: string;
  blockCode: 'A' | 'B';
  quantityPerSet: number;
  options: [SetPiece, SetPiece];
}

export interface CorporateSetSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Portada primaria/secundaria — paridad con productos (`resolveCoverMedia`/
   * `resolveSecondaryCoverMedia`). `secondaryCover` ausente si no hay hover-swap. */
  cover: MediaItem | null;
  secondaryCover: MediaItem | null;
  brandName: string | null;
  /** Id de la marca (para resolver reglas por ítem en el grid — `brandName` es solo para mostrar/filtrar). */
  brandId: string | null;
  /** Ids de los productos que componen el set — para resolver reglas de ámbito Producto en el grid. */
  productIds: string[];
  isFeatured: boolean;
  /** Número de bloques del set — siempre 2 (Bloque A / Bloque B), nunca la cantidad de
   * opciones cargadas (que siempre son 2 por bloque = 4 piezas configurables). */
  pieceCount: number;
  /** true si el set tiene al menos una pieza recomendada activa — usado por el grid para
   * mostrar el badge correspondiente sin traer `recommendedPieces` completo. */
  hasRecommendedItems: boolean;
  referencePrice: number | null;
  hasMissingPrices: boolean;
  /** Atributos agregados de las piezas activas del set — usados por el filtrado de `/corporativo`. */
  colors: ProductColor[];
  sizes: string[];
  genders: Gender[];
  /** Nombres de `productTypes` (EAV) presentes entre las piezas del set — fuente de verdad para filtros. Vacío si ninguna pieza tiene `productTypeId` asignado. */
  productTypes: string[];
  /** Agregado EAV de `variants[].styles` a través de todas las piezas del set: slug de atributo → valores únicos presentes. */
  availableStyles: Record<string, string[]>;
  pieceNames: string[];
  createdAt: string;
}

/** Una combinación de color curada por el admin (modo MIXED) — una entrada por pieza del set. */
export interface SetColorCombo {
  id: string;
  items: Array<{ productId: string; colorCode: string }>;
}

export interface CorporateSetDetail extends CorporateSetSummary {
  brandId: string | null;
  /** Tupla fija de 2 — Bloque A y Bloque B, siempre en ese orden. */
  blocks: [SetBlock, SetBlock];
  /** Piezas sugeridas de la misma colección/marca — libres, no forman parte de los bloques,
   * no afectan `MIN_QUANTITY`/`COLOR_RESTRICTION`/`COLOR_PAIRING` del set. */
  recommendedPieces: SetPiece[];
  /** PAIRED = la pieza elegida de cada bloque se pide en un único color compartido; MIXED = el
   * comprador solo puede elegir entre `colorCombos` (combinaciones de color curadas por el
   * admin, una entrada por productId de opción de bloque). */
  colorMode: 'PAIRED' | 'MIXED';
  /** Solo poblado (y relevante) cuando `colorMode === 'MIXED'` — combos activos, ya ordenados. */
  colorCombos: SetColorCombo[];
}

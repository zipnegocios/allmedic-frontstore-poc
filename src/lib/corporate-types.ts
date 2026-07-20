import type { ProductColor, ProductVariant } from './types';
import type { Gender } from './types';
import type { MediaItem } from './media';

export interface SetPiece {
  setItemId: string;
  productId: string;
  productName: string;
  productSlug: string;
  quantityPerSet: number;
  priceWholesale: number | null;
  priceWholesaleSale: number | null;
  colors: ProductColor[];
  availableSizes: string[];
  variants: ProductVariant[];
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
  pieceCount: number;
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
  pieces: SetPiece[];
  /** PAIRED = todas las piezas se piden en un único color compartido; MIXED = el comprador solo
   * puede elegir entre `colorCombos` (combinaciones de color curadas por el admin). */
  colorMode: 'PAIRED' | 'MIXED';
  /** Solo poblado (y relevante) cuando `colorMode === 'MIXED'` — combos activos, ya ordenados. */
  colorCombos: SetColorCombo[];
}

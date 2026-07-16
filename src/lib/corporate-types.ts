import type { ProductColor, ProductVariant } from './types';
import type { Gender } from './types';

export interface SetGroupSummary {
  id: string;
  name: string;
  slug: string;
}

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
  imageUrl: string | null;
  groupName: string | null;
  groupSlug: string | null;
  /** Id del grupo de sets (para resolver reglas por ítem en el grid — `groupSlug` es solo para filtros de UI). */
  setGroupId: string | null;
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
  categories: string[];
  fits: string[];
  pieceNames: string[];
  createdAt: string;
}

export interface CorporateSetDetail extends CorporateSetSummary {
  setGroupId: string | null;
  brandId: string | null;
  pieces: SetPiece[];
}

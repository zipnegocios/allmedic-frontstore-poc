import type { ProductColor, ProductVariant } from './types';

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
  brandName: string | null;
  isFeatured: boolean;
  pieceCount: number;
  referencePrice: number | null;
  hasMissingPrices: boolean;
}

export interface CorporateSetDetail extends CorporateSetSummary {
  setGroupId: string | null;
  brandId: string | null;
  pieces: SetPiece[];
}

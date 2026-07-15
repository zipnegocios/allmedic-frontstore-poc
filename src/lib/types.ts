import type { MediaItem } from './media';

export type Size = 'XXS' | 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '2XL' | '3XL' | '4XL' | '5XL' | 'OS';
export type Fit = 'Petite' | 'Regular' | 'Tall' | 'Short';
export type Gender = 'Mujer' | 'Hombre' | 'Unisex';
export type VariantStatus = 'AVAILABLE' | 'BACKORDER' | 'OUT_OF_STOCK';
export type Category = 'Camisas' | 'Pantalones' | 'Chaquetas' | 'Conjuntos' | 'Accesorios' | 'Batas';

export type { MediaItem };

export interface BrandNavItem {
  name: string;
  logoUrl: string | null;
}

export interface ProductColor {
  id: string;
  name: string;
  code: string;
  hex: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  colorId: string;
  size: Size;
  fit?: Fit;
  images: MediaItem[];
  status: VariantStatus;
}

export interface VolumeDiscount {
  quantity: number;
  minQty: number;
  discount: number;
  discountPct: number;
  label: string;
  itemsNeeded?: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  /** Id de la marca (a diferencia de `brand`, el nombre para mostrar) — usado para resolver
   * reglas de negocio por ítem (ej. Visibilidad de precios de ámbito Marca). */
  brandId?: string;
  category: string;
  gender: Gender;
  description: string;
  features: string[];
  careInstructions: string[];
  priceNormal: number;
  priceSale?: number;
  discountPct?: number;
  discountEnd?: string;
  colors: ProductColor[];
  availableSizes: Size[];
  availableFits?: Fit[];
  variants: ProductVariant[];
  cover?: MediaItem;
  isNew: boolean;
  isBestSeller: boolean;
  complementaryProduct?: string;
  volumeDiscounts?: VolumeDiscount[];
}


export interface CartItem {
  id: string;
  productId: string;
  /** Id de la marca del producto — usado para resolver Visibilidad de precios por ítem en el carrito. */
  brandId?: string;
  variantId: string;
  name: string;
  brand: string;
  slug: string;
  color: ProductColor;
  size: Size;
  fit?: Fit;
  sku: string;
  price: number;
  quantity: number;
  image: string;
}

export interface CatalogFilters {
  gender: Gender | null;
  categories: string[];
  category?: string | null;
  brands: string[];
  brand?: string | null;
  colors: string[];
  color?: string | null;
  sizes: string[];
  size?: string | null;
  fits: string[];
  fit?: string | null;
  collection?: string | null;
  collections?: string[];
  style?: string | null;
  styles?: string[];
  priceMin: number;
  priceMax: number;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  isMain: boolean;
  mapUrl?: string;
}

import type { MediaItem } from './media';

export type Size = 'XXS' | 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '2XL' | '3XL' | '4XL' | '5XL' | 'OS';
export type Fit = 'Petite' | 'Regular' | 'Tall' | 'Short';
export type Gender = 'Mujer' | 'Hombre' | 'Unisex';
export type VariantStatus = 'AVAILABLE' | 'BACKORDER' | 'OUT_OF_STOCK';

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
  /** "Corte" de la variante — se deriva de `styles.corte` (EAV) en
   * `data-service.ts`/`corporate-data-service.ts` — ver `CORTE_ATTRIBUTE_SLUG`. */
  fit?: Fit;
  /** Estilos EAV de la variante (slug de atributo → valor), desde `attributesPayload.styles`.
   * Ej: `{ corte: 'Regular' }`. Vacío `{}` si la variante no tiene estilos asignados. */
  styles: Record<string, string>;
  images: MediaItem[];
  status: VariantStatus;
}

/** Referencia liviana al tipo de producto EAV. */
export interface ProductTypeRef {
  id: string;
  name: string;
  slug: string;
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
  /** Tipo de producto EAV (`productTypes.id/name/slug`) — fuente de verdad para filtros de catálogo. `undefined` si el producto no tiene `productTypeId` asignado. */
  productType?: ProductTypeRef;
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
  /** Cortes disponibles del producto — se deriva de `availableStyles.corte` (EAV). */
  availableFits?: Fit[];
  /** Agregado EAV de `variants[].styles` a través de todas las variantes del producto: slug de atributo → valores únicos presentes.
   * Ej: `{ corte: ['Regular', 'Petite'] }`. `undefined` si ninguna variante tiene estilos. */
  availableStyles?: Record<string, string[]>;
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
  /** @deprecated Legacy — usa `productTypeIds` en `/catalogo` (Fase 4). Se mantiene para consumidores que aún no migraron (home/`useProductFilter`). */
  categories: string[];
  category?: string | null;
  /** Ids de `productTypes` seleccionados — fuente de verdad EAV nueva para el filtro "Tipo de Producto" en `/catalogo`. */
  productTypeIds: string[];
  brands: string[];
  brand?: string | null;
  colors: string[];
  color?: string | null;
  sizes: string[];
  size?: string | null;
  /** @deprecated Legacy — usa `selectedStyles` en `/catalogo` (Fase 4). */
  fits: string[];
  fit?: string | null;
  collection?: string | null;
  collections?: string[];
  style?: string | null;
  styles?: string[];
  /** Estilos EAV seleccionados: slug de atributo → valores seleccionados. Ej: `{ corte: ['Regular'] }`. */
  selectedStyles: Record<string, string[]>;
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

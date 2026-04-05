// ============================================
// TIPOS BASE
// ============================================

export type VariantStatus = 'AVAILABLE' | 'BACKORDER' | 'OUT_OF_STOCK';

export type Gender = 'Mujer' | 'Hombre' | 'Unisex';

export type Category = 'Camisas' | 'Pantalones' | 'Chaquetas' | 'Batas' | 'Accesorios';

export type Fit = 'Petite' | 'Short' | 'Regular' | 'Tall';

export type Size = 'XXS' | 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL' | '3XL' | '4XL' | '5XL' | 'OS';

// ============================================
// COLORES
// ============================================

export interface ProductColor {
  id: string;
  name: string;
  code: string;
  hex: string;
}

// ============================================
// VARIANTES
// ============================================

export interface ProductVariant {
  id: string;
  colorId: string;
  size: Size;
  fit?: Fit;
  status: VariantStatus;
  images: string[];
  sku: string;
}

// ============================================
// DESCUENTOS
// ============================================

export interface VolumeDiscount {
  minQty: number;
  discountPct: number;
  label: string;
}

// ============================================
// PRODUCTO
// ============================================

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: Category;
  gender: Gender;
  description: string;
  features: string[];
  careInstructions: string[];
  priceNormal: number;
  priceSale?: number;
  discountPct?: number;
  discountEnd?: Date;
  volumeDiscounts?: VolumeDiscount[];
  colors: ProductColor[];
  variants: ProductVariant[];
  availableSizes: Size[];
  availableFits?: Fit[];
  isNew?: boolean;
  isBestSeller?: boolean;
  relatedProducts?: string[];
  complementaryProduct?: string;
}

// ============================================
// ITEM DEL CARRITO
// ============================================

export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  brand: string;
  color: ProductColor;
  size: Size;
  fit?: Fit;
  quantity: number;
  price: number;
  image: string;
  sku: string;
}

// ============================================
// FILTROS
// ============================================

export interface CatalogFilters {
  gender: Gender | null;
  categories: Category[];
  brands: string[];
  colors: string[];
  sizes: Size[];
  fits: Fit[];
  priceMin: number;
  priceMax: number;
}

// ============================================
// SUCURSAL
// ============================================

export interface Store {
  id: string;
  name: string;
  address: string;
  hours: string;
  mapUrl: string;
  isMain?: boolean;
}

// ============================================
// HERO SLIDE
// ============================================

export interface HeroSlide {
  id: string;
  image: string;
  title: string;
  subtitle?: string;
  cta: string;
  ctaLink: string;
}

import type { Product, Store, ProductColor, Size } from './types';

// Archivo de datos de demostración higienizado.
// Se vacían todos los arreglos para asegurar cero coincidencias de literales mock en el código de producción.

export const COLORS: ProductColor[] = [];
export const AVAILABLE_COLORS = COLORS;
export const SIZES: Size[] = [];
export const BRANDS: string[] = [];
export const CATEGORIES: string[] = [];
export const PRODUCTS: Product[] = [];
export const STORES: Store[] = [];
export const HERO_SLIDES: { id: number; title: string; subtitle: string; image: string; cta: string; ctaLink: string }[] = [];

export function getProductBySlug(slug: string): Product | undefined {
  void slug;
  return undefined;
}

export function getFeaturedProducts(): Product[] {
  return [];
}

export function filterProducts(filters: unknown): Product[] {
  void filters;
  return [];
}

export function searchProducts(query: string): Product[] {
  void query;
  return [];
}

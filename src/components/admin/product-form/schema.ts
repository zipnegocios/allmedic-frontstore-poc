import { z } from 'zod';

// ─── Schemas ───
// Extraído de ProductForm.tsx sin modificar reglas de validación: mismo
// esquema, misma fuente de verdad, reutilizado tanto por la vista desktop
// (Tabs) como por el wizard mobile.

export const VariantSchema = z.object({
  id: z.string().optional(),
  colorId: z.string().min(1, 'Color requerido'),
  size: z.string().min(1, 'Talla requerida'),
  fit: z.string().optional(),
  sku: z.string().min(1, 'SKU requerido'),
  status: z.enum(['AVAILABLE', 'BACKORDER', 'OUT_OF_STOCK']).default('AVAILABLE'),
  stock: z.coerce.number().min(0).default(0),
  minStock: z.coerce.number().min(0).default(5),
});

export const ImageSchema = z.object({
  id: z.string().optional(),
  assetId: z.string().min(1, 'Medio requerido'),
  colorId: z.string().optional(),
  url: z.string().optional(), // solo para previsualización en el form, no se persiste
  storageKey: z.string().optional(), // solo para previsualización en el form, no se persiste
  mimeType: z.string().optional(), // solo para previsualización en el form, no se persiste
  alt: z.string().optional(),
  sortOrder: z.coerce.number().default(0),
});

export const ProductFormSchema = z.object({
  slug: z.string().min(1, 'Slug requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  sku: z.string().optional(),
  brandId: z.string().min(1, 'Marca requerida'),
  collectionId: z.string().optional(),
  category: z.string().min(1, 'Categoría requerida'),
  productType: z.string().optional(),
  gender: z.string().min(1, 'Género requerido'),
  priceNormal: z.string().min(1, 'Precio requerido'),
  priceSale: z.string().optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  discountEnd: z.string().optional(),
  priceWholesale: z.string().optional(),
  priceWholesaleSale: z.string().optional(),
  wholesaleDiscountEnd: z.string().optional(),
  visibility: z.enum(['INDIVIDUAL', 'GROUPS', 'BOTH']).default('INDIVIDUAL'),
  isNew: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isActive: z.boolean().default(true),
  features: z.array(z.string()).default([]),
  careInstructions: z.array(z.string()).default([]),
  styles: z.array(z.string()).default([]),
  crossSellId: z.string().optional(),
  variants: z.array(VariantSchema).default([]),
  images: z.array(ImageSchema).default([]),
});

export type ProductFormData = z.infer<typeof ProductFormSchema>;

// ─── Types ───

export interface Brand {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Color {
  id: string;
  name: string;
  code: string;
  hex: string;
}

// ─── Constantes compartidas ───

export const CATEGORIES = ['Camisas', 'Pantalones', 'Chaquetas', 'Conjuntos', 'Accesorios', 'Batas'];
export const GENDERS = [
  { value: 'MUJER', label: 'Mujer' },
  { value: 'HOMBRE', label: 'Hombre' },
  { value: 'UNISEX', label: 'Unisex' },
];
export const SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', 'OS'];
export const FITS = ['Petite', 'Regular', 'Tall', 'Short'];
export const SELECT_EMPTY_VALUE = '__empty__';

export const VISIBILITY_OPTIONS = [
  { value: 'INDIVIDUAL', label: 'Solo Individual', description: 'Visible solo en el catálogo individual (/catalogo)' },
  { value: 'GROUPS', label: 'Solo Grupos', description: 'Solo disponible como pieza de sets corporativos, no aparece en /catalogo' },
  { value: 'BOTH', label: 'Ambos', description: 'Visible en el catálogo individual y disponible como pieza de sets' },
];

export const STATUSES = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'BACKORDER', label: 'Pedido especial' },
  { value: 'OUT_OF_STOCK', label: 'Agotado' },
];

import { z } from 'zod';

// ─── Schemas ───
// Extraído de ProductForm.tsx sin modificar reglas de validación: mismo
// esquema, misma fuente de verdad, reutilizado tanto por la vista desktop
// (Tabs) como por el wizard mobile.

export const VariantSchema = z.object({
  id: z.string().optional(),
  colorId: z.string().min(1, 'Color requerido'),
  size: z.string().min(1, 'Talla requerida'),
  // `fit` legacy retirado del form (Fase 4 remanente): el "Corte" se captura 100%
  // vía `attributeValueIds` (EAV), armado por `AttributeMatrixSection`.
  // Opcional (Fase 3.4): el estilo se identifica por `products.code`; el SKU de
  // variante puede completarse después, celda a celda, tras generar la matriz.
  // `.nullable()` porque la columna en DB acepta NULL y ese valor puede llegar
  // directo desde la API sin pasar por el fallback `|| ''` del formulario (ej. si
  // se guarda con `handleSubmit` antes de que `reset()` corra) — sin esto,
  // `z.string().optional()` rechaza `null` (solo acepta string | undefined) y
  // bloqueaba el guardado con "falta SKU" pese a que el campo ya no es editable.
  sku: z.string().nullable().optional(),
  status: z.enum(['AVAILABLE', 'BACKORDER', 'OUT_OF_STOCK']).default('AVAILABLE'),
  // Orden de despliegue del color de esta variante en el acordeón "Variantes y
  // Medios" (drag-to-reorder) — denormalizado, ver columna `colorSortOrder` en
  // `product_variants`.
  colorSortOrder: z.coerce.number().default(0),
  // Valores de atributos EAV aplicables a esta variante. Ya no se editan por
  // variante: se sincronizan desde `styleAttributes` (global al producto, ficha
  // General) al generar la matriz y al guardar (ver `ProductForm.tsx`).
  attributeValueIds: z.array(z.string()).default([]),
});

export const ImageSchema = z.object({
  id: z.string().optional(),
  assetId: z.string().min(1, 'Medio requerido'),
  colorId: z.string().min(1, 'Color requerido'),
  url: z.string().optional(), // solo para previsualización en el form, no se persiste
  storageKey: z.string().optional(), // solo para previsualización en el form, no se persiste
  mimeType: z.string().optional(), // solo para previsualización en el form, no se persiste
  alt: z.string().optional(),
  sortOrder: z.coerce.number().default(0),
});

// `assetId` queda opcional a nivel de schema base: en modo `coverSource:
// 'FIRST_VARIANT'` la portada no se sube (se hereda del primer color), así que
// el requisito real de "obligatoria" se aplica condicionalmente en el
// `superRefine` de `ProductFormSchema`, no aquí.
export const CoverSchema = z.object({
  id: z.string().optional(),
  assetId: z.string().optional(),
  url: z.string().optional(),
  storageKey: z.string().optional(),
  mimeType: z.string().optional(),
  alt: z.string().optional(),
});

// Imagen secundaria de Portada — habilita el crossfade "hover image swap" en la
// card del catálogo público. Requerida junto a la primaria SOLO en modo
// `coverSource: 'CUSTOM'` (ver `superRefine` de `ProductFormSchema`).
export const SecondaryCoverSchema = z.object({
  id: z.string().optional(),
  assetId: z.string().optional(),
  url: z.string().optional(),
  storageKey: z.string().optional(),
  mimeType: z.string().optional(),
  alt: z.string().optional(),
});

export const COVER_SOURCE_OPTIONS = [
  {
    value: 'CUSTOM' as const,
    label: 'Subir portadas especiales',
    description: 'Sube una imagen primaria y una secundaria específicas para este producto.',
  },
  {
    value: 'FIRST_VARIANT' as const,
    label: 'Usar portadas del primer color',
    description: 'La portada se hereda en vivo de las 2 primeras imágenes de la galería del primer color — si cambia el orden de colores o esas imágenes, la portada pública cambia con ellas.',
  },
];

export const ProductFormSchema = z.object({
  slug: z.string().min(1, 'Slug requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  sku: z.string().optional(),
  brandId: z.string().min(1, 'Marca requerida'),
  collectionId: z.string().optional(),
  // Código de estilo del fabricante (Fase 3.4) — núcleo obligatorio de la taxonomía
  // EAV (`products.code`, NOT NULL UNIQUE desde Fase 1). Verificado en vivo contra
  // `/api/admin/products/check-code` (ver `ProductForm.tsx`).
  code: z.string().min(1, 'Código de estilo requerido'),
  // FK a `productTypes` (Fase 3.2/3.4) — reemplaza al selector de `category`
  // hardcoded como fuente de verdad en el form. Requerido a nivel de form (aunque
  // `products.productTypeId` sea nullable en DB, ver comentario en el esquema):
  // sin un tipo de producto elegido no hay atributos EAV que ofrecer ni un valor
  // razonable que derivar para `category`/`productType` (ver `ProductForm.tsx`).
  productTypeId: z.string().min(1, 'Tipo de producto requerido'),
  // Atributos "Estilo" del Tipo de Producto (ej. Modelo de Terminado, Modelo de
  // Corte) — un solo valor por atributo, global al producto (mismo estilo para
  // todas sus variantes). Mapa `attributeId -> attributeValueId`. Se sincroniza a
  // `variants[].attributeValueIds` al guardar (ver `ProductForm.tsx`).
  styleAttributes: z.record(z.string(), z.string()).default({}),
  gender: z.string().min(1, 'Género requerido'),
  priceNormal: z.string().min(1, 'Precio requerido'),
  priceSale: z.string().optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  discountEnd: z.string().optional(),
  priceWholesale: z.string().optional(),
  priceWholesaleSale: z.string().optional(),
  wholesaleDiscountEnd: z.string().optional(),
  visibility: z.enum(['INDIVIDUAL', 'GROUPS', 'BOTH']).default('INDIVIDUAL'),
  coverSource: z.enum(['CUSTOM', 'FIRST_VARIANT']).default('CUSTOM'),
  isNew: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isActive: z.boolean().default(true),
  features: z.array(z.string()).default([]),
  careInstructions: z.array(z.string()).default([]),
  crossSellId: z.string().optional(),
  variants: z.array(VariantSchema).default([]),
  images: z.array(ImageSchema).default([]),
  cover: CoverSchema,
  secondaryCover: SecondaryCoverSchema,
}).superRefine((data, ctx) => {
  // La portada primaria/secundaria solo es obligatoria en modo 'CUSTOM' — en
  // 'FIRST_VARIANT' no se sube nada, se hereda del primer color (y esa condición
  // ya la cubre la regla de "≥2 imágenes por color con tallas" de más abajo).
  if (data.coverSource === 'CUSTOM') {
    if (!data.cover.assetId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Portada requerida', path: ['cover', 'assetId'] });
    }
    if (!data.secondaryCover.assetId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Portada secundaria requerida', path: ['secondaryCover', 'assetId'] });
    }
  }

  // Cada color con tallas definidas debe tener imagen PRINCIPAL Y SECUNDARIA en
  // su galería (≥2) — el catálogo público usa `images[0]`/`images[1]` (por
  // `sortOrder`) de cada color para el swatch y el crossfade "hover image swap",
  // así que un color con menos de 2 imágenes queda roto en el storefront. Un
  // solo issue agregado (no uno por color): el schema no tiene acceso a los
  // nombres de color (viven en la prop `colors` del componente), solo a los
  // `colorId`.
  const colorIdsWithVariants = new Set(data.variants.map((v) => v.colorId).filter(Boolean));
  const missing = Array.from(colorIdsWithVariants).some(
    (colorId) => data.images.filter((img) => img.colorId === colorId).length < 2
  );
  if (missing) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Todos los colores con tallas deben tener una imagen principal y una secundaria en su galería',
      path: ['images'],
    });
  }
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

// ─── Tipos EAV (Fase 3.4) ───

export interface CollectionOption {
  id: string;
  name: string;
  brandId: string;
  isActive: boolean | null;
}

export interface ProductTypeOption {
  id: string;
  name: string;
  brandId: string;
  isActive: boolean | null;
}

/** Atributo asociado a un tipo de producto (`GET /api/admin/product-types/[id]/attributes`). */
export interface ProductTypeAttributeLink {
  id: string;
  productTypeId: string;
  attributeId: string;
  isRequired: boolean | null;
  sortOrder: number | null;
  attributeName: string;
  attributeSlug: string;
  displayType: string;
}

/** Valor de atributo (`GET /api/admin/attributes/[id]/values`). */
export interface AttributeValueOption {
  id: string;
  attributeId: string;
  value: string;
  code: string | null;
  sortOrder: number | null;
  isActive: boolean | null;
}

// ─── Constantes compartidas ───

export const GENDERS = [
  { value: 'MUJER', label: 'Mujer' },
  { value: 'HOMBRE', label: 'Hombre' },
  { value: 'UNISEX', label: 'Unisex' },
];
export const SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', 'OS'];
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

/** Punto de color semántico por estado — usado por el "Smart Chip" de talla en
 * `VariantsMediaSection`. */
export const STATUS_META: Record<string, { dot: string; label: string }> = {
  AVAILABLE: { dot: 'bg-emerald-500', label: 'Disponible' },
  BACKORDER: { dot: 'bg-amber-500', label: 'Pedido especial' },
  OUT_OF_STOCK: { dot: 'bg-red-500', label: 'Agotado' },
};

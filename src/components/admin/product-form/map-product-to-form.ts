import type { ProductFormData } from './schema';

/** Shape devuelto por `getAdminProductById` (server) y, por extensión, por
 * `GET /api/admin/products/[id]` (mismo objeto serializado a JSON) — única
 * fuente de datos consumida tanto por la página standalone de edición
 * (`/admin/productos/[id]`, Server Component) como por el fetch+`reset()` que
 * corre dentro de `ProductForm` cuando se edita embebido (drawer de sets). */
export interface AdminProductDetail {
  slug: string;
  name: string;
  description: string | null;
  sku: string | null;
  code: string | null;
  brandId: string;
  collectionId: string | null;
  productTypeId: string | null;
  gender: string;
  priceNormal: string;
  priceSale: string | null;
  discountPct: number | null;
  discountEnd: string | Date | null;
  priceWholesale: string | null;
  priceWholesaleSale: string | null;
  wholesaleDiscountEnd: string | Date | null;
  visibility: string | null;
  coverSource: string | null;
  isNew: boolean | null;
  isBestSeller: boolean | null;
  isActive: boolean | null;
  features: unknown;
  careInstructions: unknown;
  crossSellId: string | null;
  variants: Array<{
    id: string;
    colorId: string;
    size: string;
    sku: string | null;
    status: string;
    attributeValueIds?: string[];
  }>;
  images: Array<{
    id: string;
    assetId: string;
    colorId: string | null;
    url: string;
    storageKey: string;
    mimeType: string;
    alt: string | null;
    sortOrder: number | null;
  }>;
  cover: {
    id?: string;
    assetId: string;
    url: string;
    storageKey: string;
    mimeType: string;
    alt: string | null;
  } | null;
  secondaryCover: {
    id?: string;
    assetId: string;
    url: string;
    storageKey: string;
    mimeType: string;
    alt: string | null;
  } | null;
}

const EMPTY_COVER = { assetId: '', url: '', storageKey: '', mimeType: '', alt: '' };

/**
 * Única función de mapeo `AdminProductDetail` → `ProductFormData` (parcial),
 * usada tanto por la página standalone de edición como por el fetch+`reset()`
 * de `ProductForm` en modo embebido — antes existían dos copias manuales de
 * esta transformación y un campo nuevo (`coverSource`, `secondaryCover`)
 * quedó afuera de una de las dos, causando que la ficha "olvidara" esos
 * valores guardados al reabrirla desde `/admin/productos/[id]`.
 */
export function mapProductDetailToFormData(product: AdminProductDetail): Partial<ProductFormData> {
  return {
    slug: product.slug,
    name: product.name,
    description: product.description || '',
    sku: product.sku || '',
    code: product.code || '',
    brandId: product.brandId,
    collectionId: product.collectionId || '',
    productTypeId: product.productTypeId || '',
    styleAttributes: {},
    gender: product.gender,
    priceNormal: product.priceNormal,
    priceSale: product.priceSale || '',
    discountPct: product.discountPct ?? undefined,
    discountEnd: product.discountEnd
      ? new Date(product.discountEnd).toISOString().slice(0, 16)
      : '',
    priceWholesale: product.priceWholesale || '',
    priceWholesaleSale: product.priceWholesaleSale || '',
    wholesaleDiscountEnd: product.wholesaleDiscountEnd
      ? new Date(product.wholesaleDiscountEnd).toISOString().slice(0, 16)
      : '',
    visibility: (product.visibility as 'INDIVIDUAL' | 'GROUPS' | 'BOTH') || 'INDIVIDUAL',
    coverSource: (product.coverSource as 'CUSTOM' | 'FIRST_VARIANT') || 'CUSTOM',
    isNew: product.isNew ?? false,
    isBestSeller: product.isBestSeller ?? false,
    isActive: product.isActive ?? true,
    features: (product.features as string[]) || [],
    careInstructions: (product.careInstructions as string[]) || [],
    crossSellId: product.crossSellId || '',
    variants: product.variants.map((v) => ({
      id: v.id,
      colorId: v.colorId,
      size: v.size,
      sku: v.sku || '',
      status: v.status as 'AVAILABLE' | 'BACKORDER' | 'OUT_OF_STOCK',
      attributeValueIds: v.attributeValueIds || [],
    })),
    images: product.images.map((i) => ({
      id: i.id,
      assetId: i.assetId,
      colorId: i.colorId || '',
      url: i.url,
      storageKey: i.storageKey,
      mimeType: i.mimeType,
      alt: i.alt || '',
      sortOrder: i.sortOrder ?? 0,
    })),
    cover: product.cover
      ? {
          id: product.cover.id,
          assetId: product.cover.assetId,
          url: product.cover.url,
          storageKey: product.cover.storageKey,
          mimeType: product.cover.mimeType,
          alt: product.cover.alt || '',
        }
      : EMPTY_COVER,
    secondaryCover: product.secondaryCover
      ? {
          id: product.secondaryCover.id,
          assetId: product.secondaryCover.assetId,
          url: product.secondaryCover.url,
          storageKey: product.secondaryCover.storageKey,
          mimeType: product.secondaryCover.mimeType,
          alt: product.secondaryCover.alt || '',
        }
      : EMPTY_COVER,
  };
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { getAdminProductById, updateProductWithRelations, softDeleteProduct, recordProductMediaDismissals } from '@/lib/admin-data-service';
import { z } from 'zod';

const VariantSchema = z.object({
  id: z.string().optional(),
  colorId: z.string().min(1),
  size: z.string().min(1),
  // `fit` legacy retirado (Fase 4 remanente): el "Corte" se captura vía `attributeValueIds` (EAV).
  // Opcional (Fase 3.4, ver comentario equivalente en `products/route.ts`).
  sku: z.string().optional(),
  status: z.enum(['AVAILABLE', 'BACKORDER', 'OUT_OF_STOCK']).default('AVAILABLE'),
  colorSortOrder: z.coerce.number().default(0),
  attributeValueIds: z.array(z.string()).default([]),
});

const ImageSchema = z.object({
  id: z.string().optional(),
  assetId: z.string().min(1),
  colorId: z.string().min(1),
  alt: z.string().optional(),
  sortOrder: z.number().default(0),
});

const UpdateProductSchema = z.object({
  slug: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sku: z.string().optional(),
  brandId: z.string().min(1).optional(),
  collectionId: z.string().optional(),
  productTypeId: z.string().optional(),
  // `.trim()` — ver comentario equivalente en `products/route.ts` (evita que un espacio
  // colado persista como parte del código y rompa la comparación exacta de unicidad).
  code: z.string().trim().min(1).optional(),
  gender: z.string().min(1).optional(),
  priceNormal: z.string().min(1).optional(),
  priceSale: z.string().optional(),
  discountPct: z.number().optional(),
  discountEnd: z.string().optional().nullable(),
  priceWholesale: z.string().optional().nullable(),
  priceWholesaleSale: z.string().optional().nullable(),
  wholesaleDiscountEnd: z.string().optional().nullable(),
  visibility: z.enum(['INDIVIDUAL', 'GROUPS', 'BOTH']).optional(),
  coverSource: z.enum(['CUSTOM', 'FIRST_VARIANT']).optional(),
  isNew: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isActive: z.boolean().optional(),
  features: z.array(z.string()).optional(),
  careInstructions: z.array(z.string()).optional(),
  crossSellId: z.string().optional().nullable(),
  variants: z.array(VariantSchema).optional(),
  images: z.array(ImageSchema).optional(),
  // `assetId` opcional: en modo `coverSource: 'FIRST_VARIANT'` no se sube portada
  // (ver comentario equivalente en `products/route.ts`).
  cover: z.object({
    assetId: z.string().optional(),
    alt: z.string().optional(),
  }).optional(),
  secondaryCover: z.object({
    assetId: z.string().optional(),
    alt: z.string().optional(),
  }).optional(),
  // Sugerencias de precarga (assets sin vincular detectados por carpeta, ver
  // `/api/admin/media/unlinked-by-color`) que el admin quitó de la galería antes de guardar —
  // se registran para no volver a ofrecerlas (ver `recordProductMediaDismissals`). No forma
  // parte del modelo de datos del producto, es metadata de UX de esta sesión de guardado.
  dismissedSuggestedAssets: z.array(z.object({
    assetId: z.string(),
    colorId: z.string().nullable(),
  })).optional(),
});


export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const product = await getAdminProductById(id);
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(product);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'productos', 'write');
    const { id } = await params;
    const body = await request.json();
    const { dismissedSuggestedAssets, ...validated } = UpdateProductSchema.parse(body);
    const product = await updateProductWithRelations(id, validated, getSessionUserId(session));
    if (dismissedSuggestedAssets && dismissedSuggestedAssets.length > 0) {
      await recordProductMediaDismissals(id, dismissedSuggestedAssets);
    }
    return NextResponse.json(product);
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'productos', 'write');
    const { id } = await params;
    await softDeleteProduct(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const error = err as Error & { usage?: { count: number; setNames: string[] } };
    if (error.usage) {
      return NextResponse.json({ error: 'Producto en uso', usage: error.usage }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

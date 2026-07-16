import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminProductById, updateProductWithRelations, deleteProduct } from '@/lib/admin-data-service';
import { z } from 'zod';

const VariantSchema = z.object({
  id: z.string().optional(),
  colorId: z.string().min(1),
  size: z.string().min(1),
  // `fit` legacy retirado (Fase 4 remanente): el "Corte" se captura vía `attributeValueIds` (EAV).
  // Opcional (Fase 3.4, ver comentario equivalente en `products/route.ts`).
  sku: z.string().optional(),
  status: z.enum(['AVAILABLE', 'BACKORDER', 'OUT_OF_STOCK']).default('AVAILABLE'),
  stock: z.number().default(0),
  minStock: z.number().default(5),
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
  gender: z.string().min(1).optional(),
  priceNormal: z.string().min(1).optional(),
  priceSale: z.string().optional(),
  discountPct: z.number().optional(),
  discountEnd: z.string().optional().nullable(),
  priceWholesale: z.string().optional().nullable(),
  priceWholesaleSale: z.string().optional().nullable(),
  wholesaleDiscountEnd: z.string().optional().nullable(),
  visibility: z.enum(['INDIVIDUAL', 'GROUPS', 'BOTH']).optional(),
  isNew: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isActive: z.boolean().optional(),
  features: z.array(z.string()).optional(),
  careInstructions: z.array(z.string()).optional(),
  crossSellId: z.string().optional().nullable(),
  variants: z.array(VariantSchema).optional(),
  images: z.array(ImageSchema).optional(),
  cover: z.object({
    assetId: z.string().min(1),
    alt: z.string().optional(),
  }).optional(),
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
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const validated = UpdateProductSchema.parse(body);
    const product = await updateProductWithRelations(id, validated);
    return NextResponse.json(product);
  } catch (err) {
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
    await requireAdmin();
    const { id } = await params;
    await deleteProduct(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

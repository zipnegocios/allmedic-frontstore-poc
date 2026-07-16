import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminProducts, createProductWithRelations } from '@/lib/admin-data-service';
import { z } from 'zod';

const VariantSchema = z.object({
  colorId: z.string().min(1),
  size: z.string().min(1),
  // `fit` legacy retirado (Fase 4 remanente): el "Corte" se captura vía `attributeValueIds` (EAV).
  // Opcional (Fase 3.4, ver `productVariants.sku` en el esquema): el estilo se
  // identifica por `products.code`, el SKU de fabricante por variante puede no
  // existir aún al generar la matriz desde el admin.
  sku: z.string().optional(),
  status: z.enum(['AVAILABLE', 'BACKORDER', 'OUT_OF_STOCK']).default('AVAILABLE'),
  stock: z.number().default(0),
  minStock: z.number().default(5),
  attributeValueIds: z.array(z.string()).default([]),
});

const ImageSchema = z.object({
  assetId: z.string().min(1),
  colorId: z.string().min(1),
  alt: z.string().optional(),
  sortOrder: z.number().default(0),
});

const CreateProductSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  sku: z.string().optional(),
  // Código de estilo del fabricante — obligatorio en products.code (ver Fase 1 de
  // la migración de taxonomía). El formulario de admin aún no expone este campo
  // (llega en la Fase 3); hasta entonces, esta ruta responde 400 en vez de dejar
  // que Postgres rechace el INSERT con un error opaco de NOT NULL.
  code: z.string().min(1),
  brandId: z.string().min(1),
  collectionId: z.string().optional(),
  productTypeId: z.string().optional(),
  gender: z.string().min(1),
  priceNormal: z.string().min(1),
  priceSale: z.string().optional(),
  discountPct: z.number().optional(),
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
  crossSellId: z.string().optional(),
  variants: z.array(VariantSchema).default([]),
  images: z.array(ImageSchema).default([]),
  cover: z.object({
    assetId: z.string().min(1),
    alt: z.string().optional(),
  }),
});


export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const result = await getAdminProducts({
      search: searchParams.get('search') || undefined,
      brandId: searchParams.get('brandId') || undefined,
      productTypeId: searchParams.get('productTypeId') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const validated = CreateProductSchema.parse(body);
    const product = await createProductWithRelations(validated);
    return NextResponse.json(product, { status: 201 });
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

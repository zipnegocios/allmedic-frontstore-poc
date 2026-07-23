import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminSetById, updateSetWithItems, softDeleteSet } from '@/lib/admin-data-service';
import { findDuplicateSetProductIds } from '@/lib/set-validation';
import { z } from 'zod';

const SetBlockOptionSchema = z.object({
  productId: z.string().min(1),
});

const SetBlockSchema = z.object({
  blockCode: z.enum(['A', 'B']),
  quantityPerSet: z.number().min(1).default(1),
  options: z.tuple([SetBlockOptionSchema, SetBlockOptionSchema]),
});

const SetRecommendedItemSchema = z.object({
  productId: z.string().min(1),
  sortOrder: z.number().default(0),
});

const UpdateSetSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  coverAssetId: z.string().optional(),
  coverAlt: z.string().optional(),
  secondaryCoverAssetId: z.string().optional(),
  secondaryCoverAlt: z.string().optional(),
  colorMode: z.enum(['PAIRED', 'MIXED']).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().optional(),
  priceManual: z.string().optional().nullable(),
  priceManualSale: z.string().optional().nullable(),
  manualDiscountEnd: z.string().optional().nullable(),
  blocks: z.tuple([SetBlockSchema, SetBlockSchema]).optional(),
  recommendedItems: z.array(SetRecommendedItemSchema).optional(),
}).refine(
  (data) => !data.priceManualSale || !data.priceManual || Number(data.priceManualSale) < Number(data.priceManual),
  { message: 'El precio manual rebajado debe ser menor al precio manual', path: ['priceManualSale'] }
).refine(
  (data) => !data.manualDiscountEnd || !!data.priceManualSale,
  { message: 'La fecha de fin de rebaja requiere un precio manual rebajado', path: ['manualDiscountEnd'] }
).superRefine((data, ctx) => {
  if (!data.blocks) return;
  const duplicates = findDuplicateSetProductIds(data.blocks, data.recommendedItems ?? []);
  if (duplicates.length > 0) {
    ctx.addIssue({ code: 'custom', message: 'Un mismo producto no puede repetirse entre bloques ni piezas recomendadas', path: ['blocks'] });
  }
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const set = await getAdminSetById(id);
    if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(set);
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
    const validated = UpdateSetSchema.parse(body);
    const set = await updateSetWithItems(id, validated);
    return NextResponse.json(set);
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
    await softDeleteSet(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

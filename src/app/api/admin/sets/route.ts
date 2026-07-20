import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminSets, createSetWithItems } from '@/lib/admin-data-service';
import { findDuplicateSetItemIndexes } from '@/lib/set-validation';
import { z } from 'zod';

const SetItemSchema = z.object({
  productId: z.string().min(1),
  quantityPerSet: z.number().min(1).default(1),
  sortOrder: z.number().default(0),
});

const CreateSetSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  coverAssetId: z.string().min(1, 'La portada primaria es obligatoria'),
  coverAlt: z.string().optional(),
  secondaryCoverAssetId: z.string().min(1, 'La portada secundaria es obligatoria'),
  secondaryCoverAlt: z.string().optional(),
  colorMode: z.enum(['PAIRED', 'MIXED'], { message: 'Elige un modo de color para el set' }),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().default(0),
  priceManual: z.string().optional().nullable(),
  priceManualSale: z.string().optional().nullable(),
  manualDiscountEnd: z.string().optional().nullable(),
  items: z.array(SetItemSchema).default([]),
}).refine(
  (data) => !data.priceManualSale || !data.priceManual || Number(data.priceManualSale) < Number(data.priceManual),
  { message: 'El precio manual rebajado debe ser menor al precio manual', path: ['priceManualSale'] }
).refine(
  (data) => !data.manualDiscountEnd || !!data.priceManualSale,
  { message: 'La fecha de fin de rebaja requiere un precio manual rebajado', path: ['manualDiscountEnd'] }
).superRefine((data, ctx) => {
  for (const idx of findDuplicateSetItemIndexes(data.items)) {
    ctx.addIssue({ code: 'custom', message: 'Este producto ya está en el set', path: ['items', idx, 'productId'] });
  }
});

export async function GET() {
  try {
    await requireAdmin();
    const sets = await getAdminSets();
    return NextResponse.json({ sets });
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
    const validated = CreateSetSchema.parse(body);
    const set = await createSetWithItems(validated);
    return NextResponse.json(set, { status: 201 });
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

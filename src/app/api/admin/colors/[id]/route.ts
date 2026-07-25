import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { updateColor, deleteColor } from '@/lib/admin-data-service';
import { z } from 'zod';

const UpdateColorSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  hex: z.string().min(1).optional(),
  kind: z.enum(['SOLID', 'PATTERN']).optional(),
  // string = reemplazar swatch; null = quitarlo; undefined (ausente) = no tocar.
  swatchAssetId: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { swatchAssetId, ...validated } = UpdateColorSchema.parse(body);
    const color = await updateColor(id, validated, swatchAssetId);
    return NextResponse.json(color);
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
    await deleteColor(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const error = err as Error & { productCount?: number };
    if (error.productCount) {
      return NextResponse.json({ error: 'Color en uso', productCount: error.productCount }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

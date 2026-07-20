import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminSetById, updateSetColorCombo, deleteSetColorCombo } from '@/lib/admin-data-service';

const ComboItemSchema = z.object({
  productId: z.string().min(1),
  colorCode: z.string().min(1),
});

const UpdateComboSchema = z.object({
  items: z.array(ComboItemSchema).min(1).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; comboId: string }> }
) {
  try {
    await requireAdmin();
    const { id, comboId } = await params;
    const body = UpdateComboSchema.parse(await request.json());

    if (body.items !== undefined) {
      const set = await getAdminSetById(id);
      if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const piecesIds = set.items.map((i) => i.productId).filter((pid): pid is string => !!pid);
      const bodyProductIds = body.items.map((i) => i.productId);
      if (bodyProductIds.length !== piecesIds.length) {
        return NextResponse.json(
          { error: `La combinación debe tener exactamente una entrada por cada pieza del set (${piecesIds.length}).` },
          { status: 400 }
        );
      }
      if (new Set(bodyProductIds).size !== bodyProductIds.length) {
        return NextResponse.json({ error: 'No se puede repetir la misma pieza en una combinación.' }, { status: 400 });
      }
      if (bodyProductIds.some((pid) => !piecesIds.includes(pid))) {
        return NextResponse.json({ error: 'La combinación incluye una pieza que no pertenece a este set.' }, { status: 400 });
      }
    }

    const combo = await updateSetColorCombo(comboId, body);
    return NextResponse.json(combo);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; comboId: string }> }
) {
  try {
    await requireAdmin();
    const { comboId } = await params;
    await deleteSetColorCombo(comboId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

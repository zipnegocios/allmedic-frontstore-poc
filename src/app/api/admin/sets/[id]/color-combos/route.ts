import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminSetById, getSetColorCombos, createSetColorCombo } from '@/lib/admin-data-service';

const ComboItemSchema = z.object({
  productId: z.string().min(1),
  colorCode: z.string().min(1),
});

const CreateComboSchema = z.object({
  items: z.array(ComboItemSchema).min(1),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

/**
 * GET /api/admin/sets/[id]/color-combos
 * Combinaciones de color curadas por el admin (modo MIXED) — reemplazan la selección libre
 * de color por pieza que hoy hace el comprador en el armador del catálogo corporativo.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const combos = await getSetColorCombos(id);
    return NextResponse.json({ combos });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = CreateComboSchema.parse(await request.json());

    const set = await getAdminSetById(id);
    if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Piezas válidas para una combinación de color = las 4 opciones de bloque (2 bloques × 2
    // opciones). Las piezas recomendadas quedan fuera — no participan de COLOR_PAIRING/combos.
    const piecesIds = set.blocks.flatMap((b) => b.options.map((o) => o.productId)).filter((pid): pid is string => !!pid);
    const bodyProductIds = body.items.map((i) => i.productId);

    if (bodyProductIds.length !== piecesIds.length) {
      return NextResponse.json(
        { error: `La combinación debe tener exactamente una entrada por cada opción de bloque del set (${piecesIds.length}).` },
        { status: 400 }
      );
    }
    const duplicates = new Set(bodyProductIds).size !== bodyProductIds.length;
    if (duplicates) {
      return NextResponse.json({ error: 'No se puede repetir la misma pieza en una combinación.' }, { status: 400 });
    }
    const outsideSet = bodyProductIds.some((pid) => !piecesIds.includes(pid));
    if (outsideSet) {
      return NextResponse.json({ error: 'La combinación incluye una pieza que no pertenece a este set.' }, { status: 400 });
    }

    const combo = await createSetColorCombo(id, body);
    return NextResponse.json(combo, { status: 201 });
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

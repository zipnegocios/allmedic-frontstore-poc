import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getProductColorsLite } from '@/lib/admin-data-service';

/**
 * GET /api/admin/products/[id]/colors
 * Colores con variantes activas de un producto puntual (id/nombre) — usado por el picker de
 * medios (modo "Insertar desde otra ubicación") para poblar el segundo dropdown recién cuando
 * se elige un producto en el primero.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const colors = await getProductColorsLite(id);
    return NextResponse.json({ colors });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

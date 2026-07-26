import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { applyManualAdjustment } from '@/lib/productivity-rates';

const AdjustmentSchema = z.object({
  userId: z.string().min(1),
  adjustment: z.number(),
  reason: z.string().min(1, 'El motivo del ajuste es obligatorio'),
});

/** Ajuste manual (suma/resta con motivo obligatorio) sobre el ítem de un usuario en un
 * período — decisión 8 del plan. Bloqueado en períodos PAID (inmutables por diseño). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'pagos', 'write');

    const { id } = await params;
    const body = AdjustmentSchema.parse(await request.json());
    await applyManualAdjustment(id, body.userId, body.adjustment, body.reason);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

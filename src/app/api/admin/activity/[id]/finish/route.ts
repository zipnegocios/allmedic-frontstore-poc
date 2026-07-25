import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { finishActivity } from '@/lib/activity-tracking';

const FinishActivitySchema = z.object({
  entityId: z.string().optional().nullable(),
});

/** Fase 7 del plan RBAC: evento de "fin" del hook `useActivityTracking`, disparado al
 * guardar exitosamente (nunca inferido — decisión 6 del plan). `entityId` opcional cubre
 * el caso de creación: al abrir el formulario todavía no existe el id real, así que se
 * completa recién aquí, con el id que devolvió el guardado. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const userId = (session.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = FinishActivitySchema.parse(await request.json().catch(() => ({})));
    const result = await finishActivity(id, userId, body.entityId);
    if (!result) return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 });
    return NextResponse.json({ ok: true });
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

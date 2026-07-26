import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { incrementActivityMediaCount } from '@/lib/activity-tracking';

/** Incrementa el conteo de medios de una sesión de actividad activa (Fase 5 del plan
 * tareas/comentarios/pagos) — llamado por el formulario de producto/set cada vez que se
 * sube/vincula un medio sin cerrar el formulario. */
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const userId = (session.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const result = await incrementActivityMediaCount(id, userId);
    if (!result) return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

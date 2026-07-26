import { NextResponse } from 'next/server';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { getTaskById } from '@/lib/task-service';

/** Detalle de una tarea — el Gestor solo puede ver la suya, Admin ve cualquiera. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'tareas', 'read');

    const { id } = await params;
    const task = await getTaskById(id);
    if (!task) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });

    const role = (session.user as { role?: string })?.role;
    const userId = getSessionUserId(session);
    if (role !== 'ADMIN' && task.assignedTo !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ task });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

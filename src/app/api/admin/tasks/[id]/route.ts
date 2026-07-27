import { NextResponse } from 'next/server';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { getTaskById, getTaskDetail, deleteTask, ForbiddenReviewError } from '@/lib/task-service';

/** Detalle de una tarea — el Gestor solo puede ver la suya, Admin ve cualquiera. Incluye
 * `assignedByName`/`canReview` (`<TaskDetailModal />`, plan 2026-07-27). */
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

    const detail = await getTaskDetail(id, userId!);
    return NextResponse.json({ task: detail });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Elimina una tarea (2026-07-27, feedback de Gustavo) — solo Admin o Coordinador, mismo
 * criterio `canReviewTask` que aprobar/rechazar. Requiere `tareas:write` (asignar/gestionar
 * tareas ya es exclusivo de quien tiene ese permiso — ver `route.ts` del listado). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'tareas', 'write');

    const userId = getSessionUserId(session);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await deleteTask(id, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ForbiddenReviewError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Tarea no encontrada.') return NextResponse.json({ error: message }, { status: 404 });
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

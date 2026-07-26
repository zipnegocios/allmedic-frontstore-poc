import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { getTaskById, advanceTaskStatus, InvalidTaskTransitionError } from '@/lib/task-service';

const AdvanceSchema = z.object({
  toStatus: z.enum(['IN_PROGRESS', 'COMPLETED']),
  // Anclaje de tareas (2026-07-26): id del producto/set recién creado/editado desde el
  // formulario correspondiente, cuando la tarea/subtarea estaba anclada ahí.
  targetEntityId: z.string().optional().nullable(),
});

/**
 * Avance del propio Gestor sobre su tarea asignada: PENDING→IN_PROGRESS,
 * IN_PROGRESS→COMPLETED. Guard por ownership (no por permiso `write` de módulo — asignar
 * tareas es exclusivo de Admin, pero trabajar la propia tarea no lo es).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'tareas', 'read');

    const userId = getSessionUserId(session);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const task = await getTaskById(id);
    if (!task) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });

    const role = (session.user as { role?: string })?.role;
    if (role !== 'ADMIN' && task.assignedTo !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = AdvanceSchema.parse(await request.json());
    const updated = await advanceTaskStatus(id, body.toStatus, body.targetEntityId);
    return NextResponse.json({ task: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    if (err instanceof InvalidTaskTransitionError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { approveTask, rejectTask, InvalidTaskTransitionError, ForbiddenReviewError } from '@/lib/task-service';

const ReviewSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('APPROVE') }),
  z.object({ decision: z.literal('REJECT'), reason: z.string().min(1, 'El motivo de rechazo es obligatorio') }),
]);

/** Revisión sobre una tarea COMPLETED — aprobar o rechazar con motivo obligatorio (decisión 3
 * del plan). `requireRole('tareas','write')` ya filtra "¿puede escribir en el módulo?" (Admin o
 * Coordinador); `approveTask`/`rejectTask` aplican además la regla fina de autorización según
 * quién asignó la tarea (decisión 4 del plan 2026-07-27, `canReviewTask`) — enforcement en
 * servicio, no solo en la matriz de permisos de módulo. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'tareas', 'write');

    const reviewerId = getSessionUserId(session);
    if (!reviewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = ReviewSchema.parse(await request.json());

    if (body.decision === 'APPROVE') {
      const task = await approveTask(id, reviewerId);
      return NextResponse.json({ task });
    }

    const task = await rejectTask(id, body.reason, reviewerId);
    return NextResponse.json({ task });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    if (err instanceof InvalidTaskTransitionError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof ForbiddenReviewError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

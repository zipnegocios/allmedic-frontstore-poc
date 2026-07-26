import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { getTaskGroupById, updateTaskGroup } from '@/lib/task-group-service';
import { listTasks } from '@/lib/task-service';

/** Detalle del grupo + sus tareas — usado por la vista de detalle en `/admin/tareas`. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'tareas', 'read');

    const { id } = await params;
    const group = await getTaskGroupById(id);
    if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });

    const tasks = await listTasks({ groupId: id });
    return NextResponse.json({ group, tasks });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const UpdateTaskGroupSchema = z.object({
  name: z.string().min(1).optional(),
  dueDate: z.string().optional().nullable(),
  hasPayment: z.boolean().optional(),
  paymentAmount: z.string().optional().nullable(),
}).refine((data) => data.hasPayment !== true || !!data.paymentAmount, {
  message: 'El monto es obligatorio cuando el grupo tiene pago asignado.',
  path: ['paymentAmount'],
});

/** Los grupos son siempre editables (decisión del usuario), incluso después de completarse —
 * no hay restricción de inmutabilidad aquí. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'tareas', 'write');

    const { id } = await params;
    const body = UpdateTaskGroupSchema.parse(await request.json());
    const updated = await updateTaskGroup(id, {
      name: body.name,
      dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
      hasPayment: body.hasPayment,
      paymentAmount: body.paymentAmount,
    });
    if (!updated) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    return NextResponse.json({ group: updated });
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

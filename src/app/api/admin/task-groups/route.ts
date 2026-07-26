import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { createTaskGroup, listTaskGroups } from '@/lib/task-group-service';

export async function GET() {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'tareas', 'read');
    const groups = await listTaskGroups();
    return NextResponse.json({ groups });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const CreateTaskGroupSchema = z.object({
  name: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  hasPayment: z.boolean(),
  paymentAmount: z.string().optional().nullable(),
}).refine((data) => !data.hasPayment || !!data.paymentAmount, {
  message: 'El monto es obligatorio cuando el grupo tiene pago asignado.',
  path: ['paymentAmount'],
});

/** Crea un grupo de tareas con plazo opcional (`dueDate`) y pago opcional (`hasPayment` +
 * `paymentAmount`) — Admin o Coordinador (mismo permiso `tareas:write` que crear tareas
 * individuales). */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'tareas', 'write');

    const createdBy = getSessionUserId(session);
    if (!createdBy) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = CreateTaskGroupSchema.parse(await request.json());
    const group = await createTaskGroup({
      name: body.name,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      hasPayment: body.hasPayment,
      paymentAmount: body.paymentAmount,
      createdBy,
    });
    return NextResponse.json({ group }, { status: 201 });
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

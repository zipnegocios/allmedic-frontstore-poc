import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { createTask, listTasks, TaskGroupAssigneeMismatchError, TaskGroupCompletedError } from '@/lib/task-service';

/** Fase 3 del plan tareas/comentarios/pagos. Admin lista/crea; el Gestor solo lista las
 * suyas (filtrado por `assignedTo` propio si no tiene permiso de escritura). */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'tareas', 'read');

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;
    const assignedToParam = searchParams.get('assignedTo') ?? undefined;
    const type = searchParams.get('type') ?? undefined;

    const role = (session.user as { role?: string })?.role;
    const userId = getSessionUserId(session);
    // Un Gestor (sin permiso de escritura sobre tareas) solo puede ver las suyas, sin
    // importar qué `assignedTo` intente pasar en la query string.
    const canManageAll = role === 'ADMIN';
    const assignedTo = canManageAll ? assignedToParam : userId;

    const tasks = await listTasks({
      status: status as never,
      assignedTo,
      type: type as never,
    });
    return NextResponse.json({ tasks });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const BlockSchema = z.object({ code: z.string(), url: z.string() });

const CreateTaskSchema = z.object({
  type: z.enum(['CREATE_PRODUCT', 'CREATE_SET', 'UPLOAD_MEDIA', 'EDIT_PRODUCT', 'EDIT_SET', 'GENERIC']),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  targetCode: z.string().optional().nullable(),
  targetEntityType: z.enum(['PRODUCT', 'SET']).optional().nullable(),
  targetEntityId: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  sourceUrl: z.string().optional().nullable(),
  blockA: BlockSchema.optional().nullable(),
  blockB: BlockSchema.optional().nullable(),
  groupId: z.string().optional().nullable(),
  assignedTo: z.string().min(1),
});

/** Solo Admin asigna tareas (decisión de alcance: gestión de tareas es exclusiva de Admin). */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'tareas', 'write');

    const assignedBy = getSessionUserId(session);
    if (!assignedBy) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = CreateTaskSchema.parse(await request.json());
    const task = await createTask({ ...body, assignedBy });
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    if (err instanceof TaskGroupAssigneeMismatchError || err instanceof TaskGroupCompletedError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { getTaskById } from '@/lib/task-service';
import { listTaskComments, createTaskComment } from '@/lib/comment-service';

async function assertCanAccessTask(session: Awaited<ReturnType<typeof requireAdmin>>, taskId: string) {
  const task = await getTaskById(taskId);
  if (!task) return null;
  const role = (session.user as { role?: string })?.role;
  const userId = getSessionUserId(session);
  if (role !== 'ADMIN' && task.assignedTo !== userId) return undefined;
  return task;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'comentarios', 'read');

    const { id } = await params;
    const task = await assertCanAccessTask(session, id);
    if (task === null) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    if (task === undefined) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const comments = await listTaskComments(id);
    return NextResponse.json({ comments });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const CreateCommentSchema = z.object({
  body: z.string().min(1),
  mentionedUserIds: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'comentarios', 'write');

    const { id } = await params;
    const task = await assertCanAccessTask(session, id);
    if (task === null) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    if (task === undefined) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const authorId = getSessionUserId(session);
    if (!authorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = CreateCommentSchema.parse(await request.json());
    const comment = await createTaskComment(id, authorId, body.body, body.mentionedUserIds ?? []);
    return NextResponse.json({ comment }, { status: 201 });
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

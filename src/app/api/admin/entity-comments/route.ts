import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { listEntityComments, createEntityComment } from '@/lib/comment-service';

const ENTITY_TYPES = ['PRODUCT', 'VARIANT', 'SET', 'MEDIA'] as const;

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'comentarios', 'read');

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    if (!entityType || !ENTITY_TYPES.includes(entityType as typeof ENTITY_TYPES[number]) || !entityId) {
      return NextResponse.json({ error: 'entityType y entityId son obligatorios' }, { status: 400 });
    }

    const comments = await listEntityComments(entityType as typeof ENTITY_TYPES[number], entityId);
    return NextResponse.json({ comments });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const CreateEntityCommentSchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().min(1),
  body: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'comentarios', 'write');

    const authorId = getSessionUserId(session);
    if (!authorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = CreateEntityCommentSchema.parse(await request.json());
    const comment = await createEntityComment(body.entityType, body.entityId, authorId, body.body);
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

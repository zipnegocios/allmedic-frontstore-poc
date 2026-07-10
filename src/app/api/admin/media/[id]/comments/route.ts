import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { addMediaComment } from '@/lib/media-data-service';
import { z } from 'zod';

const CommentSchema = z.object({
  body: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const { body } = CommentSchema.parse(await request.json());

    const comment = await addMediaComment(id, body, getSessionUserId(session));
    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

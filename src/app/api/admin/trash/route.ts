import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getTrashedItems, restoreItem, permanentlyDeleteItem } from '@/lib/trashable-entities';
import { z } from 'zod';

const TrashActionSchema = z.object({
  action: z.enum(['restore', 'delete']),
  entityType: z.enum(['SET', 'QUOTE']),
  entityId: z.string().min(1),
});

export async function GET() {
  try {
    await requireAdmin();
    const items = await getTrashedItems();
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const validated = TrashActionSchema.parse(body);

    if (validated.action === 'restore') {
      await restoreItem(validated.entityType, validated.entityId);
    } else {
      await permanentlyDeleteItem(validated.entityType, validated.entityId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

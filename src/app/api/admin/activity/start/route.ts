import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { startActivity } from '@/lib/activity-tracking';

const StartActivitySchema = z.object({
  entityType: z.enum(['PRODUCT', 'VARIANT', 'SET', 'MEDIA']),
  action: z.enum(['CREATE', 'UPDATE']),
  entityId: z.string().optional().nullable(),
});

/** Fase 7 del plan RBAC: evento de "inicio" del hook `useActivityTracking`, disparado al
 * abrir el formulario de producto/variante/set/medio (antes de que exista un guardado). */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const userId = (session.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = StartActivitySchema.parse(await request.json());
    const activityId = await startActivity(userId, body.entityType, body.action, body.entityId);
    return NextResponse.json({ activityId }, { status: 201 });
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

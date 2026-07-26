import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { listWebhookEvents } from '@/lib/email/log-service';

/** Bandeja de "entrada / eventos" — log crudo de webhooks de Resend (`/admin/correos`). */
export async function GET() {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'correos', 'read');
    const events = await listWebhookEvents();
    return NextResponse.json({ events });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

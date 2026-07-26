import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { listEventSettings } from '@/lib/email/event-settings';

/** Lista los eventos de correo controlables desde el panel `/admin/configuracion` → "Correos". */
export async function GET() {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'configuracion', 'read');
    const events = await listEventSettings();
    return NextResponse.json({ events });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

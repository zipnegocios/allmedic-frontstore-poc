import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { listEmailLog } from '@/lib/email/log-service';

/** Bandeja de "salida" — historial de envíos reales (`/admin/correos`). */
export async function GET() {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'correos', 'read');
    const log = await listEmailLog();
    return NextResponse.json({ log });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

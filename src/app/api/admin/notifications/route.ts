import { NextResponse } from 'next/server';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { listNotifications } from '@/lib/notification-service';

/** Listado de notificaciones del propio usuario — sin guard de permiso de módulo, cualquier
 * usuario autenticado puede ver sus propias notificaciones (igual criterio que
 * `/api/admin/my-permissions`, no exige un permiso previo para consultar lo propio). */
export async function GET() {
  try {
    const session = await requireAdmin();
    const userId = getSessionUserId(session);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const notifications = await listNotifications(userId);
    return NextResponse.json({ notifications });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

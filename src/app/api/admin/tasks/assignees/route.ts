import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';

/** Listado liviano de Gestores del Catálogo activos — solo para poblar el selector
 * "asignar a" del formulario de tareas, sin exponer el resto de datos de `/api/admin/users`. */
export async function GET() {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'tareas', 'write');

    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.role, 'CATALOG_MANAGER'), eq(users.isActive, true)))
      .orderBy(asc(users.name));

    return NextResponse.json({ assignees: rows });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

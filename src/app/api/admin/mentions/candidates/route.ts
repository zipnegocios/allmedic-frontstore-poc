import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { db } from '@/db';
import { users } from '@/db/schema';
import { and, eq, inArray, asc } from 'drizzle-orm';

/** Listado liviano de Admin + Gestores del Catálogo activos — usado por el autocompletado
 * de menciones (@nombre) en `CommentThread.tsx`. Protegido por `comentarios:read` (no
 * `tareas:write`, ya que se consume desde cualquier hilo de comentarios, no solo tareas). */
export async function GET() {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'comentarios', 'read');

    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(and(inArray(users.role, ['ADMIN', 'CATALOG_MANAGER']), eq(users.isActive, true)))
      .orderBy(asc(users.name));

    return NextResponse.json({ candidates: rows });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

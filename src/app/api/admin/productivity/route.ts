import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { getProductivityStatsForUser, getProductivityStatsForAllCatalogManagers, setProductivityTarget, type ProductivityPeriod } from '@/lib/productivity-service';

/**
 * Fase 8 del plan RBAC. Acceso: el propio Gestor del Catálogo ve solo sus datos; Admin ve
 * el listado de todos los Gestores (decisión de la Fase 8, distinta del permiso de módulo
 * `productividad:read` — un Gestor nunca ve los datos de otro, aunque tuviera ese permiso).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'productividad', 'read');

    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period');
    const period: ProductivityPeriod = periodParam === 'week' || periodParam === 'month' ? periodParam : 'day';

    const role = (session.user as { role?: string })?.role;
    const userId = (session.user as { id?: string })?.id;

    if (role === 'ADMIN') {
      const stats = await getProductivityStatsForAllCatalogManagers(period);
      return NextResponse.json({ stats, scope: 'ALL' });
    }

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const stats = await getProductivityStatsForUser(userId, period);
    return NextResponse.json({ stats: [stats], scope: 'OWN' });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const SetTargetSchema = z.object({
  userId: z.string().min(1),
  dailyTarget: z.number().int().min(1),
});

/** Solo Admin ajusta la meta diaria de un usuario (decisión 7 del plan: configurable por
 * usuario, no una meta global única). */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'productividad', 'write');
    const body = SetTargetSchema.parse(await request.json());
    await setProductivityTarget(body);
    return NextResponse.json({ ok: true });
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

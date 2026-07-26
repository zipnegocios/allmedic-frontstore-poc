import { NextResponse } from 'next/server';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { getPeriodBreakdown } from '@/lib/payment-service';

/** Desglose completo de un período — Admin ve todos los usuarios; el Gestor solo su
 * propia fila (decisión 8 del plan: vista de solo lectura, sin ver tarifas de otros). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'pagos', 'read');

    const { id } = await params;
    const breakdown = await getPeriodBreakdown(id);

    const role = (session.user as { role?: string })?.role;
    if (role === 'ADMIN') {
      return NextResponse.json({ breakdown });
    }

    const userId = getSessionUserId(session);
    const own = breakdown.filter((item) => item.userId === userId);
    return NextResponse.json({ breakdown: own });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

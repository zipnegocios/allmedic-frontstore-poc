import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError, PaymentModuleOffError } from '@/lib/permissions';
import { markPeriodPaid, PeriodStatusError } from '@/lib/payment-service';

/** CLOSED → PAID. Botón explícito "Marcar período como pagado" (decisión 8 del plan). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'honorarios-staff', 'write');

    const { id } = await params;
    await markPeriodPaid(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PeriodStatusError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof PaymentModuleOffError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { recalculatePeriod, PeriodNotOpenError, PaymentModuleDisabledError } from '@/lib/productivity-rates';

/** Botón "Recalcular período" — solo disponible en períodos OPEN (decisión 9 del plan:
 * recálculo manual explícito, nunca automático). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'pagos', 'write');

    const { id } = await params;
    await recalculatePeriod(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PeriodNotOpenError || err instanceof PaymentModuleDisabledError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

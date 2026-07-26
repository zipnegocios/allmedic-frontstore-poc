import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { listPeriods, createPeriod, getPeriodBreakdown } from '@/lib/payment-service';

/** Admin ve todos los períodos; el propio Gestor solo su desglose (decisión 8 del plan:
 * "Vista del Gestor, solo lectura, solo sus propios períodos"). */
export async function GET() {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'pagos', 'read');

    const role = (session.user as { role?: string })?.role;
    const periods = await listPeriods();

    if (role === 'ADMIN') {
      return NextResponse.json({ periods });
    }

    const userId = getSessionUserId(session);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ownPeriods = await Promise.all(
      periods.map(async (period) => {
        const breakdown = await getPeriodBreakdown(period.id);
        const own = breakdown.find((item) => item.userId === userId);
        return own ? { ...period, own } : null;
      })
    );
    return NextResponse.json({ periods: ownPeriods.filter(Boolean) });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const CreatePeriodSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  notes: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'pagos', 'write');
    const body = CreatePeriodSchema.parse(await request.json());
    const period = await createPeriod(new Date(body.startDate), new Date(body.endDate), body.notes);
    return NextResponse.json({ period }, { status: 201 });
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

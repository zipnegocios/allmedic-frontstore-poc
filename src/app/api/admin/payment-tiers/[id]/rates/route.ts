import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError, PaymentModuleOffError } from '@/lib/permissions';
import { updateRate } from '@/lib/payment-service';

const UpdateRateSchema = z.object({
  componentType: z.enum(['VARIANT', 'PRODUCT', 'SET', 'MEDIA', 'TIME_BONUS']),
  enabled: z.boolean(),
  amount: z.string().optional().nullable(),
  bonusPerUnitUnderTarget: z.string().optional().nullable(),
  penaltyPerUnitOverTarget: z.string().optional().nullable(),
});

/** Actualiza (o crea si faltara) una fila de tarifa de un componente para un tier —
 * grid por componente con toggle enabled/disabled y monto (Fase 7 del plan). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'honorarios-staff', 'write');

    const { id: tierId } = await params;
    const body = UpdateRateSchema.parse(await request.json());
    await updateRate({ tierId, ...body });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    if (err instanceof PaymentModuleOffError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

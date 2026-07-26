import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError, PaymentModuleOffError } from '@/lib/permissions';
import { assignUserTier } from '@/lib/payment-service';

const AssignTierSchema = z.object({
  tierId: z.string().nullable(),
  requiresAssignedTaskForPayment: z.boolean(),
});

/** Asigna tier y el flag de elegibilidad estricta (decisión 1 del plan, modo híbrido) a un
 * usuario — extiende el formulario de `/admin/usuarios`, requiere permiso de pagos (no de
 * usuarios) porque son datos de compensación, no de identidad del usuario. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'pagos', 'write');

    const { id } = await params;
    const body = AssignTierSchema.parse(await request.json());
    await assignUserTier(id, body.tierId, body.requiresAssignedTaskForPayment);
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

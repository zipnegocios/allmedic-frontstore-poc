import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { getPaymentModuleEnabled, setPaymentModuleEnabled } from '@/lib/payment-service';

/** Interruptor maestro (decisión 10 del plan) — apagado por defecto, tiene precedencia
 * sobre la matriz de permisos: se valida en cada función pública de `productivity-rates`,
 * no solo aquí. Este endpoint solo lee/escribe el flag. */
export async function GET() {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'pagos', 'read');
    const enabled = await getPaymentModuleEnabled();
    return NextResponse.json({ enabled });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const SetEnabledSchema = z.object({ enabled: z.boolean() });

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAdmin();
    // skipPaymentModuleGate: este es el único endpoint que debe seguir funcionando con el
    // módulo apagado — es el que lo vuelve a encender.
    await requireRole(session, 'pagos', 'write', { skipPaymentModuleGate: true });
    const body = SetEnabledSchema.parse(await request.json());
    await setPaymentModuleEnabled(body.enabled);
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

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { sendTestEmail, UnknownTestEventError } from '@/lib/email/test-send';

const TestSchema = z.object({ to: z.string().email('Correo inválido') });

/** Envía la plantilla real de un evento con datos de ejemplo, al correo indicado por el
 * Admin (botón "Probar" en `/admin/configuracion` → "Correos"). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'configuracion', 'write');
    const { key } = await params;
    const body = TestSchema.parse(await request.json());
    await sendTestEmail(key, body.to);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    if (err instanceof UnknownTestEventError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { setEventEnabled } from '@/lib/email/event-settings';

const PatchSchema = z.object({ enabled: z.boolean() });

/** Activa/desactiva un evento de correo individual (panel `/admin/configuracion` → "Correos"). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'configuracion', 'write');
    const { key } = await params;
    const body = PatchSchema.parse(await request.json());
    await setEventEnabled(key, body.enabled);
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

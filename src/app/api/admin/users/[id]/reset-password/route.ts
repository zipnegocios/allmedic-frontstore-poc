import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { resetUserPassword } from '@/lib/user-data-service';
import { sendEmail, passwordResetEmail } from '@/lib/email';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'usuarios', 'write');
    const { id } = await params;

    const result = await resetUserPassword(id);
    if (!result) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    if (result.user.email) {
      const { subject, html } = passwordResetEmail({
        name: result.user.name ?? result.user.email,
        email: result.user.email,
        temporaryPassword: result.temporaryPassword,
      });
      await sendEmail({ to: result.user.email, subject, html, eventKey: 'PASSWORD_RESET' });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

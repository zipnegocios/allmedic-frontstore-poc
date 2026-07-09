import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminCorporateAccountById, updateCorporateAccountStatus } from '@/lib/admin-data-service';
import { sendEmail, accountApprovedEmail, accountRejectedEmail } from '@/lib/email';

const UpdateStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED']),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const account = await getAdminCorporateAccountById(id);
    if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(account);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { status } = UpdateStatusSchema.parse(body);

    const adminUserId = (session.user as { id?: string }).id;
    if (!adminUserId) {
      return NextResponse.json({ error: 'No se pudo identificar al administrador' }, { status: 500 });
    }

    const account = await updateCorporateAccountStatus(id, status, adminUserId);

    if (status === 'APPROVED') {
      sendEmail({
        to: account.email,
        ...accountApprovedEmail({ contactName: account.contactName, razonSocial: account.razonSocial }),
      }).catch(() => {});
    } else if (status === 'REJECTED') {
      sendEmail({
        to: account.email,
        ...accountRejectedEmail({ contactName: account.contactName, razonSocial: account.razonSocial }),
      }).catch(() => {});
    }

    return NextResponse.json(account);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminQuoteById, updateQuote } from '@/lib/admin-data-service';
import { sendEmail, quoteStatusChangedEmail } from '@/lib/email';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const quote = await getAdminQuoteById(id);
    if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(quote);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const PatchSchema = z.object({
  quotedItems: z.unknown().optional(),
  quotedTotal: z.string().optional(),
  status: z.enum(['RECEIVED', 'IN_REVIEW', 'QUOTED', 'SENT', 'APPROVED', 'REJECTED', 'CLOSED']).optional(),
  internalNotes: z.string().optional(),
  note: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = PatchSchema.parse(await request.json());
    const { note, ...changes } = body;

    const adminUserId = (session.user as { id?: string }).id;
    if (!adminUserId) {
      return NextResponse.json({ error: 'No se pudo identificar al administrador' }, { status: 500 });
    }

    const result = await updateQuote(id, changes, adminUserId, note);
    if (!result) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    if (changes.status && result.historyEntry) {
      const quote = await getAdminQuoteById(id);
      const customerData = quote!.customerData as { email: string; contactName: string };
      sendEmail({
        to: customerData.email,
        ...quoteStatusChangedEmail({ contactName: customerData.contactName, code: quote!.code, newStatus: changes.status }),
      }).catch(() => {});
    }

    return NextResponse.json(result);
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

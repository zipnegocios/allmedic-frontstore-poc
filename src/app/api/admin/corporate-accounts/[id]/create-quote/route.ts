import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createQuoteFromAccount } from '@/lib/quotes/service';
import { getAdminCorporateAccountById } from '@/lib/admin-data-service';
import { getScopeContext, assertCanWriteOwnedRecord, OwnershipError } from '@/lib/permissions';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    const account = await getAdminCorporateAccountById(id);
    if (!account) return NextResponse.json({ error: 'Cuenta corporativa no encontrada' }, { status: 404 });

    const sessionUserId = (session.user as { id?: string })?.id;
    const scopeCtx = sessionUserId ? await getScopeContext(sessionUserId) : null;
    if (scopeCtx) assertCanWriteOwnedRecord(scopeCtx, account.salesAgentId);

    const quote = await createQuoteFromAccount(id);
    if (!quote) return NextResponse.json({ error: 'Cuenta corporativa no encontrada' }, { status: 404 });
    return NextResponse.json(quote, { status: 201 });
  } catch (err) {
    if (err instanceof OwnershipError) return NextResponse.json({ error: err.message }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { getQuoteById, updateQuote, softDeleteQuote } from '@/lib/quotes/service';
import { computeQuoteTotals } from '@/lib/quotes/totals';
import { regenerateQuotePdf } from '@/lib/quotes/finalize';
import { PatchQuoteSchema } from '@/lib/quotes/validation';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const quote = await getQuoteById(id);
    if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(quote);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = PatchQuoteSchema.parse(await request.json());

    const current = await getQuoteById(id);
    if (!current) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });

    const items = body.items ?? current.items.map((i) => ({
      id: i.id,
      kind: i.kind as 'CATALOG' | 'FREE',
      productId: i.productId,
      variantId: i.variantId,
      setId: i.setId,
      size: i.size,
      color: i.color,
      description: i.description,
      quantity: i.quantity,
      suggestedUnitPrice: i.suggestedUnitPrice != null ? Number(i.suggestedUnitPrice) : null,
      unitPrice: Number(i.unitPrice),
      discountType: i.discountType as 'PERCENTAGE' | 'FIXED' | null,
      discountValue: Number(i.discountValue ?? 0),
      taxRateOverride: i.taxRateOverride != null ? Number(i.taxRateOverride) : null,
      sortOrder: i.sortOrder,
    }));

    const taxRate = body.taxRate ?? Number(current.taxRate);
    const pricesIncludeTax = body.pricesIncludeTax ?? current.pricesIncludeTax;
    const discountType = body.discountType !== undefined ? body.discountType : (current.discountType as 'PERCENTAGE' | 'FIXED' | null);
    const discountValue = body.discountValue ?? Number(current.discountValue);

    const totals = computeQuoteTotals(
      items.map((i) => ({
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discountType: i.discountType,
        discountValue: i.discountValue,
        taxRateOverride: i.taxRateOverride,
      })),
      { taxRate, pricesIncludeTax, discountType, discountValue }
    );

    const updated = await updateQuote(id, {
      ...body,
      items: items as unknown as Parameters<typeof updateQuote>[1]['items'],
      totals,
    });
    if (!updated) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });

    if (current.status === 'FINAL' && current.pdfKey) {
      await regenerateQuotePdf(id);
    }

    return NextResponse.json(await getQuoteById(id));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Los datos de la cotización no son válidos',
          details: err.issues.map((issue) => ({ path: issue.path, message: issue.message })),
        },
        { status: 400 }
      );
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const adminUserId = (session.user as { id?: string })?.id ?? null;
    await softDeleteQuote(id, adminUserId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

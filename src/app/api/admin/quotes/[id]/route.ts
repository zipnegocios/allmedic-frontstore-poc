import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { getQuoteById, updateQuote, deleteQuoteDraft } from '@/lib/quotes/service';
import { computeQuoteTotals } from '@/lib/quotes/totals';
import { regenerateQuotePdf } from '@/lib/quotes/finalize';

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

const QuoteItemSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(['CATALOG', 'FREE']),
  productId: z.string().uuid().nullable().optional(),
  variantId: z.string().uuid().nullable().optional(),
  setId: z.string().uuid().nullable().optional(),
  size: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  description: z.string().min(1),
  quantity: z.number().min(1),
  suggestedUnitPrice: z.number().nullable().optional(),
  unitPrice: z.number().min(0),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).nullable().optional(),
  discountValue: z.number().min(0).optional(),
  taxRateOverride: z.number().nullable().optional(),
  pricingBreakdown: z
    .array(z.object({ ruleId: z.string(), ruleName: z.string(), kind: z.string(), amount: z.number() }))
    .nullable()
    .optional(),
  sortOrder: z.number(),
});

const PatchSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerIdNumber: z.string().nullable().optional(),
  customerContactName: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  customerCity: z.string().nullable().optional(),
  taxPresetId: z.string().uuid().nullable().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  pricesIncludeTax: z.boolean().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).nullable().optional(),
  discountValue: z.number().min(0).optional(),
  validityPresetId: z.string().uuid().nullable().optional(),
  validityDays: z.number().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(QuoteItemSchema).optional(),
  propagateToProfile: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = PatchSchema.parse(await request.json());

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
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const deleted = await deleteQuoteDraft(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Solo se pueden eliminar cotizaciones en borrador' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { listQuotes, createQuote } from '@/lib/quotes/service';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const channel = searchParams.get('channel');
    const search = searchParams.get('search');

    const quotes = await listQuotes({
      status: status === 'DRAFT' || status === 'FINAL' ? status : undefined,
      channel: channel === 'CORPORATE' || channel === 'RETAIL' ? channel : undefined,
      search: search || undefined,
    });
    return NextResponse.json({ quotes });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const CreateQuoteSchema = z.object({
  channel: z.enum(['CORPORATE', 'RETAIL']),
  accountId: z.string().uuid().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  customerName: z.string().min(1, 'El nombre del cliente es obligatorio'),
  customerIdNumber: z.string().nullable().optional(),
  customerContactName: z.string().nullable().optional(),
  customerEmail: z.string().email().nullable().optional().or(z.literal('')),
  customerPhone: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  customerCity: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = CreateQuoteSchema.parse(await request.json());
    const adminUserId = (session.user as { id?: string })?.id ?? null;

    const quote = await createQuote({ ...body, createdBy: adminUserId });
    return NextResponse.json(quote, { status: 201 });
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

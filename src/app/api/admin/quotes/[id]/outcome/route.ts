import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { setQuoteOutcome } from '@/lib/quotes/service';

const OutcomeSchema = z.object({ outcome: z.enum(['ACCEPTED', 'REJECTED']) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { outcome } = OutcomeSchema.parse(await request.json());
    const quote = await setQuoteOutcome(id, outcome);
    if (!quote) {
      return NextResponse.json({ error: 'Solo se puede marcar el resultado de una cotización definitiva' }, { status: 400 });
    }
    return NextResponse.json(quote);
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

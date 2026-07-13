import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/db';
import { taxPresets } from '@/db/schema';

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  rate: z.number().min(0).max(100).optional(),
  pricesIncludeTaxDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = PatchSchema.parse(await request.json());
    const patch: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.rate !== undefined) patch.rate = body.rate.toFixed(2);

    const [updated] = await db.update(taxPresets).set(patch).where(eq(taxPresets.id, id)).returning();
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
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
    await db.update(taxPresets).set({ isActive: false }).where(eq(taxPresets.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/db';
import { companySettings } from '@/db/schema';

export async function GET() {
  try {
    await requireAdmin();
    const [row] = await db.select().from(companySettings).limit(1);
    return NextResponse.json(row ?? null);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const PatchSchema = z.object({
  logoMediaId: z.string().uuid().nullable().optional(),
  razonSocial: z.string().optional(),
  ruc: z.string().optional(),
  address: z.string().nullable().optional(),
  phones: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  footerNote: z.string().nullable().optional(),
});

/** Singleton: siempre actualiza la única fila existente (creada por el seed) — nunca crea una segunda. */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = PatchSchema.parse(await request.json());
    const [existing] = await db.select({ id: companySettings.id }).from(companySettings).limit(1);
    if (!existing) {
      return NextResponse.json({ error: 'company_settings no está sembrada — correr db:seed:quotes' }, { status: 500 });
    }
    const [updated] = await db
      .update(companySettings)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(companySettings.id, existing.id))
      .returning();
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

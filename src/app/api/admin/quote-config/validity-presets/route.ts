import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { asc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/db';
import { validityPresets } from '@/db/schema';

export async function GET() {
  try {
    await requireAdmin();
    const rows = await db.select().from(validityPresets).orderBy(asc(validityPresets.sortOrder));
    return NextResponse.json({ presets: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const CreateSchema = z.object({
  name: z.string().min(1),
  days: z.number().min(1),
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = CreateSchema.parse(await request.json());
    const [preset] = await db.insert(validityPresets).values(body).returning();
    return NextResponse.json(preset, { status: 201 });
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

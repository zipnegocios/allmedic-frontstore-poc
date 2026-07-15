import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/db';
import { companySettings, mediaAssets } from '@/db/schema';
import { resolveMediaUrl } from '@/lib/media';

export async function GET() {
  try {
    await requireAdmin();
    const [row] = await db
      .select({
        id: companySettings.id,
        logoMediaId: companySettings.logoMediaId,
        razonSocial: companySettings.razonSocial,
        ruc: companySettings.ruc,
        address: companySettings.address,
        phones: companySettings.phones,
        email: companySettings.email,
        website: companySettings.website,
        footerNote: companySettings.footerNote,
        logoStorageKey: mediaAssets.storageKey,
      })
      .from(companySettings)
      .leftJoin(mediaAssets, eq(companySettings.logoMediaId, mediaAssets.id))
      .limit(1);

    if (!row) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      id: row.id,
      logoMediaId: row.logoMediaId,
      razonSocial: row.razonSocial,
      ruc: row.ruc,
      address: row.address,
      phones: row.phones,
      email: row.email,
      website: row.website,
      footerNote: row.footerNote,
      logoUrl: row.logoStorageKey ? resolveMediaUrl(row.logoStorageKey) : null,
    });
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

/** Singleton: siempre actualiza la única fila existente, o la crea si no existe. */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = PatchSchema.parse(await request.json());
    const [existing] = await db.select({ id: companySettings.id }).from(companySettings).limit(1);

    let updated;
    if (!existing) {
      [updated] = await db
        .insert(companySettings)
        .values({
          ...body,
          updatedAt: new Date(),
        })
        .returning();
    } else {
      [updated] = await db
        .update(companySettings)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(companySettings.id, existing.id))
        .returning();
    }

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

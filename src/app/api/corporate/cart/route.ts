import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { corporateCarts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCorporateAccountByUserId } from '@/lib/corporate-data-service';

const CartItemSchema = z.object({
  setId: z.string(),
  setSlug: z.string(),
  setName: z.string(),
  imageUrl: z.string().nullable(),
  sizeMode: z.enum(['MATRIX', 'PER_PIECE', 'NO_SIZES']),
  setGroupId: z.string().nullable(),
  brandId: z.string().nullable(),
  unitPrice: z.number(),
  hasMissingPrices: z.boolean(),
  lines: z.array(
    z.object({
      id: z.string(),
      pieceSelections: z.array(z.object({
        productId: z.string(),
        size: z.string().optional(),
        color: z.string().optional(),
      })),
      quantity: z.number(),
    })
  ),
});

const PutCartSchema = z.object({ items: z.array(CartItemSchema) });

/**
 * GET /api/corporate/cart — Carrito persistido en BD del usuario logueado (si tiene cuenta corporativa).
 * PUT /api/corporate/cart — Guarda el carrito completo (debounced desde el cliente).
 * Ambos son no-op silencioso si el usuario no tiene una cuenta corporativa asociada
 * (ej. admin del sistema navegando el catálogo corporativo, o cuenta aún no vinculada).
 */
export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ items: [] });

  const account = await getCorporateAccountByUserId(userId);
  if (!account) return NextResponse.json({ items: [] });

  const [cart] = await db.select().from(corporateCarts).where(eq(corporateCarts.accountId, account.id)).limit(1);
  return NextResponse.json({ items: cart?.items ?? [] });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ saved: false });

  const account = await getCorporateAccountByUserId(userId);
  if (!account) return NextResponse.json({ saved: false });

  try {
    const body = await request.json();
    const { items } = PutCartSchema.parse(body);

    const [existing] = await db
      .select({ id: corporateCarts.id })
      .from(corporateCarts)
      .where(eq(corporateCarts.accountId, account.id))
      .limit(1);

    if (existing) {
      await db
        .update(corporateCarts)
        .set({ items, updatedAt: new Date() })
        .where(eq(corporateCarts.accountId, account.id));
    } else {
      await db.insert(corporateCarts).values({ accountId: account.id, items });
    }

    return NextResponse.json({ saved: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al guardar el carrito' }, { status: 500 });
  }
}

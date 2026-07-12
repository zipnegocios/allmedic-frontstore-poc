import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { quoteRequests, corporateAccounts } from '@/db/schema';
import { sql, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import {
  getAllBusinessRules,
  getSetMetaByIds,
  getSetPricesByIds,
  getSetPiecesByIds,
  getInventorySnapshotByProductIds,
} from '@/lib/corporate-data-service';
import { validateCorporateCart, computeCartPricing, checkInventory, type SetMeta } from '@/lib/rules-engine';

const CartLineSchema = z.object({
  size: z.string().optional(),
  color: z.string().optional(),
  pieceSelections: z.array(z.object({ productId: z.string(), size: z.string() })).optional(),
  quantity: z.number().min(1),
});

const CartItemSchema = z.object({
  setId: z.string().min(1),
  setName: z.string().optional(),
  sizeMode: z.enum(['MATRIX', 'PER_PIECE', 'NO_SIZES']),
  lines: z.array(CartLineSchema).min(1),
});

const CustomerDataSchema = z.object({
  ruc: z.string().min(10, 'RUC inválido').max(13, 'RUC inválido'),
  razonSocial: z.string().min(1, 'Razón social requerida'),
  contactName: z.string().min(1, 'Nombre de contacto requerido'),
  email: z.string().email('Correo inválido'),
  phone: z.string().min(7, 'Teléfono inválido'),
  city: z.string().min(1, 'Ciudad requerida'),
  sector: z.string().optional(),
});

const QuoteRequestSchema = z.object({
  customerData: CustomerDataSchema,
  cart: z.object({ items: z.array(CartItemSchema).min(1) }),
});

async function generateQuoteCode(): Promise<string> {
  const year = new Date().getFullYear();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(quoteRequests)
    .where(sql`extract(year from ${quoteRequests.createdAt}) = ${year}`);
  const nextNumber = Number(count) + 1;
  return `COT-${year}-${String(nextNumber).padStart(4, '0')}`;
}

/**
 * POST /api/corporate/quotes
 * Recibe una solicitud de cotización corporativa. Re-valida reglas y recalcula
 * precios EN SERVIDOR — el payload del cliente nunca se confía directamente
 * (regla de oro del proyecto: el servidor es la fuente de verdad).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = QuoteRequestSchema.parse(body);
    const { customerData, cart } = validated;

    const setIds = cart.items.map((i) => i.setId);
    const [rules, setMeta, setPrices, setPieces] = await Promise.all([
      getAllBusinessRules(),
      getSetMetaByIds(setIds),
      getSetPricesByIds(setIds),
      getSetPiecesByIds(setIds),
    ]);

    // Re-validación en servidor: si el carrito no cumple las reglas, se rechaza.
    const validation = validateCorporateCart(cart, rules, setMeta);
    if (!validation.canSubmit) {
      return NextResponse.json(
        { error: 'El carrito no cumple las reglas de negocio', violations: validation.violations },
        { status: 400 }
      );
    }

    // INVENTORY_MODE: se resuelve por set y se compara contra un snapshot de stock real.
    const setMetaWithPieces: Record<string, SetMeta> = Object.fromEntries(
      setIds.map((id) => [id, { ...setMeta[id], pieces: setPieces[id] ?? [] }])
    );
    const productIds = Array.from(new Set(Object.values(setPieces).flat().map((p) => p.productId)));
    const stockSnapshot = await getInventorySnapshotByProductIds(productIds);
    const inventoryIssues = checkInventory(cart, rules, setMetaWithPieces, stockSnapshot);
    const blockIssues = inventoryIssues.filter((i) => i.severity === 'BLOCK');
    if (blockIssues.length > 0) {
      return NextResponse.json(
        {
          error: 'La solicitud excede el stock disponible',
          violations: blockIssues.map((i) => ({ code: i.code, message: i.message, setId: i.setId })),
        },
        { status: 400 }
      );
    }
    const informativeIssues = inventoryIssues.filter((i) => i.severity === 'INFORMATIVE');

    // Precios recalculados en servidor — nunca se usa el precio enviado por el cliente.
    const pricing = computeCartPricing(cart, setPrices, rules, setMeta);

    const session = await auth().catch(() => null);
    let accountId: string | null = null;
    if (session?.user?.id) {
      const [account] = await db
        .select({ id: corporateAccounts.id })
        .from(corporateAccounts)
        .where(eq(corporateAccounts.userId, session.user.id))
        .limit(1);
      accountId = account?.id ?? null;
    }

    const code = await generateQuoteCode();

    const internalNotes = informativeIssues.length > 0
      ? `Avisos de inventario al momento de la solicitud:\n${informativeIssues.map((i) => `- ${i.message}`).join('\n')}`
      : null;

    const [quote] = await db
      .insert(quoteRequests)
      .values({
        code,
        accountId,
        customerData,
        items: cart.items,
        referenceSubtotal: pricing.total.toFixed(2),
        status: 'RECEIVED',
        internalNotes,
      })
      .returning();

    return NextResponse.json(
      {
        code: quote.code,
        id: quote.id,
        referenceSubtotal: pricing.total,
        warnings: informativeIssues.map((i) => i.message),
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { quotes, quoteItems, corporateAccounts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import {
  getAllBusinessRules,
  getSetMetaByIds,
  getSetPricesByIds,
  getSetPiecesByIds,
  getVariantAvailabilityByProductIds,
} from '@/lib/corporate-data-service';
import { validateCorporateCart, computeCartPricing, type SetMeta } from '@/lib/rules-engine';

/** Prioridad de disponibilidad cuando varias variantes coinciden con una combinación pedida (ej.
 * el cliente no eligió color): la más disponible gana, igual criterio que usa el armador
 * (`SetDetailContent.tsx`) para agregar status entre colores de una misma talla. */
const AVAILABILITY_PRIORITY: Record<string, number> = { AVAILABLE: 0, BACKORDER: 1, OUT_OF_STOCK: 2 };

interface AvailabilityIssue {
  severity: 'BLOCK' | 'INFORMATIVE';
  setId: string;
  setName?: string;
  message: string;
}

const CartLineSchema = z.object({
  pieceSelections: z.array(z.object({
    productId: z.string(),
    size: z.string().optional(),
    color: z.string().optional(),
  })).min(1),
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

/**
 * POST /api/corporate/quotes
 * Recibe una solicitud de cotización corporativa y crea un BORRADOR en el módulo de
 * Cotizaciones Pro (sin `quoteNumber` — se asigna solo al pasar a DEFINITIVA desde el panel
 * admin). Re-valida reglas y recalcula precios EN SERVIDOR — el payload del cliente nunca se
 * confía directamente (regla de oro del proyecto: el servidor es la fuente de verdad).
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

    // Composición del set (piezas + cantidad por set) — necesaria para resolver reglas de
    // ámbito Producto y para MIN_QUANTITY/COLOR_RESTRICTION contextuales, que necesitan saber
    // cuántas unidades de CADA pieza aporta una combinación.
    const setMetaWithPieces: Record<string, SetMeta> = Object.fromEntries(
      setIds.map((id) => [id, { ...setMeta[id], pieces: setPieces[id] ?? [] }])
    );

    // Re-validación en servidor: si el carrito no cumple las reglas, se rechaza.
    const validation = validateCorporateCart(cart, rules, setMetaWithPieces);
    if (!validation.canSubmit) {
      return NextResponse.json(
        { error: 'El carrito no cumple las reglas de negocio', violations: validation.violations },
        { status: 400 }
      );
    }

    // Disponibilidad manual (status) de cada combinación pedida — re-validación en servidor con
    // una única consulta agregada (sin N+1 por línea), espejo del bloqueo del armador (4.1).
    const productIds = Array.from(new Set(Object.values(setPieces).flat().map((p) => p.productId)));
    const availabilityRows = await getVariantAvailabilityByProductIds(productIds);
    const productNameById = new Map(
      Object.values(setPieces).flat().map((p) => [p.productId, p.productName])
    );

    function resolveAvailability(productId: string, size?: string, color?: string): string | null {
      const candidates = availabilityRows.filter((r) => {
        if (r.productId !== productId) return false;
        if (size && r.size !== size) return false;
        if (color && r.colorCode !== color) return false;
        return true;
      });
      if (candidates.length === 0) return null;
      return candidates.reduce((best, r) =>
        AVAILABILITY_PRIORITY[r.status] < AVAILABILITY_PRIORITY[best.status] ? r : best
      ).status;
    }

    const availabilityIssues: AvailabilityIssue[] = [];
    for (const item of cart.items) {
      for (const cartLine of item.lines) {
        for (const sel of cartLine.pieceSelections) {
          const status = resolveAvailability(sel.productId, sel.size, sel.color);
          const productName = productNameById.get(sel.productId) ?? sel.productId;
          const pieceLabel = [productName, sel.size, sel.color].filter(Boolean).join(' - ');
          if (status === null) {
            availabilityIssues.push({
              severity: 'BLOCK',
              setId: item.setId,
              setName: item.setName,
              message: `${item.setName ?? 'Set'}: la combinación "${pieceLabel}" no está disponible.`,
            });
          } else if (status === 'OUT_OF_STOCK') {
            availabilityIssues.push({
              severity: 'BLOCK',
              setId: item.setId,
              setName: item.setName,
              message: `${item.setName ?? 'Set'}: "${pieceLabel}" está agotado.`,
            });
          } else if (status === 'BACKORDER') {
            availabilityIssues.push({
              severity: 'INFORMATIVE',
              setId: item.setId,
              setName: item.setName,
              message: `${item.setName ?? 'Set'}: "${pieceLabel}" está bajo pedido.`,
            });
          }
        }
      }
    }

    const blockIssues = availabilityIssues.filter((i) => i.severity === 'BLOCK');
    if (blockIssues.length > 0) {
      return NextResponse.json(
        {
          error: 'La solicitud incluye piezas agotadas o no disponibles',
          violations: blockIssues.map((i) => ({ code: 'VARIANT_UNAVAILABLE', message: i.message, setId: i.setId })),
        },
        { status: 400 }
      );
    }
    const informativeIssues = availabilityIssues.filter((i) => i.severity === 'INFORMATIVE');

    // Precios recalculados en servidor — nunca se usa el precio enviado por el cliente.
    const pricing = computeCartPricing(cart, setPrices, rules, setMetaWithPieces);

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

    const noteBlocks: string[] = [];
    if (informativeIssues.length > 0) {
      noteBlocks.push(`Piezas bajo pedido al momento de la solicitud:\n${informativeIssues.map((i) => `- ${i.message}`).join('\n')}`);
    }
    if (pricing.promoNotes.length > 0) {
      // GIFT no tiene efecto monetario — la nota queda en notes para que ventas la honre
      // al elaborar la cotización real (regla de oro del proyecto: el snapshot vive en el servidor).
      noteBlocks.push(`Regalos/promociones informativas a honrar:\n${pricing.promoNotes.map((n) => `- ${n}`).join('\n')}`);
    }
    const notes = noteBlocks.length > 0 ? noteBlocks.join('\n\n') : null;

    const totalDiscount = pricing.volumeDiscountAmount + pricing.promoDiscountAmount;

    const [quote] = await db
      .insert(quotes)
      .values({
        status: 'DRAFT',
        channel: 'CORPORATE',
        accountId,
        customerName: customerData.razonSocial,
        customerIdNumber: customerData.ruc,
        customerContactName: customerData.contactName,
        customerEmail: customerData.email,
        customerPhone: customerData.phone,
        customerCity: customerData.city,
        subtotal: pricing.subtotalBeforeDiscount.toFixed(2),
        totalDiscount: totalDiscount.toFixed(2),
        totalTax: '0',
        total: pricing.total.toFixed(2),
        notes,
      })
      .returning();

    let sortOrder = 0;
    for (const item of cart.items) {
      const line = pricing.lines.find((l) => l.setId === item.setId);
      const unitPrice = line?.unitPrice ?? 0;
      for (const cartLine of item.lines) {
        const sizes = Array.from(new Set(cartLine.pieceSelections.map((p) => p.size).filter(Boolean)));
        const description = sizes.length > 0
          ? `${item.setName ?? 'Set'} — Talla ${sizes.join('/')}`
          : (item.setName ?? 'Set');
        await db.insert(quoteItems).values({
          quoteId: quote.id,
          kind: 'CATALOG',
          setId: item.setId,
          size: sizes.length === 1 ? sizes[0] : null,
          description,
          quantity: cartLine.quantity,
          suggestedUnitPrice: unitPrice.toFixed(2),
          unitPrice: unitPrice.toFixed(2),
          pricingBreakdown: { composition: cartLine.pieceSelections },
          sortOrder: sortOrder++,
        });
      }
    }

    return NextResponse.json(
      {
        id: quote.id,
        quoteNumber: null,
        referenceSubtotal: pricing.total,
        warnings: informativeIssues.map((i) => i.message),
        promoNotes: pricing.promoNotes,
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

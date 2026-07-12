import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getAllBusinessRules,
  getSetMetaByIds,
  getSetPiecesByIds,
  getInventorySnapshotByProductIds,
} from '@/lib/corporate-data-service';
import { checkInventory, type SetMeta } from '@/lib/rules-engine';

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
  lines: z.array(CartLineSchema),
});

const BodySchema = z.object({ items: z.array(CartItemSchema) });

/**
 * POST /api/corporate/cart/check-inventory
 * Vista previa (dry-run) de INVENTORY_MODE para el carrito corporativo — permite mostrar
 * errores/avisos de stock en el drawer y en la página de solicitud ANTES de enviar. El
 * servidor vuelve a verificar esto mismo en POST /api/corporate/quotes de forma bloqueante;
 * este endpoint es solo para feedback inmediato en la UI (regla de oro del proyecto).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = BodySchema.parse(body);
    const cart = { items };

    if (items.length === 0) {
      return NextResponse.json({ issues: [] });
    }

    const setIds = items.map((i) => i.setId);
    const [rules, setMeta, setPieces] = await Promise.all([
      getAllBusinessRules(),
      getSetMetaByIds(setIds),
      getSetPiecesByIds(setIds),
    ]);

    const setMetaWithPieces: Record<string, SetMeta> = Object.fromEntries(
      setIds.map((id) => [id, { ...setMeta[id], pieces: setPieces[id] ?? [] }])
    );
    const productIds = Array.from(new Set(Object.values(setPieces).flat().map((p) => p.productId)));
    const stockSnapshot = await getInventorySnapshotByProductIds(productIds);

    const issues = checkInventory(cart, rules, setMetaWithPieces, stockSnapshot);
    return NextResponse.json({ issues });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ issues: [] });
  }
}

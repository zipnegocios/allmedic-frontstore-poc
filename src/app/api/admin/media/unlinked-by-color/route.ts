import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getUnlinkedProductMediaByColor } from '@/lib/admin-data-service';
import { z } from 'zod';

// POST en vez de GET: la lista de colores (id+code) puede ser larga y viene resuelta desde el
// formulario (no vale la pena otra consulta de colores server-side) — no encaja bien en query
// string. `productId` es opcional: en modo creación (producto aún sin guardar) no hay nada que
// excluir por vínculo/descarte, la función ya maneja ese caso (ver admin-data-service.ts).
const RequestSchema = z.object({
  productId: z.string().optional(),
  code: z.string().min(1),
  colors: z.array(z.object({ id: z.string(), code: z.string() })).min(1),
});

/**
 * POST /api/admin/media/unlinked-by-color
 * Assets ya subidos a `products/{code}/{colorCode}/...` sin vincular al producto+color (ni
 * descartados antes) — precarga automática de "Configuración por Color" al generar/regenerar la
 * matriz de variantes o al abrir un producto existente para editar.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { productId, code, colors } = RequestSchema.parse(body);
    const assetsByColorId = await getUnlinkedProductMediaByColor(productId, code, colors);
    return NextResponse.json({ assetsByColorId });
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

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminProductsLite } from '@/lib/admin-data-service';

/**
 * GET /api/admin/products/lite
 * Listado liviano (id/nombre/marca) de productos activos — usado por el selector de ámbito
 * "Producto específico" en el panel de reglas. `/api/admin/products` devuelve variantes e
 * imágenes completas, demasiado pesado para un simple dropdown.
 */
export async function GET() {
  try {
    await requireAdmin();
    const products = await getAdminProductsLite();
    return NextResponse.json({ products });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

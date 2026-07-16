import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { isProductCodeAvailable } from '@/lib/admin-data-service';

// Fase 3.4: verificación de unicidad en vivo (debounced en el cliente) del código de
// estilo (`products.code`, NOT NULL UNIQUE desde Fase 1). `excludeProductId` evita que
// el propio producto en edición se reporte como colisión de su propio código.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code')?.trim();
    const excludeProductId = searchParams.get('excludeProductId') || undefined;

    if (!code) {
      return NextResponse.json({ error: 'code es requerido' }, { status: 400 });
    }

    const available = await isProductCodeAvailable(code, excludeProductId);
    return NextResponse.json({ available });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

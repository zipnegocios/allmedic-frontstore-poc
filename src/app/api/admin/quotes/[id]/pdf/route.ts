import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getQuoteById } from '@/lib/quotes/service';
import { resolveQuotePdfUrl } from '@/lib/quotes/pdf-storage';

/** Redirige a la URL pública del PDF en R2 — el bucket ya es público vía dominio personalizado,
 * la protección real es el token no adivinable en la clave (`pdfKey`). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const quote = await getQuoteById(id);
    if (!quote || !quote.pdfKey) {
      return NextResponse.json({ error: 'La cotización no tiene un PDF generado' }, { status: 404 });
    }
    return NextResponse.redirect(resolveQuotePdfUrl(quote.pdfKey));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

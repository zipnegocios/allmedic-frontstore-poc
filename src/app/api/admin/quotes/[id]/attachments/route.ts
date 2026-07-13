import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { db } from '@/db';
import { quoteDocuments } from '@/db/schema';
import { resolveMediaUrl } from '@/lib/media';

const ConfirmSchema = z.object({
  key: z.string().min(1),
  fileName: z.string().min(1),
  type: z.enum(['COTIZACION', 'FACTURA', 'NOTA_ENTREGA', 'OTRO']),
});

/**
 * POST /api/admin/quotes/[id]/attachments
 * Confirma un adjunto ya subido a R2 (después del PUT al `uploadUrl` presignado)
 * y crea el registro en `quote_documents`. No sube el archivo — solo registra.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id: quoteId } = await params;
    const { key, fileName, type } = ConfirmSchema.parse(await request.json());

    const uploadedBy = getSessionUserId(session);
    if (!uploadedBy) {
      return NextResponse.json({ error: 'No se pudo identificar al administrador' }, { status: 500 });
    }

    const [attachment] = await db
      .insert(quoteDocuments)
      .values({ quoteId, type, fileName, fileUrl: resolveMediaUrl(key), uploadedBy })
      .returning();

    return NextResponse.json(attachment, { status: 201 });
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

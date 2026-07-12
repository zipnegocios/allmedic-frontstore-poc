import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { presignPut } from '@/lib/r2';
import { slugifySegment } from '@/lib/media';

const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15MB

const PresignSchema = z.object({
  fileName: z.string().min(1),
  sizeBytes: z.number().positive().max(MAX_PDF_BYTES, 'El archivo excede el tamaño máximo permitido (15MB)'),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id: quoteId } = await params;
    const { fileName, sizeBytes } = PresignSchema.parse(await request.json());

    const cleanName = slugifySegment(fileName.replace(/\.pdf$/i, '')) + '.pdf';
    const key = `quotes/${quoteId}/${Date.now()}-${cleanName}`;
    const uploadUrl = await presignPut(key, 'application/pdf', sizeBytes);

    return NextResponse.json({ uploadUrl, key });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { presignPut } from '@/lib/r2';
import { buildStorageKey, ALLOWED_MEDIA_MIME_TYPES, MEDIA_FOLDERS, VIDEO_ALLOWED_FOLDERS, isVideoMime, maxSizeForMime, type MediaFolder } from '@/lib/media';
import { z } from 'zod';

const PresignSchema = z.object({
  folder: z.enum(MEDIA_FOLDERS as [string, ...string[]]),
  fileName: z.string().min(1),
  mimeType: z.enum(ALLOWED_MEDIA_MIME_TYPES as [string, ...string[]], {
    message: 'Tipo de archivo no soportado. Solo se permiten JPEG, PNG, WebP, AVIF, MP4 o WebM.',
  }),
  sizeBytes: z.number().positive(),
  segments: z.array(z.string()).default([]),
}).refine((v) => v.sizeBytes <= maxSizeForMime(v.mimeType), {
  message: 'El archivo excede el tamaño máximo permitido para este tipo de medio',
  path: ['sizeBytes'],
}).refine((v) => !isVideoMime(v.mimeType) || VIDEO_ALLOWED_FOLDERS.includes(v.folder as MediaFolder), {
  message: 'Los videos solo se permiten en Productos y Banners',
  path: ['folder'],
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const input = PresignSchema.parse(body);

    const key = buildStorageKey(input.folder as MediaFolder, input.segments, input.fileName);
    const url = await presignPut(key, input.mimeType, input.sizeBytes);

    return NextResponse.json({ url, key });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

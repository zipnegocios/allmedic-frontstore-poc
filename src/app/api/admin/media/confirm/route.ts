import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { confirmMediaUpload } from '@/lib/media-data-service';
import { ALLOWED_MEDIA_MIME_TYPES, MEDIA_FOLDERS, VIDEO_ALLOWED_FOLDERS, MAX_VIDEO_PREVIEW_DURATION_SECONDS, isVideoMime, maxSizeForMime, type MediaFolder } from '@/lib/media';
import { z } from 'zod';

const ConfirmSchema = z.object({
  key: z.string().min(1),
  fileName: z.string().min(1),
  folder: z.enum(MEDIA_FOLDERS as [string, ...string[]]),
  mimeType: z.enum(ALLOWED_MEDIA_MIME_TYPES as [string, ...string[]]),
  sizeBytes: z.number().positive(),
  width: z.number().optional(),
  height: z.number().optional(),
  checksumSha256: z.string().optional(),
  durationSeconds: z.number().int().positive().max(600).optional(),
  previewStartSeconds: z.number().int().min(0).optional(),
  previewDurationSeconds: z.number().int().min(1).max(MAX_VIDEO_PREVIEW_DURATION_SECONDS).optional(),
}).refine((v) => v.sizeBytes <= maxSizeForMime(v.mimeType), {
  message: 'El archivo excede el tamaño máximo permitido para este tipo de medio',
  path: ['sizeBytes'],
}).refine((v) => !isVideoMime(v.mimeType) || VIDEO_ALLOWED_FOLDERS.includes(v.folder as MediaFolder), {
  message: 'Los videos solo se permiten en Productos y Banners',
  path: ['folder'],
}).refine((v) => {
  if (v.previewStartSeconds == null || v.previewDurationSeconds == null || v.durationSeconds == null) return true;
  return v.previewStartSeconds + v.previewDurationSeconds <= v.durationSeconds;
}, { message: 'La ventana de vista previa excede la duración del video', path: ['previewDurationSeconds'] });

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const input = ConfirmSchema.parse(body);

    const asset = await confirmMediaUpload({
      ...input,
      userId: getSessionUserId(session),
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

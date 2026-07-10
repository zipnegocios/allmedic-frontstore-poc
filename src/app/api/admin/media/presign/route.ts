import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { presignPut } from '@/lib/r2';
import { buildStorageKey, ALLOWED_MEDIA_MIME_TYPES, MAX_MEDIA_SIZE_BYTES, MEDIA_FOLDERS, type MediaFolder } from '@/lib/media';
import { z } from 'zod';

const PresignSchema = z.object({
  folder: z.enum(MEDIA_FOLDERS as [string, ...string[]]),
  fileName: z.string().min(1),
  mimeType: z.enum(ALLOWED_MEDIA_MIME_TYPES as [string, ...string[]]),
  sizeBytes: z.number().positive().max(MAX_MEDIA_SIZE_BYTES),
  segments: z.array(z.string()).default([]),
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
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

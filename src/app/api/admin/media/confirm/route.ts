import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { confirmMediaUpload } from '@/lib/media-data-service';
import { ALLOWED_MEDIA_MIME_TYPES, MAX_MEDIA_SIZE_BYTES, MEDIA_FOLDERS } from '@/lib/media';
import { z } from 'zod';

const ConfirmSchema = z.object({
  key: z.string().min(1),
  fileName: z.string().min(1),
  folder: z.enum(MEDIA_FOLDERS as [string, ...string[]]),
  mimeType: z.enum(ALLOWED_MEDIA_MIME_TYPES as [string, ...string[]]),
  sizeBytes: z.number().positive().max(MAX_MEDIA_SIZE_BYTES),
  width: z.number().optional(),
  height: z.number().optional(),
  checksumSha256: z.string().optional(),
});

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

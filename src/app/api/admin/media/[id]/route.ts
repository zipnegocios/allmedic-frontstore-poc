import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { getMediaAssetDetail, updateMediaAsset, deleteMediaAsset } from '@/lib/media-data-service';
import { MEDIA_FOLDERS } from '@/lib/media';
import { z } from 'zod';

const UpdateSchema = z.object({
  altText: z.string().optional(),
  title: z.string().optional(),
  caption: z.string().optional(),
  folder: z.enum(MEDIA_FOLDERS as [string, ...string[]]).optional(),
  fileName: z.string().min(1).optional(),
  tagIds: z.array(z.string()).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const detail = await getMediaAssetDetail(id);
    if (!detail) return NextResponse.json({ error: 'Medio no encontrado' }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const input = UpdateSchema.parse(body);

    const updated = await updateMediaAsset(id, { ...input, userId: getSessionUserId(session) });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    await deleteMediaAsset(id, force, getSessionUserId(session));
    return NextResponse.json({ success: true });
  } catch (err) {
    const error = err as Error & { usage?: Record<string, number> };
    if (error.usage) {
      return NextResponse.json({ error: 'Medio en uso', usage: error.usage }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

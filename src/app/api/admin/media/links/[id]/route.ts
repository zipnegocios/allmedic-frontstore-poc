import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { deleteMediaLink, updateMediaLink } from '@/lib/media-data-service';
import { MEDIA_LINK_ROLES } from '@/lib/media';
import { z } from 'zod';

const UpdateLinkSchema = z.object({
  sortOrder: z.number().optional(),
  altOverride: z.string().optional(),
  titleOverride: z.string().optional(),
  captionOverride: z.string().optional(),
  role: z.enum(MEDIA_LINK_ROLES).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const input = UpdateLinkSchema.parse(await request.json());
    const updated = await updateMediaLink(id, input);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await deleteMediaLink(id, getSessionUserId(session));
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getSessionUserId } from '@/lib/admin-auth';
import { createMediaLink } from '@/lib/media-data-service';
import { MEDIA_ENTITY_TYPES, MEDIA_LINK_ROLES } from '@/lib/media';
import { z } from 'zod';

const LinkSchema = z.object({
  assetId: z.string().min(1),
  entityType: z.enum(MEDIA_ENTITY_TYPES),
  entityId: z.string().min(1),
  colorId: z.string().optional(),
  role: z.enum(MEDIA_LINK_ROLES).default('GALLERY'),
  sortOrder: z.number().default(0),
  altOverride: z.string().optional(),
  titleOverride: z.string().optional(),
  captionOverride: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const input = LinkSchema.parse(body);

    const link = await createMediaLink({ ...input, userId: getSessionUserId(session) });
    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { listMediaTags, createMediaTag } from '@/lib/media-data-service';
import { z } from 'zod';

const TagSchema = z.object({
  name: z.string().min(1),
});

function slugify(input: string): string {
  return input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function GET() {
  try {
    await requireAdmin();
    const tags = await listMediaTags();
    return NextResponse.json(tags);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const { name } = TagSchema.parse(await request.json());
    const tag = await createMediaTag(name, slugify(name));
    return NextResponse.json(tag, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

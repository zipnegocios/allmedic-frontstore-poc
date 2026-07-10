import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { listMediaAssets } from '@/lib/media-data-service';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const tags = searchParams.get('tags');

    const result = await listMediaAssets({
      folder: searchParams.get('folder') || undefined,
      tags: tags ? tags.split(',').filter(Boolean) : undefined,
      q: searchParams.get('q') || undefined,
      unused: searchParams.get('unused') === 'true',
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '30'),
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

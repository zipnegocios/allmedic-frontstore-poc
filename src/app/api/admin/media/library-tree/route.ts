import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getMediaLibraryTree } from '@/lib/media-data-service';

export async function GET() {
  try {
    await requireAdmin();
    const tree = await getMediaLibraryTree();
    return NextResponse.json({ brands: tree });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

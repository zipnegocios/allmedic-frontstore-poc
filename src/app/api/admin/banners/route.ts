import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminBanners, createBanner } from '@/lib/admin-data-service';
import { z } from 'zod';

const CreateBannerSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  imageDesktop: z.string().min(1),
  imageMobile: z.string().optional(),
  ctaText: z.string().optional(),
  ctaLink: z.string().optional(),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const allBanners = await getAdminBanners();

    let filtered = allBanners;
    if (search) {
      const q = search.toLowerCase();
      filtered = allBanners.filter(b =>
        b.title.toLowerCase().includes(q) ||
        (b.subtitle && b.subtitle.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      banners: paginated,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const validated = CreateBannerSchema.parse(body);
    const banner = await createBanner(validated);
    return NextResponse.json(banner, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

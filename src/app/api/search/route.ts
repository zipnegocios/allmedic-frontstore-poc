import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/search?q=query
 * Full-text search across products
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const trimmedQuery = query.trim();

    // Search products by name, description, category, SKU
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: trimmedQuery } },
          { description: { contains: trimmedQuery } },
          { category: { contains: trimmedQuery } },
          { sku: { contains: trimmedQuery } },
        ],
      },
      include: {
        brand: true,
        images: { take: 1 },
      },
      take: 20,
      orderBy: { name: 'asc' },
    });

    // Log search for analytics
    await prisma.searchLog.create({
      data: {
        query: trimmedQuery,
        results: products.length,
      },
    });

    return NextResponse.json(
      {
        query: trimmedQuery,
        results: products,
        count: products.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/search]', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

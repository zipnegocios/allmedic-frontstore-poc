import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/products
 * Returns all products with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const brand = searchParams.get('brand');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (brand) {
      where.brand = { slug: brand };
    }

    // Fetch products with variants and images
    const products = await prisma.product.findMany({
      where,
      include: {
        brand: true,
        collection: true,
        variants: {
          include: {
            color: true,
          },
        },
        images: true,
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    // Get total count
    const total = await prisma.product.count({ where });

    return NextResponse.json(
      {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/products]', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

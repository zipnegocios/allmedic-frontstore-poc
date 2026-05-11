import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  products as productsTable,
  brands as brandsTable,
  productImages as imagesTable,
} from '@/db/schema';
import { searchLogs as searchLogsTable } from '@/db/schema';
import { eq, and, or, sql, asc, inArray } from 'drizzle-orm';

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
    const likeQuery = `%${trimmedQuery}%`;

    // Search products by name, description, category, SKU
    const products = await db
      .select({
        id: productsTable.id,
        slug: productsTable.slug,
        name: productsTable.name,
        description: productsTable.description,
        category: productsTable.category,
        gender: productsTable.gender,
        priceNormal: productsTable.priceNormal,
        priceSale: productsTable.priceSale,
        discountPct: productsTable.discountPct,
        discountEnd: productsTable.discountEnd,
        isNew: productsTable.isNew,
        isBestSeller: productsTable.isBestSeller,
        brandName: brandsTable.name,
      })
      .from(productsTable)
      .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
      .where(
        and(
          eq(productsTable.isActive, true),
          or(
            sql`${productsTable.name} ILIKE ${likeQuery}`,
            sql`${productsTable.description} ILIKE ${likeQuery}`,
            sql`${productsTable.category} ILIKE ${likeQuery}`,
            sql`${productsTable.sku} ILIKE ${likeQuery}`
          )!
        )
      )
      .limit(20)
      .orderBy(asc(productsTable.name));

    // Get first image for each product
    const productIds = products.map(p => p.id);
    const images = productIds.length > 0
      ? await db
          .select({
            productId: imagesTable.productId,
            url: imagesTable.url,
          })
          .from(imagesTable)
          .where(inArray(imagesTable.productId, productIds))
          .orderBy(asc(imagesTable.sortOrder))
      : [];

    const enrichedProducts = products.map(product => ({
      ...product,
      images: images.filter(i => i.productId === product.id).slice(0, 1),
    }));

    // Log search query
    await db.insert(searchLogsTable).values({
      query: trimmedQuery,
      results: enrichedProducts.length,
    });

    return NextResponse.json({
      query: trimmedQuery,
      results: enrichedProducts,
      count: enrichedProducts.length,
    });
  } catch (error) {
    console.error('[GET /api/search]', error);
    return NextResponse.json(
      { error: 'Failed to search products' },
      { status: 500 }
    );
  }
}

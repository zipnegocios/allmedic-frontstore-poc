import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  products as productsTable,
  brands as brandsTable,
  productImages as imagesTable,
} from '@/db/schema';
import { searchLogs as searchLogsTable } from '@/db/schema';
import { eq, and, or, sql, asc, inArray } from 'drizzle-orm';
import { searchProducts } from '@/lib/dummy-data';

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

    // Try DB search first, fallback to dummy data on error
    try {
      const likeQuery = `%${trimmedQuery}%`;

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

      if (products.length > 0) {
        // Get first image for each product
        const productIds = products.map(p => p.id);
        const images = await db
          .select({
            productId: imagesTable.productId,
            url: imagesTable.url,
          })
          .from(imagesTable)
          .where(inArray(imagesTable.productId, productIds))
          .orderBy(asc(imagesTable.sortOrder));

        const enrichedProducts = products.map(product => ({
          ...product,
          images: images.filter(i => i.productId === product.id).slice(0, 1),
        }));

        // Log search query (best effort)
        try {
          await db.insert(searchLogsTable).values({
            query: trimmedQuery,
            results: enrichedProducts.length,
          });
        } catch { /* ignore log errors */ }

        return NextResponse.json({
          query: trimmedQuery,
          results: enrichedProducts,
          count: enrichedProducts.length,
        });
      }
    } catch {
      // DB failed, fall through to dummy data
    }

    // Fallback to dummy data
    const dummyResults = searchProducts(trimmedQuery).map(p => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      category: p.category,
      gender: p.gender,
      priceNormal: String(p.priceNormal),
      priceSale: p.priceSale ? String(p.priceSale) : null,
      discountPct: p.discountPct ?? null,
      discountEnd: p.discountEnd ? new Date(p.discountEnd) : null,
      isNew: p.isNew,
      isBestSeller: p.isBestSeller,
      brandName: p.brand,
      images: p.variants[0]?.images?.[0] ? [{ productId: p.id, url: p.variants[0].images[0] }] : [],
    }));

    return NextResponse.json({
      query: trimmedQuery,
      results: dummyResults,
      count: dummyResults.length,
    });
  } catch (error) {
    console.error('[GET /api/search]', error);
    return NextResponse.json(
      { error: 'Failed to search products' },
      { status: 500 }
    );
  }
}

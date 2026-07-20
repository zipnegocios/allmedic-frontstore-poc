import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  products as productsTable,
  brands as brandsTable,
  productTypes as productTypesTable,
  mediaLinks as mediaLinksTable,
  mediaAssets as mediaAssetsTable,
} from '@/db/schema';
import { searchLogs as searchLogsTable } from '@/db/schema';
import { eq, and, or, sql, asc, inArray, ne } from 'drizzle-orm';
// Removed dummy search import
import { resolveMediaUrl } from '@/lib/media';

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
          productTypeId: productsTable.productTypeId,
          productTypeName: productTypesTable.name,
          productTypeSlug: productTypesTable.slug,
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
        .leftJoin(productTypesTable, eq(productsTable.productTypeId, productTypesTable.id))
        .where(
          and(
            eq(productsTable.isActive, true),
            ne(productsTable.visibility, 'GROUPS'),
            or(
              sql`${productsTable.name} ILIKE ${likeQuery}`,
              sql`${productsTable.description} ILIKE ${likeQuery}`,
              sql`${productsTable.sku} ILIKE ${likeQuery}`,
              // Búsqueda por nombre de tipo de producto (EAV) — reemplaza la rama legacy de `category`.
              sql`${productTypesTable.name} ILIKE ${likeQuery}`
            )!
          )
        )
        .limit(20)
        .orderBy(asc(productsTable.name));

      if (products.length > 0) {
        // Get first image for each product
        const productIds = products.map(p => p.id);
        const imageLinks = await db
          .select({
            productId: mediaLinksTable.entityId,
            role: mediaLinksTable.role,
            storageKey: mediaAssetsTable.storageKey,
            mimeType: mediaAssetsTable.mimeType,
          })
          .from(mediaLinksTable)
          .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
          .where(and(
            eq(mediaLinksTable.entityType, 'PRODUCT'),
            inArray(mediaLinksTable.role, ['GALLERY', 'COVER']),
            inArray(mediaLinksTable.entityId, productIds)
          ))
          .orderBy(asc(mediaLinksTable.sortOrder));
        const images = imageLinks.map((i) => ({ productId: i.productId, role: i.role, url: resolveMediaUrl(i.storageKey), mimeType: i.mimeType }));

        const enrichedProducts = products.map(product => {
          const productImages = images.filter(i => i.productId === product.id);
          const cover = productImages.find(i => i.role === 'COVER') || productImages[0];
          return {
            ...product,
            images: cover ? [cover] : [],
          };
        });


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
      } else {
        // Log search query (best effort)
        try {
          await db.insert(searchLogsTable).values({
            query: trimmedQuery,
            results: 0,
          });
        } catch { /* ignore log errors */ }

        return NextResponse.json({
          query: trimmedQuery,
          results: [],
          count: 0,
        });
      }
    } catch (err) {
      console.error('[GET /api/search] DB error:', err);
      return NextResponse.json({
        query: trimmedQuery,
        results: [],
        count: 0,
      });
    }
  } catch (error) {
    console.error('[GET /api/search]', error);
    return NextResponse.json(
      { error: 'Failed to search products' },
      { status: 500 }
    );
  }
}

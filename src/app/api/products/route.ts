import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  products as productsTable,
  brands as brandsTable,
  productVariants as variantsTable,
  productImages as imagesTable,
  colors as colorsTable,
} from '@/db/schema';
import { eq, and, or, sql, asc, desc, inArray } from 'drizzle-orm';

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

    // Build conditions
    const conditions = [eq(productsTable.isActive, true)];

    if (search) {
      const likeQuery = `%${search}%`;
      conditions.push(
        or(
          sql`${productsTable.name} ILIKE ${likeQuery}`,
          sql`${productsTable.description} ILIKE ${likeQuery}`
        )!
      );
    }

    if (category) {
      conditions.push(eq(productsTable.category, category));
    }

    if (brand) {
      conditions.push(eq(brandsTable.slug, brand));
    }

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(productsTable)
      .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
      .where(and(...conditions));

    const total = countResult[0]?.count || 0;

    // Fetch products
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
      .where(and(...conditions))
      .limit(limit)
      .offset(skip)
      .orderBy(desc(productsTable.createdAt));

    // Fetch variants and images for these products
    const productIds = products.map(p => p.id);

    const variants = productIds.length > 0
      ? await db
          .select({
            id: variantsTable.id,
            productId: variantsTable.productId,
            colorId: variantsTable.colorId,
            size: variantsTable.size,
            fit: variantsTable.fit,
            sku: variantsTable.sku,
            status: variantsTable.status,
            colorName: colorsTable.name,
            colorCode: colorsTable.code,
            colorHex: colorsTable.hex,
          })
          .from(variantsTable)
          .leftJoin(colorsTable, eq(variantsTable.colorId, colorsTable.id))
          .where(inArray(variantsTable.productId, productIds))
      : [];

    const images = productIds.length > 0
      ? await db
          .select({
            productId: imagesTable.productId,
            colorId: imagesTable.colorId,
            url: imagesTable.url,
            alt: imagesTable.alt,
          })
          .from(imagesTable)
          .where(inArray(imagesTable.productId, productIds))
          .orderBy(asc(imagesTable.sortOrder))
      : [];

    // Enrich products with variants and images
    const enrichedProducts = products.map(product => ({
      ...product,
      variants: variants.filter(v => v.productId === product.id),
      images: images.filter(i => i.productId === product.id),
    }));

    return NextResponse.json({
      products: enrichedProducts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[GET /api/products]', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

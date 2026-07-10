import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  products as productsTable,
  brands as brandsTable,
  productVariants as variantsTable,
  mediaLinks as mediaLinksTable,
  mediaAssets as mediaAssetsTable,
  colors as colorsTable,
} from '@/db/schema';
import { eq, and, or, sql, asc, desc, inArray, ne } from 'drizzle-orm';
import { PRODUCTS as DUMMY_PRODUCTS } from '@/lib/dummy-data';
import { resolveMediaUrl } from '@/lib/media';

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
    // Excluye productos "Solo Grupos" — solo existen como piezas de sets corporativos.
    const conditions = [eq(productsTable.isActive, true), ne(productsTable.visibility, 'GROUPS')];

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

    const imageLinks = productIds.length > 0
      ? await db
          .select({
            productId: mediaLinksTable.entityId,
            colorId: mediaLinksTable.colorId,
            storageKey: mediaAssetsTable.storageKey,
            altOverride: mediaLinksTable.altOverride,
            altText: mediaAssetsTable.altText,
          })
          .from(mediaLinksTable)
          .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
          .where(and(
            eq(mediaLinksTable.entityType, 'PRODUCT'),
            eq(mediaLinksTable.role, 'GALLERY'),
            inArray(mediaLinksTable.entityId, productIds)
          ))
          .orderBy(asc(mediaLinksTable.sortOrder))
      : [];
    const images = imageLinks.map((i) => ({
      productId: i.productId,
      colorId: i.colorId,
      url: resolveMediaUrl(i.storageKey),
      alt: i.altOverride ?? i.altText,
    }));

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
    // Fallback to dummy data
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const brand = searchParams.get('brand');

    let filtered = [...DUMMY_PRODUCTS];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (category) {
      filtered = filtered.filter(p => p.category === category);
    }
    if (brand) {
      filtered = filtered.filter(p => p.brand.toLowerCase().replace(/\s+/g, '-') === brand.toLowerCase());
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return NextResponse.json({
      products: paginated.map(p => ({
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
        variants: p.variants.map(v => ({
          id: v.id,
          productId: p.id,
          colorId: v.colorId,
          size: v.size,
          fit: v.fit ?? null,
          sku: v.sku,
          status: v.status,
          colorName: p.colors.find(c => c.id === v.colorId)?.name ?? '',
          colorCode: p.colors.find(c => c.id === v.colorId)?.code ?? '',
          colorHex: p.colors.find(c => c.id === v.colorId)?.hex ?? '',
        })),
        images: p.variants[0]?.images?.[0] ? [{ productId: p.id, colorId: p.variants[0].colorId, url: p.variants[0].images[0], alt: p.name }] : [],
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  }
}

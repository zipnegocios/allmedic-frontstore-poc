import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  products as productsTable,
  brands as brandsTable,
  productVariants as variantsTable,
  productTypes as productTypesTable,
  mediaLinks as mediaLinksTable,
  mediaAssets as mediaAssetsTable,
  colors as colorsTable,
} from '@/db/schema';
import { eq, and, or, sql, asc, desc, inArray, ne } from 'drizzle-orm';
// Removed dummy imports
import { resolveMediaUrl } from '@/lib/media';
import { CORTE_ATTRIBUTE_SLUG } from '@/lib/data-service';
import type { AttributesPayload } from '@/lib/attributes-payload/build-payload';

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
    // Filtra por `products.productTypeId` (EAV) — reemplaza al contrato legacy `?category=`
    // (Fase 4 remanente: `category` ya no es fuente de verdad en ninguna ruta de lectura).
    // Acepta el id directo o el slug del tipo de producto (join a `productTypes`).
    const productTypeId = searchParams.get('productTypeId');
    const productTypeSlug = searchParams.get('productTypeSlug');
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

    if (productTypeId) {
      conditions.push(eq(productsTable.productTypeId, productTypeId));
    }

    if (productTypeSlug) {
      conditions.push(eq(productTypesTable.slug, productTypeSlug));
    }

    if (brand) {
      conditions.push(eq(brandsTable.slug, brand));
    }

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(productsTable)
      .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
      .leftJoin(productTypesTable, eq(productsTable.productTypeId, productTypesTable.id))
      .where(and(...conditions));

    const total = countResult[0]?.count || 0;

    // Fetch products
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
            sku: variantsTable.sku,
            status: variantsTable.status,
            colorName: colorsTable.name,
            colorCode: colorsTable.code,
            colorHex: colorsTable.hex,
            attributesPayload: variantsTable.attributesPayload,
          })
          .from(variantsTable)
          .leftJoin(colorsTable, eq(variantsTable.colorId, colorsTable.id))
          .where(inArray(variantsTable.productId, productIds))
      : [];
    // "Corte" ya no lee `product_variants.fit` (legacy) — se deriva de
    // `attributesPayload.styles.corte` (EAV), mismo slug que `data-service.ts`.
    const variantsWithFit = variants.map((v) => {
      const payload = v.attributesPayload as AttributesPayload | null | undefined;
      return { ...v, fit: payload?.styles?.[CORTE_ATTRIBUTE_SLUG] ?? null };
    });

    const imageLinks = productIds.length > 0
      ? await db
          .select({
            productId: mediaLinksTable.entityId,
            colorId: mediaLinksTable.colorId,
            role: mediaLinksTable.role,
            storageKey: mediaAssetsTable.storageKey,
            mimeType: mediaAssetsTable.mimeType,
            altOverride: mediaLinksTable.altOverride,
            altText: mediaAssetsTable.altText,
          })
          .from(mediaLinksTable)
          .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
          .where(and(
            eq(mediaLinksTable.entityType, 'PRODUCT'),
            inArray(mediaLinksTable.role, ['GALLERY', 'COVER', 'COVER_SECONDARY']),
            inArray(mediaLinksTable.entityId, productIds)
          ))
          .orderBy(asc(mediaLinksTable.sortOrder))
      : [];
    const images = imageLinks.map((i) => ({
      productId: i.productId,
      colorId: i.colorId,
      role: i.role,
      url: resolveMediaUrl(i.storageKey),
      mimeType: i.mimeType,
      alt: i.altOverride ?? i.altText,
    }));

    // Enrich products with variants and images
    const enrichedProducts = products.map(product => {
      const productImages = images.filter(i => i.productId === product.id);
      const cover = productImages.find(i => i.role === 'COVER') || productImages[0];
      const secondaryCover = productImages.find(i => i.role === 'COVER_SECONDARY');
      return {
        ...product,
        variants: variantsWithFit.filter(v => v.productId === product.id),
        secondaryCover: secondaryCover ?? null,
        images: cover
          ? [cover, ...productImages.filter(i => i.role !== 'COVER' && i.role !== 'COVER_SECONDARY')]
          : productImages.filter(i => i.role !== 'COVER_SECONDARY'),
      };
    });


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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');

    return NextResponse.json({
      products: [],
      pagination: {
        page,
        limit,
        total: 0,
        pages: 0,
      },
    });
  }
}

import { db } from '@/db';
import {
  products as productsTable,
  brands as brandsTable,
  colors as colorsTable,
  stores as storesTable,
  banners as bannersTable,
  productVariants as variantsTable,
  mediaLinks as mediaLinksTable,
  mediaAssets as mediaAssetsTable,
} from '@/db/schema';
import type { Product, ProductColor, ProductVariant, Store, Gender, Size, Fit, BrandNavItem } from './types';
import { eq, and, or, asc, sql, inArray, gte, lte, ne, type SQL } from 'drizzle-orm';
import { resolveMediaUrl, isVideoMime, type MediaItem } from './media';
import {
  PRODUCTS as DUMMY_PRODUCTS,
  BRANDS as DUMMY_BRANDS,
  AVAILABLE_COLORS as DUMMY_COLORS,
  STORES as DUMMY_STORES,
  HERO_SLIDES as DUMMY_HERO_SLIDES,
} from './dummy-data';

// ── Fallback flag ──
// Set FORCE_DUMMY_DATA=true to always use dummy data
// During Next.js static generation (build time), DB may be unavailable — allow fallback
const FORCE_DUMMY = process.env.FORCE_DUMMY_DATA === 'true';
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE === 'phase-export';

let _dbAvailable = !FORCE_DUMMY;
let _lastDbCheck = 0;
const DB_CHECK_INTERVAL_MS = 30000; // reintentar cada 30 segundos

async function checkDbAvailable(): Promise<boolean> {
  if (FORCE_DUMMY) return false;

  // Si falló antes, reintentamos solo si pasó el intervalo
  if (!_dbAvailable) {
    const now = Date.now();
    if (now - _lastDbCheck < DB_CHECK_INTERVAL_MS) {
      return false; // todavía no toca reintentar
    }
  }

  _lastDbCheck = Date.now();

  try {
    // Quick health check: try a simple count query with timeout
    await Promise.race([
      db.select({ count: sql<number>`count(*)` }).from(productsTable).limit(1),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 3000)),
    ]);
    _dbAvailable = true;
    return true;
  } catch (err) {
    _dbAvailable = false;
    if (!isBuildTime) {
      throw new Error(`Database connection failed: ${(err as Error).message}`);
    }
    console.warn('[data-service] Database unavailable, falling back to dummy data');
    return false;
  }
}

// ── Gender mapping (DB enum → frontend string) ──
const genderFromDb: Record<string, Gender> = {
  MUJER: 'Mujer',
  HOMBRE: 'Hombre',
  UNISEX: 'Unisex',
};

// ── Transform DB product to frontend Product type ──
function transformProduct(dbProduct: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brandName: string;
  brandId: string | null;
  category: string;
  gender: string;
  priceNormal: string;
  priceSale: string | null;
  discountPct: number | null;
  discountEnd: Date | null;
  isNew: boolean;
  isBestSeller: boolean;
  crossSellId: string | null;
  features: unknown;
  careInstructions: unknown;
  variants: Array<{
    id: string;
    colorId: string;
    size: string;
    fit: string | null;
    sku: string;
    status: string;
    colorName: string;
    colorCode: string;
    colorHex: string;
  }>;
  images: Array<{
    colorId: string | null;
    role: string;
    url: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    previewStartSeconds: number | null;
    previewDurationSeconds: number | null;
  }>;
}): Product {
  // Build color list from unique variant colors
  const colorMap = new Map<string, ProductColor>();
  for (const v of dbProduct.variants) {
    if (!colorMap.has(v.colorId)) {
      colorMap.set(v.colorId, { id: v.colorId, name: v.colorName, code: v.colorCode, hex: v.colorHex });
    }
  }

  // Build image lookup by colorId
  const imagesByColor = new Map<string, MediaItem[]>();
  let cover: MediaItem | undefined = undefined;

  for (const img of dbProduct.images) {
    if (img.role === 'COVER') {
      cover = {
        url: img.url,
        type: isVideoMime(img.mimeType) ? 'video' : 'image',
        mimeType: img.mimeType,
        width: img.width,
        height: img.height,
        durationSeconds: img.durationSeconds,
        previewStartSeconds: img.previewStartSeconds,
        previewDurationSeconds: img.previewDurationSeconds,
      };
      continue;
    }
    const key = img.colorId || '_default';
    if (!imagesByColor.has(key)) imagesByColor.set(key, []);
    imagesByColor.get(key)!.push({
      url: img.url,
      type: isVideoMime(img.mimeType) ? 'video' : 'image',
      mimeType: img.mimeType,
      width: img.width,
      height: img.height,
      durationSeconds: img.durationSeconds,
      previewStartSeconds: img.previewStartSeconds,
      previewDurationSeconds: img.previewDurationSeconds,
    });
  }

  // Build unique sizes
  const sizeSet = new Set<string>();
  const fitSet = new Set<string>();
  for (const v of dbProduct.variants) {
    sizeSet.add(v.size);
    if (v.fit) fitSet.add(v.fit);
  }

  // Transform variants
  const variants: ProductVariant[] = dbProduct.variants.map(v => ({
    id: v.id,
    sku: v.sku,
    colorId: v.colorId,
    size: v.size as Size,
    fit: v.fit as Fit | undefined,
    images: imagesByColor.get(v.colorId) || imagesByColor.get('_default') || [],
    status: v.status as ProductVariant['status'],
  }));

  return {
    id: dbProduct.id,
    slug: dbProduct.slug,
    name: dbProduct.name,
    brand: dbProduct.brandName,
    brandId: dbProduct.brandId ?? undefined,
    category: dbProduct.category,
    gender: genderFromDb[dbProduct.gender] || 'Unisex',
    description: dbProduct.description || '',
    features: (dbProduct.features as string[]) || [],
    careInstructions: (dbProduct.careInstructions as string[]) || [],
    priceNormal: Number(dbProduct.priceNormal),
    priceSale: dbProduct.priceSale ? Number(dbProduct.priceSale) : undefined,
    discountPct: dbProduct.discountPct ?? undefined,
    discountEnd: dbProduct.discountEnd?.toISOString(),
    colors: Array.from(colorMap.values()),
    availableSizes: Array.from(sizeSet) as Size[],
    availableFits: fitSet.size > 0 ? Array.from(fitSet) as Fit[] : undefined,
    variants,
    cover,
    isNew: dbProduct.isNew,
    isBestSeller: dbProduct.isBestSeller,
    complementaryProduct: dbProduct.crossSellId ?? undefined,
  };
}


// ── Helper: fetch products with joins ──
async function fetchProductsWithJoins(whereCondition?: SQL<unknown>) {
  const baseQuery = db
    .select({
      id: productsTable.id,
      slug: productsTable.slug,
      name: productsTable.name,
      description: productsTable.description,
      brandName: sql<string>`COALESCE(${brandsTable.name}, '')`,
      brandId: productsTable.brandId,
      category: productsTable.category,
      gender: productsTable.gender,
      priceNormal: productsTable.priceNormal,
      priceSale: productsTable.priceSale,
      discountPct: productsTable.discountPct,
      discountEnd: productsTable.discountEnd,
      isNew: sql<boolean>`COALESCE(${productsTable.isNew}, false)`,
      isBestSeller: sql<boolean>`COALESCE(${productsTable.isBestSeller}, false)`,
      crossSellId: productsTable.crossSellId,
      features: productsTable.features,
      careInstructions: productsTable.careInstructions,
    })
    .from(productsTable)
    .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id));

  const rows = whereCondition
    ? await baseQuery.where(whereCondition)
    : await baseQuery;

  // Fetch variants and images for each product
  const productIds = rows.map(r => r.id);

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
          colorName: sql<string>`COALESCE(${colorsTable.name}, '')`,
          colorCode: sql<string>`COALESCE(${colorsTable.code}, '')`,
          colorHex: sql<string>`COALESCE(${colorsTable.hex}, '')`,
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
          role: mediaLinksTable.role,
          storageKey: mediaAssetsTable.storageKey,
          mimeType: mediaAssetsTable.mimeType,
          width: mediaAssetsTable.width,
          height: mediaAssetsTable.height,
          durationSeconds: mediaAssetsTable.durationSeconds,
          previewStartSeconds: mediaAssetsTable.previewStartSeconds,
          previewDurationSeconds: mediaAssetsTable.previewDurationSeconds,
        })
        .from(mediaLinksTable)
        .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
        .where(and(
          eq(mediaLinksTable.entityType, 'PRODUCT'),
          inArray(mediaLinksTable.role, ['GALLERY', 'COVER']),
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
    width: i.width,
    height: i.height,
    durationSeconds: i.durationSeconds,
    previewStartSeconds: i.previewStartSeconds,
    previewDurationSeconds: i.previewDurationSeconds,
  }));


  // Group by product
  return rows.map(product => {
    const productVariants = variants.filter(v => v.productId === product.id);
    const productImages = images.filter(i => i.productId === product.id);

    return transformProduct({
      ...product,
      variants: productVariants,
      images: productImages,
    });
  });
}

// ── Public API ──

export async function getAllProducts(): Promise<Product[]> {
  if (!await checkDbAvailable()) return DUMMY_PRODUCTS;
  // Excluye productos "Solo Grupos" — solo existen como piezas de sets corporativos.
  const results = await fetchProductsWithJoins(
    and(eq(productsTable.isActive, true), ne(productsTable.visibility, 'GROUPS'))
  );
  return results.length > 0 ? results : DUMMY_PRODUCTS;
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  if (!await checkDbAvailable()) return DUMMY_PRODUCTS.find(p => p.slug === slug);
  const results = await fetchProductsWithJoins(
    and(eq(productsTable.slug, slug), eq(productsTable.isActive, true))
  );
  return results[0] ?? DUMMY_PRODUCTS.find(p => p.slug === slug);
}

export async function getFeaturedProducts(): Promise<Product[]> {
  if (!await checkDbAvailable()) return DUMMY_PRODUCTS.filter(p => p.isBestSeller);
  const results = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(and(
      eq(productsTable.isActive, true),
      eq(productsTable.isBestSeller, true),
      ne(productsTable.visibility, 'GROUPS')
    ))
    .limit(8);

  const productIds = results.map(r => r.id);
  if (productIds.length === 0) return DUMMY_PRODUCTS.filter(p => p.isBestSeller);

  return fetchProductsWithJoins(inArray(productsTable.id, productIds));
}

export async function getProductsByBrand(brandSlug: string): Promise<Product[]> {
  if (!await checkDbAvailable()) return DUMMY_PRODUCTS.filter(p => p.brand.toLowerCase().replace(/\s+/g, '-') === brandSlug.toLowerCase());
  return fetchProductsWithJoins(
    and(
      eq(productsTable.isActive, true),
      eq(brandsTable.slug, brandSlug)
    )
  );
}

export async function searchProductsDb(query: string): Promise<Product[]> {
  if (!await checkDbAvailable()) {
    const q = query.toLowerCase().trim();
    return DUMMY_PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  }
  const likeQuery = `%${query}%`;
  return fetchProductsWithJoins(
    and(
      eq(productsTable.isActive, true),
      or(
        sql`${productsTable.name} ILIKE ${likeQuery}`,
        sql`${productsTable.description} ILIKE ${likeQuery}`,
        sql`${productsTable.category} ILIKE ${likeQuery}`,
        sql`${brandsTable.name} ILIKE ${likeQuery}`
      )
    )
  );
}

export async function getBrands(): Promise<Array<{ name: string; slug: string; description: string | null; logoUrl: string | null; productCount: number }>> {
  if (!await checkDbAvailable()) {
    const counts = new Map<string, number>();
    for (const p of DUMMY_PRODUCTS) {
      counts.set(p.brand, (counts.get(p.brand) || 0) + 1);
    }
    return DUMMY_BRANDS.map(name => ({
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-').replace(/'/g, ''),
      description: null,
      logoUrl: `/images/brands/${name.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '')}.png`,
      productCount: counts.get(name) || 0,
    }));
  }
  const brands = await db
    .select({
      id: brandsTable.id,
      name: brandsTable.name,
      slug: brandsTable.slug,
      description: brandsTable.description,
    })
    .from(brandsTable)
    .where(eq(brandsTable.isActive, true))
    .orderBy(asc(brandsTable.sortOrder));

  // Get product counts
  const counts = await db
    .select({
      brandId: productsTable.brandId,
      count: sql<number>`count(*)`,
    })
    .from(productsTable)
    .where(eq(productsTable.isActive, true))
    .groupBy(productsTable.brandId);

  const countMap = new Map(counts.map(c => [c.brandId, c.count]));

  const brandIds = brands.map((b) => b.id);
  const logoLinks = brandIds.length > 0
    ? await db
        .select({ brandId: mediaLinksTable.entityId, storageKey: mediaAssetsTable.storageKey })
        .from(mediaLinksTable)
        .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
        .where(and(
          eq(mediaLinksTable.entityType, 'BRAND'),
          eq(mediaLinksTable.role, 'LOGO'),
          inArray(mediaLinksTable.entityId, brandIds)
        ))
    : [];
  const logoMap = new Map(logoLinks.map((l) => [l.brandId, resolveMediaUrl(l.storageKey)]));

  return brands.map(b => ({
    name: b.name,
    slug: b.slug,
    description: b.description,
    logoUrl: logoMap.get(b.id) ?? null,
    productCount: countMap.get(b.id) || 0,
  }));
}

export async function getBrandNames(): Promise<string[]> {
  if (!await checkDbAvailable()) return DUMMY_BRANDS;
  const brands = await db
    .select({ name: brandsTable.name })
    .from(brandsTable)
    .where(eq(brandsTable.isActive, true))
    .orderBy(asc(brandsTable.sortOrder));

  return brands.map(b => b.name);
}

/** Marcas para navegación (header/mega-menu/home): nombre + logo real de R2, sin conteo de productos. */
export async function getBrandsForNav(): Promise<BrandNavItem[]> {
  const brands = await getBrands();
  return brands.map((b) => ({ name: b.name, logoUrl: b.logoUrl }));
}

export async function getColors(): Promise<ProductColor[]> {
  if (!await checkDbAvailable()) return DUMMY_COLORS;
  const colors = await db.select().from(colorsTable);
  return colors.length > 0 ? colors.map(c => ({ id: c.id, name: c.name, code: c.code, hex: c.hex })) : DUMMY_COLORS;
}

export async function getStores(): Promise<Store[]> {
  if (!await checkDbAvailable()) return DUMMY_STORES;
  const stores = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.isActive, true))
    .orderBy(asc(storesTable.sortOrder));

  return stores.length > 0 ? stores.map(s => ({
    id: s.id,
    name: s.name,
    address: s.address,
    phone: s.phone || '',
    hours: s.hours || '',
    isMain: s.isMain ?? false,
    mapUrl: s.mapUrl ?? undefined,
  })) : DUMMY_STORES;
}

interface HeroSlideData {
  id: string;
  desktopMedia: MediaItem;
  mobileMedia: MediaItem | null;
  title: string;
  subtitle?: string;
  cta: string;
  ctaLink: string;
}

function dummyHeroSlides(): HeroSlideData[] {
  return DUMMY_HERO_SLIDES.map(s => ({
    id: String(s.id),
    desktopMedia: { url: s.image, type: 'image', mimeType: 'image/jpeg', width: null, height: null },
    mobileMedia: null,
    title: s.title,
    subtitle: s.subtitle,
    cta: s.cta,
    ctaLink: s.ctaLink,
  }));
}

export async function getHeroSlides(): Promise<HeroSlideData[]> {
  if (!await checkDbAvailable()) return dummyHeroSlides();

  const banners = await db
    .select()
    .from(bannersTable)
    .where(eq(bannersTable.isActive, true))
    .orderBy(asc(bannersTable.sortOrder));

  if (banners.length === 0) return dummyHeroSlides();

  const bannerIds = banners.map((b) => b.id);
  const mediaCols = {
    bannerId: mediaLinksTable.entityId,
    storageKey: mediaAssetsTable.storageKey,
    mimeType: mediaAssetsTable.mimeType,
    width: mediaAssetsTable.width,
    height: mediaAssetsTable.height,
    durationSeconds: mediaAssetsTable.durationSeconds,
    previewStartSeconds: mediaAssetsTable.previewStartSeconds,
    previewDurationSeconds: mediaAssetsTable.previewDurationSeconds,
  };
  const [desktopLinks, mobileLinks] = bannerIds.length > 0
    ? await Promise.all([
        db.select(mediaCols).from(mediaLinksTable)
          .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
          .where(and(eq(mediaLinksTable.entityType, 'BANNER'), eq(mediaLinksTable.role, 'DESKTOP'), inArray(mediaLinksTable.entityId, bannerIds))),
        db.select(mediaCols).from(mediaLinksTable)
          .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
          .where(and(eq(mediaLinksTable.entityType, 'BANNER'), eq(mediaLinksTable.role, 'MOBILE'), inArray(mediaLinksTable.entityId, bannerIds))),
      ])
    : [[], []];

  function toMediaItem(l: (typeof desktopLinks)[number]): MediaItem {
    return {
      url: resolveMediaUrl(l.storageKey),
      type: isVideoMime(l.mimeType) ? 'video' : 'image',
      mimeType: l.mimeType,
      width: l.width,
      height: l.height,
      durationSeconds: l.durationSeconds,
      previewStartSeconds: l.previewStartSeconds,
      previewDurationSeconds: l.previewDurationSeconds,
    };
  }

  const desktopMap = new Map(desktopLinks.map((l) => [l.bannerId, toMediaItem(l)]));
  const mobileMap = new Map(mobileLinks.map((l) => [l.bannerId, toMediaItem(l)]));

  return banners
    .filter((b) => desktopMap.has(b.id))
    .map(b => ({
      id: b.id,
      desktopMedia: desktopMap.get(b.id)!,
      mobileMedia: mobileMap.get(b.id) ?? null,
      title: b.title,
      subtitle: b.subtitle ?? undefined,
      cta: b.ctaText || 'Ver más',
      ctaLink: b.ctaLink || '/catalogo',
    }));
}

export async function filterProducts(filters: {
  gender?: Gender;
  categories?: string[];
  brands?: string[];
  colors?: string[];
  sizes?: string[];
  fits?: string[];
  priceMin?: number;
  priceMax?: number;
}): Promise<Product[]> {
  if (!await checkDbAvailable()) {
    return DUMMY_PRODUCTS.filter(product => {
      if (filters.gender && product.gender !== filters.gender && product.gender !== 'Unisex') return false;
      if (filters.categories?.length && !filters.categories.includes(product.category)) return false;
      if (filters.brands?.length && !filters.brands.includes(product.brand)) return false;
      if (filters.colors?.length && !product.colors.some(c => filters.colors!.includes(c.name))) return false;
      if (filters.sizes?.length && !product.availableSizes.some(s => filters.sizes!.includes(s))) return false;
      const price = product.priceSale || product.priceNormal;
      if (filters.priceMin !== undefined && price < filters.priceMin) return false;
      if (filters.priceMax !== undefined && price > filters.priceMax) return false;
      return true;
    });
  }

  const genderDb = filters.gender ? Object.entries(genderFromDb).find(([, v]) => v === filters.gender)?.[0] : undefined;

  const conditions: SQL<unknown>[] = [eq(productsTable.isActive, true)];

  if (genderDb) {
    conditions.push(or(eq(productsTable.gender, genderDb), eq(productsTable.gender, 'UNISEX'))!);
  }

  if (filters.categories?.length) {
    conditions.push(inArray(productsTable.category, filters.categories));
  }

  if (filters.brands?.length) {
    conditions.push(inArray(brandsTable.name, filters.brands));
  }

  if (filters.priceMin !== undefined) {
    conditions.push(gte(productsTable.priceNormal, filters.priceMin.toString()));
  }

  if (filters.priceMax !== undefined) {
    conditions.push(lte(productsTable.priceNormal, filters.priceMax.toString()));
  }

  let products = await fetchProductsWithJoins(and(...conditions));

  // Client-side color/size/fit filtering (variant-level)
  if (filters.colors?.length) {
    products = products.filter(p => p.colors.some(c => filters.colors!.includes(c.name)));
  }
  if (filters.sizes?.length) {
    products = products.filter(p => p.availableSizes.some(s => filters.sizes!.includes(s)));
  }
  if (filters.fits?.length) {
    products = products.filter(p => p.availableFits?.some(f => filters.fits!.includes(f)));
  }

  return products;
}

export function resolveCoverMedia(product: Product): MediaItem {
  if (product.cover) return product.cover;
  // Fallback to first GALLERY image of any variant
  for (const variant of product.variants) {
    if (variant.images && variant.images.length > 0) {
      return variant.images[0];
    }
  }
  // Fallback to placeholder
  return {
    url: '/images/placeholder-product.jpg',
    type: 'image',
    mimeType: 'image/jpeg',
    width: null,
    height: null,
  };
}


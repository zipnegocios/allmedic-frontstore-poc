import { prisma } from './prisma';
import type { Product, ProductColor, ProductVariant, Store, Gender, Size, Fit } from './types';

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
  brand: { name: string };
  category: string;
  gender: string;
  priceNormal: unknown;
  priceSale: unknown;
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
    color: { id: string; name: string; code: string; hex: string };
  }>;
  images: Array<{
    colorId: string | null;
    url: string;
  }>;
}): Product {
  // Build color list from unique variant colors
  const colorMap = new Map<string, ProductColor>();
  for (const v of dbProduct.variants) {
    if (!colorMap.has(v.colorId)) {
      colorMap.set(v.colorId, { id: v.color.id, name: v.color.name, code: v.color.code, hex: v.color.hex });
    }
  }

  // Build image lookup by colorId
  const imagesByColor = new Map<string, string[]>();
  for (const img of dbProduct.images) {
    const key = img.colorId || '_default';
    if (!imagesByColor.has(key)) imagesByColor.set(key, []);
    imagesByColor.get(key)!.push(img.url);
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
    brand: dbProduct.brand.name,
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
    isNew: dbProduct.isNew,
    isBestSeller: dbProduct.isBestSeller,
    complementaryProduct: dbProduct.crossSellId ?? undefined,
  };
}

// Standard include for product queries
const productInclude = {
  brand: true,
  variants: { include: { color: true } },
  images: { orderBy: { sortOrder: 'asc' as const } },
};

// ── Public API ──

export async function getAllProducts(): Promise<Product[]> {
  const dbProducts = await prisma.product.findMany({
    where: { isActive: true },
    include: productInclude,
    orderBy: { createdAt: 'desc' },
  });
  return dbProducts.map(transformProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const dbProduct = await prisma.product.findUnique({
    where: { slug },
    include: productInclude,
  });
  if (!dbProduct) return undefined;
  return transformProduct(dbProduct);
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const dbProducts = await prisma.product.findMany({
    where: { isActive: true, isBestSeller: true },
    include: productInclude,
    take: 8,
  });
  return dbProducts.map(transformProduct);
}

export async function getProductsByBrand(brandSlug: string): Promise<Product[]> {
  const dbProducts = await prisma.product.findMany({
    where: { isActive: true, brand: { slug: brandSlug } },
    include: productInclude,
  });
  return dbProducts.map(transformProduct);
}

export async function searchProductsDb(query: string): Promise<Product[]> {
  const dbProducts = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query } },
        { description: { contains: query } },
        { category: { contains: query } },
        { brand: { name: { contains: query } } },
      ],
    },
    include: productInclude,
    take: 20,
  });
  return dbProducts.map(transformProduct);
}

export async function getBrands(): Promise<Array<{ name: string; slug: string; description: string | null; logoUrl: string | null; productCount: number }>> {
  const brands = await prisma.brand.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  return brands.map(b => ({
    name: b.name,
    slug: b.slug,
    description: b.description,
    logoUrl: b.logoUrl,
    productCount: b._count.products,
  }));
}

export async function getBrandNames(): Promise<string[]> {
  const brands = await prisma.brand.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { name: true },
  });
  return brands.map(b => b.name);
}

export async function getColors(): Promise<ProductColor[]> {
  const colors = await prisma.color.findMany();
  return colors.map(c => ({ id: c.id, name: c.name, code: c.code, hex: c.hex }));
}

export async function getStores(): Promise<Store[]> {
  const stores = await prisma.store.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  return stores.map(s => ({
    id: s.id,
    name: s.name,
    address: s.address,
    phone: s.phone || '',
    hours: s.hours || '',
    isMain: s.isMain,
    mapUrl: s.mapUrl ?? undefined,
  }));
}

export async function getHeroSlides(): Promise<Array<{ id: string; image: string; title: string; subtitle?: string; cta: string; ctaLink: string }>> {
  const banners = await prisma.banner.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  return banners.map(b => ({
    id: b.id,
    image: b.imageDesktop,
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
  const genderDb = filters.gender ? Object.entries(genderFromDb).find(([, v]) => v === filters.gender)?.[0] : undefined;

  const where: Record<string, unknown> = { isActive: true };
  if (genderDb) {
    where.OR = [{ gender: genderDb }, { gender: 'UNISEX' }];
  }
  if (filters.categories?.length) {
    where.category = { in: filters.categories };
  }
  if (filters.brands?.length) {
    where.brand = { name: { in: filters.brands } };
  }
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    where.priceNormal = {};
    if (filters.priceMin !== undefined) (where.priceNormal as Record<string, number>).gte = filters.priceMin;
    if (filters.priceMax !== undefined) (where.priceNormal as Record<string, number>).lte = filters.priceMax;
  }

  const dbProducts = await prisma.product.findMany({
    where,
    include: productInclude,
    orderBy: { createdAt: 'desc' },
  });

  let products = dbProducts.map(transformProduct);

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

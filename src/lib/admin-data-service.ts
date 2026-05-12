import { db } from '@/db';
import {
  products as productsTable,
  brands as brandsTable,
  colors as colorsTable,
  stores as storesTable,
  banners as bannersTable,
  productVariants as variantsTable,
  productImages as imagesTable,
  leads as leadsTable,
} from '@/db/schema';
import { eq, and, or, asc, desc, sql, like, type SQL } from 'drizzle-orm';

// ── Products ──

export async function getAdminProducts(opts: {
  search?: string;
  brandId?: string;
  category?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) {
  const { search, brandId, category, isActive, page = 1, limit = 20 } = opts;
  const conditions: SQL<unknown>[] = [];

  if (search) {
    conditions.push(or(
      like(productsTable.name, `%${search}%`),
      like(productsTable.sku, `%${search}%`)
    )!);
  }
  if (brandId) conditions.push(eq(productsTable.brandId, brandId));
  if (category) conditions.push(eq(productsTable.category, category));
  if (isActive !== undefined) conditions.push(eq(productsTable.isActive, isActive));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(productsTable).where(where),
    db.select({
      id: productsTable.id,
      slug: productsTable.slug,
      name: productsTable.name,
      sku: productsTable.sku,
      category: productsTable.category,
      gender: productsTable.gender,
      priceNormal: productsTable.priceNormal,
      priceSale: productsTable.priceSale,
      discountPct: productsTable.discountPct,
      isNew: productsTable.isNew,
      isBestSeller: productsTable.isBestSeller,
      isActive: productsTable.isActive,
      brandName: brandsTable.name,
    })
      .from(productsTable)
      .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
      .where(where)
      .orderBy(desc(productsTable.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);

  return {
    products: rows,
    total: countResult[0]?.count ?? 0,
    pages: Math.ceil((countResult[0]?.count ?? 0) / limit),
  };
}

export async function getAdminProductById(id: string) {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!product) return null;

  const [variants, images, brand] = await Promise.all([
    db.select().from(variantsTable).where(eq(variantsTable.productId, id)),
    db.select().from(imagesTable).where(eq(imagesTable.productId, id)).orderBy(asc(imagesTable.sortOrder)),
    db.select().from(brandsTable).where(eq(brandsTable.id, product.brandId)).limit(1),
  ]);

  return { ...product, variants, images, brand: brand[0] ?? null };
}

export async function createProduct(data: typeof productsTable.$inferInsert) {
  const [product] = await db.insert(productsTable).values(data).returning();
  return product;
}

export async function updateProduct(id: string, data: Partial<typeof productsTable.$inferInsert>) {
  const [product] = await db.update(productsTable).set(data).where(eq(productsTable.id, id)).returning();
  return product;
}

export async function deleteProduct(id: string) {
  // Soft delete
  await db.update(productsTable).set({ isActive: false }).where(eq(productsTable.id, id));
}

// ── Variants ──

export async function getVariantsByProduct(productId: string) {
  return db.select().from(variantsTable).where(eq(variantsTable.productId, productId));
}

export async function createVariant(data: typeof variantsTable.$inferInsert) {
  const [variant] = await db.insert(variantsTable).values(data).returning();
  return variant;
}

export async function updateVariant(id: string, data: Partial<typeof variantsTable.$inferInsert>) {
  const [variant] = await db.update(variantsTable).set(data).where(eq(variantsTable.id, id)).returning();
  return variant;
}

export async function deleteVariant(id: string) {
  await db.delete(variantsTable).where(eq(variantsTable.id, id));
}

// ── Leads ──

export async function getAdminLeads(opts: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  const { status, page = 1, limit = 20 } = opts;
  const where = status ? eq(leadsTable.status, status) : undefined;

  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(where),
    db.select().from(leadsTable).where(where).orderBy(desc(leadsTable.createdAt)).limit(limit).offset((page - 1) * limit),
  ]);

  return {
    leads: rows,
    total: countResult[0]?.count ?? 0,
    pages: Math.ceil((countResult[0]?.count ?? 0) / limit),
  };
}

export async function updateLeadStatus(id: string, status: string) {
  await db.update(leadsTable).set({ status }).where(eq(leadsTable.id, id));
}

// ── Brands ──

export async function getAdminBrands() {
  return db.select().from(brandsTable).orderBy(asc(brandsTable.sortOrder));
}

export async function createBrand(data: typeof brandsTable.$inferInsert) {
  const [brand] = await db.insert(brandsTable).values(data).returning();
  return brand;
}

export async function updateBrand(id: string, data: Partial<typeof brandsTable.$inferInsert>) {
  const [brand] = await db.update(brandsTable).set(data).where(eq(brandsTable.id, id)).returning();
  return brand;
}

export async function deleteBrand(id: string) {
  await db.delete(brandsTable).where(eq(brandsTable.id, id));
}

// ── Colors ──

export async function getAdminColors() {
  return db.select().from(colorsTable).orderBy(asc(colorsTable.name));
}

export async function createColor(data: typeof colorsTable.$inferInsert) {
  const [color] = await db.insert(colorsTable).values(data).returning();
  return color;
}

export async function updateColor(id: string, data: Partial<typeof colorsTable.$inferInsert>) {
  const [color] = await db.update(colorsTable).set(data).where(eq(colorsTable.id, id)).returning();
  return color;
}

export async function deleteColor(id: string) {
  await db.delete(colorsTable).where(eq(colorsTable.id, id));
}

// ── Stores ──

export async function getAdminStores() {
  return db.select().from(storesTable).orderBy(asc(storesTable.sortOrder));
}

export async function createStore(data: typeof storesTable.$inferInsert) {
  const [store] = await db.insert(storesTable).values(data).returning();
  return store;
}

export async function updateStore(id: string, data: Partial<typeof storesTable.$inferInsert>) {
  const [store] = await db.update(storesTable).set(data).where(eq(storesTable.id, id)).returning();
  return store;
}

export async function deleteStore(id: string) {
  await db.delete(storesTable).where(eq(storesTable.id, id));
}

// ── Banners ──

export async function getAdminBanners() {
  return db.select().from(bannersTable).orderBy(asc(bannersTable.sortOrder));
}

export async function createBanner(data: typeof bannersTable.$inferInsert) {
  const [banner] = await db.insert(bannersTable).values(data).returning();
  return banner;
}

export async function updateBanner(id: string, data: Partial<typeof bannersTable.$inferInsert>) {
  const [banner] = await db.update(bannersTable).set(data).where(eq(bannersTable.id, id)).returning();
  return banner;
}

export async function deleteBanner(id: string) {
  await db.delete(bannersTable).where(eq(bannersTable.id, id));
}

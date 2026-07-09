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
  setGroups as setGroupsTable,
  corporateSets as corporateSetsTable,
  setItems as setItemsTable,
} from '@/db/schema';
import { eq, and, or, asc, desc, sql, like, inArray, type SQL } from 'drizzle-orm';

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
      visibility: productsTable.visibility,
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
    db.select({
      id: variantsTable.id,
      productId: variantsTable.productId,
      colorId: variantsTable.colorId,
      size: variantsTable.size,
      fit: variantsTable.fit,
      sku: variantsTable.sku,
      status: variantsTable.status,
      stock: variantsTable.stock,
      minStock: variantsTable.minStock,
      colorName: colorsTable.name,
      colorCode: colorsTable.code,
      colorHex: colorsTable.hex,
    })
      .from(variantsTable)
      .leftJoin(colorsTable, eq(variantsTable.colorId, colorsTable.id))
      .where(eq(variantsTable.productId, id)),
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

// ── Product with Relations (Transactional) ──

interface VariantInput {
  colorId: string;
  size: string;
  fit?: string;
  sku: string;
  status: string;
  stock: number;
  minStock: number;
}

interface ImageInput {
  colorId?: string;
  url: string;
  alt?: string;
  sortOrder: number;
}

interface ProductWithRelationsInput {
  slug: string;
  name: string;
  description?: string;
  sku?: string;
  brandId: string;
  collectionId?: string;
  category: string;
  productType?: string;
  gender: string;
  priceNormal: string;
  priceSale?: string;
  discountPct?: number;
  discountEnd?: string | null;
  priceWholesale?: string | null;
  priceWholesaleSale?: string | null;
  wholesaleDiscountEnd?: string | null;
  visibility?: 'INDIVIDUAL' | 'GROUPS' | 'BOTH';
  isNew?: boolean;
  isBestSeller?: boolean;
  isActive?: boolean;
  features?: string[];
  careInstructions?: string[];
  styles?: string[];
  crossSellId?: string | null;
  variants?: VariantInput[];
  images?: ImageInput[];
}

export async function createProductWithRelations(input: ProductWithRelationsInput) {
  return await db.transaction(async (tx) => {
    const { variants = [], images = [], ...productData } = input;

    const [product] = await tx.insert(productsTable).values({
      ...productData,
      discountEnd: productData.discountEnd ? new Date(productData.discountEnd) : undefined,
      wholesaleDiscountEnd: productData.wholesaleDiscountEnd ? new Date(productData.wholesaleDiscountEnd) : undefined,
    }).returning();

    if (variants.length > 0) {
      await tx.insert(variantsTable).values(
        variants.map(v => ({
          ...v,
          productId: product.id,
        }))
      );
    }

    if (images.length > 0) {
      await tx.insert(imagesTable).values(
        images.map(i => ({
          ...i,
          productId: product.id,
        }))
      );
    }

    return product;
  });
}

export async function updateProductWithRelations(
  id: string,
  input: Partial<ProductWithRelationsInput>
) {
  return await db.transaction(async (tx) => {
    const { variants, images, ...productData } = input;

    // Update product base
    if (Object.keys(productData).length > 0) {
      const updateData: Record<string, unknown> = { ...productData };
      if (productData.discountEnd !== undefined) {
        updateData.discountEnd = productData.discountEnd ? new Date(productData.discountEnd) : null;
      }
      if (productData.wholesaleDiscountEnd !== undefined) {
        updateData.wholesaleDiscountEnd = productData.wholesaleDiscountEnd ? new Date(productData.wholesaleDiscountEnd) : null;
      }
      await tx.update(productsTable).set(updateData).where(eq(productsTable.id, id));
    }

    // Replace variants: delete existing, insert new
    if (variants !== undefined) {
      await tx.delete(variantsTable).where(eq(variantsTable.productId, id));
      if (variants.length > 0) {
        await tx.insert(variantsTable).values(
          variants.map(v => ({
            ...v,
            productId: id,
          }))
        );
      }
    }

    // Replace images: delete existing, insert new
    if (images !== undefined) {
      await tx.delete(imagesTable).where(eq(imagesTable.productId, id));
      if (images.length > 0) {
        await tx.insert(imagesTable).values(
          images.map(i => ({
            ...i,
            productId: id,
          }))
        );
      }
    }

    const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    return product;
  });
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

// ── Set Groups (Grupos de Sets Corporativos) ──

export async function getAdminSetGroups() {
  return db.select().from(setGroupsTable).orderBy(asc(setGroupsTable.sortOrder));
}

export async function createSetGroup(data: typeof setGroupsTable.$inferInsert) {
  const [group] = await db.insert(setGroupsTable).values(data).returning();
  return group;
}

export async function updateSetGroup(id: string, data: Partial<typeof setGroupsTable.$inferInsert>) {
  const [group] = await db.update(setGroupsTable).set(data).where(eq(setGroupsTable.id, id)).returning();
  return group;
}

export async function deleteSetGroup(id: string) {
  await db.delete(setGroupsTable).where(eq(setGroupsTable.id, id));
}

// ── Corporate Sets (Sets Corporativos) ──

export async function getAdminSets() {
  const rows = await db
    .select({
      id: corporateSetsTable.id,
      name: corporateSetsTable.name,
      slug: corporateSetsTable.slug,
      imageUrl: corporateSetsTable.imageUrl,
      setGroupId: corporateSetsTable.setGroupId,
      groupName: setGroupsTable.name,
      brandId: corporateSetsTable.brandId,
      brandName: brandsTable.name,
      isActive: corporateSetsTable.isActive,
      isFeatured: corporateSetsTable.isFeatured,
      sortOrder: corporateSetsTable.sortOrder,
    })
    .from(corporateSetsTable)
    .leftJoin(setGroupsTable, eq(corporateSetsTable.setGroupId, setGroupsTable.id))
    .leftJoin(brandsTable, eq(corporateSetsTable.brandId, brandsTable.id))
    .orderBy(asc(corporateSetsTable.sortOrder));

  const setIds = rows.map(r => r.id);
  const itemCounts = setIds.length > 0
    ? await db
        .select({ setId: setItemsTable.setId, count: sql<number>`count(*)` })
        .from(setItemsTable)
        .where(inArray(setItemsTable.setId, setIds))
        .groupBy(setItemsTable.setId)
    : [];
  const countMap = new Map(itemCounts.map(c => [c.setId, Number(c.count)]));

  return rows.map(r => ({ ...r, itemCount: countMap.get(r.id) ?? 0 }));
}

export async function getAdminSetById(id: string) {
  const [set] = await db.select().from(corporateSetsTable).where(eq(corporateSetsTable.id, id)).limit(1);
  if (!set) return null;

  const items = await db
    .select({
      id: setItemsTable.id,
      productId: setItemsTable.productId,
      quantityPerSet: setItemsTable.quantityPerSet,
      sortOrder: setItemsTable.sortOrder,
      productName: productsTable.name,
      productSlug: productsTable.slug,
      priceWholesale: productsTable.priceWholesale,
      priceWholesaleSale: productsTable.priceWholesaleSale,
      priceNormal: productsTable.priceNormal,
    })
    .from(setItemsTable)
    .leftJoin(productsTable, eq(setItemsTable.productId, productsTable.id))
    .where(eq(setItemsTable.setId, id))
    .orderBy(asc(setItemsTable.sortOrder));

  return { ...set, items };
}

interface SetItemInput {
  id?: string;
  productId: string;
  quantityPerSet: number;
  sortOrder: number;
}

interface CorporateSetInput {
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  setGroupId?: string | null;
  brandId?: string | null;
  isActive?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
  items?: SetItemInput[];
}

export async function createSetWithItems(input: CorporateSetInput) {
  return await db.transaction(async (tx) => {
    const { items = [], ...setData } = input;
    const [set] = await tx.insert(corporateSetsTable).values(setData).returning();

    if (items.length > 0) {
      await tx.insert(setItemsTable).values(
        items.map(i => ({
          productId: i.productId,
          quantityPerSet: i.quantityPerSet,
          sortOrder: i.sortOrder,
          setId: set.id,
        }))
      );
    }

    return set;
  });
}

export async function updateSetWithItems(id: string, input: Partial<CorporateSetInput>) {
  return await db.transaction(async (tx) => {
    const { items, ...setData } = input;

    if (Object.keys(setData).length > 0) {
      await tx.update(corporateSetsTable).set(setData).where(eq(corporateSetsTable.id, id));
    }

    if (items !== undefined) {
      await tx.delete(setItemsTable).where(eq(setItemsTable.setId, id));
      if (items.length > 0) {
        await tx.insert(setItemsTable).values(
          items.map(i => ({
            productId: i.productId,
            quantityPerSet: i.quantityPerSet,
            sortOrder: i.sortOrder,
            setId: id,
          }))
        );
      }
    }

    const [set] = await tx.select().from(corporateSetsTable).where(eq(corporateSetsTable.id, id)).limit(1);
    return set;
  });
}

export async function deleteSet(id: string) {
  await db.delete(corporateSetsTable).where(eq(corporateSetsTable.id, id));
}

// ── Productos disponibles para armar sets (visibility GROUPS o BOTH) ──

export async function getGroupEligibleProducts() {
  return db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      slug: productsTable.slug,
      priceWholesale: productsTable.priceWholesale,
      priceWholesaleSale: productsTable.priceWholesaleSale,
      priceNormal: productsTable.priceNormal,
      visibility: productsTable.visibility,
      brandName: brandsTable.name,
    })
    .from(productsTable)
    .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .where(
      and(
        eq(productsTable.isActive, true),
        or(eq(productsTable.visibility, 'GROUPS'), eq(productsTable.visibility, 'BOTH'))
      )
    )
    .orderBy(asc(productsTable.name));
}

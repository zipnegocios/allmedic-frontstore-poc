import { db } from '@/db';
import {
  products as productsTable,
  brands as brandsTable,
  colors as colorsTable,
  stores as storesTable,
  banners as bannersTable,
  productVariants as variantsTable,
  leads as leadsTable,
  setGroups as setGroupsTable,
  corporateSets as corporateSetsTable,
  setItems as setItemsTable,
  corporateAccounts as corporateAccountsTable,
  businessRules as businessRulesTable,
  mediaLinks as mediaLinksTable,
  mediaAssets as mediaAssetsTable,
} from '@/db/schema';
import { eq, and, or, asc, desc, sql, like, inArray, isNull, isNotNull, type SQL } from 'drizzle-orm';
import { resolveMediaUrl } from './media';
import type { BusinessRule, RuleConflict } from '@/lib/rules-engine';

// ── Helpers de vínculos de un solo medio (marcas/banners/sets) ──

async function replaceSingleLink(
  entityType: 'BRAND' | 'BANNER' | 'SET',
  entityId: string,
  role: string,
  assetId: string | null | undefined
) {
  await db.delete(mediaLinksTable).where(and(
    eq(mediaLinksTable.entityType, entityType),
    eq(mediaLinksTable.entityId, entityId),
    eq(mediaLinksTable.role, role)
  ));
  if (assetId) {
    await db.insert(mediaLinksTable).values({ assetId, entityType, entityId, role });
  }
}

async function getSingleLinkUrl(entityType: 'BRAND' | 'BANNER' | 'SET' | 'PRODUCT', entityId: string, role: string): Promise<string | null> {
  const [link] = await db
    .select({ storageKey: mediaAssetsTable.storageKey })
    .from(mediaLinksTable)
    .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
    .where(and(
      eq(mediaLinksTable.entityType, entityType),
      eq(mediaLinksTable.entityId, entityId),
      eq(mediaLinksTable.role, role)
    ));
  return link ? resolveMediaUrl(link.storageKey) : null;
}

async function getSingleLinksUrlMap(entityType: 'BRAND' | 'BANNER' | 'SET' | 'PRODUCT', entityIds: string[], role: string): Promise<Map<string, string>> {
  if (entityIds.length === 0) return new Map();
  const links = await db
    .select({ entityId: mediaLinksTable.entityId, storageKey: mediaAssetsTable.storageKey })
    .from(mediaLinksTable)
    .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
    .where(and(
      eq(mediaLinksTable.entityType, entityType),
      eq(mediaLinksTable.role, role),
      inArray(mediaLinksTable.entityId, entityIds)
    ));
  return new Map(links.map((l) => [l.entityId, resolveMediaUrl(l.storageKey)]));
}

interface LinkedMediaInfo {
  url: string;
  mimeType: string;
  previewStartSeconds: number | null;
  previewDurationSeconds: number | null;
}

async function getSingleLinksMediaMap(entityType: 'BRAND' | 'BANNER' | 'SET', entityIds: string[], role: string): Promise<Map<string, LinkedMediaInfo>> {
  if (entityIds.length === 0) return new Map();
  const links = await db
    .select({
      entityId: mediaLinksTable.entityId,
      storageKey: mediaAssetsTable.storageKey,
      mimeType: mediaAssetsTable.mimeType,
      previewStartSeconds: mediaAssetsTable.previewStartSeconds,
      previewDurationSeconds: mediaAssetsTable.previewDurationSeconds,
    })
    .from(mediaLinksTable)
    .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
    .where(and(
      eq(mediaLinksTable.entityType, entityType),
      eq(mediaLinksTable.role, role),
      inArray(mediaLinksTable.entityId, entityIds)
    ));
  return new Map(links.map((l) => [l.entityId, {
    url: resolveMediaUrl(l.storageKey),
    mimeType: l.mimeType,
    previewStartSeconds: l.previewStartSeconds,
    previewDurationSeconds: l.previewDurationSeconds,
  }]));
}

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

  const [variants, images, cover, brand] = await Promise.all([
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
    db.select({
      id: mediaLinksTable.id,
      assetId: mediaLinksTable.assetId,
      colorId: mediaLinksTable.colorId,
      sortOrder: mediaLinksTable.sortOrder,
      alt: mediaLinksTable.altOverride,
      storageKey: mediaAssetsTable.storageKey,
      mimeType: mediaAssetsTable.mimeType,
    })
      .from(mediaLinksTable)
      .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
      .where(and(
        eq(mediaLinksTable.entityType, 'PRODUCT'),
        eq(mediaLinksTable.entityId, id),
        eq(mediaLinksTable.role, 'GALLERY')
      ))
      .orderBy(asc(mediaLinksTable.sortOrder)),
    db.select({
      id: mediaLinksTable.id,
      assetId: mediaLinksTable.assetId,
      alt: mediaLinksTable.altOverride,
      storageKey: mediaAssetsTable.storageKey,
      mimeType: mediaAssetsTable.mimeType,
    })
      .from(mediaLinksTable)
      .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
      .where(and(
        eq(mediaLinksTable.entityType, 'PRODUCT'),
        eq(mediaLinksTable.entityId, id),
        eq(mediaLinksTable.role, 'COVER')
      ))
      .limit(1),
    db.select().from(brandsTable).where(eq(brandsTable.id, product.brandId)).limit(1),
  ]);

  const imagesWithUrl = images.map((i) => ({ ...i, url: resolveMediaUrl(i.storageKey) }));
  const coverWithUrl = cover[0] ? { ...cover[0], url: resolveMediaUrl(cover[0].storageKey) } : null;

  return { ...product, variants, images: imagesWithUrl, cover: coverWithUrl, brand: brand[0] ?? null };

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
  assetId: string;
  colorId?: string;
  alt?: string;
  sortOrder: number;
}

/** Postgres rechaza '' para columnas decimal/numeric: el formulario envía '' cuando el campo queda vacío. */
function emptyToNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === '' ? null : value;
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
  cover?: { assetId: string; alt?: string };
}

export async function createProductWithRelations(input: ProductWithRelationsInput) {
  return await db.transaction(async (tx) => {
    const { variants = [], images = [], cover, ...productData } = input;

    const [product] = await tx.insert(productsTable).values({
      ...productData,
      priceSale: emptyToNull(productData.priceSale),
      priceWholesale: emptyToNull(productData.priceWholesale),
      priceWholesaleSale: emptyToNull(productData.priceWholesaleSale),
      collectionId: emptyToNull(productData.collectionId),
      crossSellId: emptyToNull(productData.crossSellId),
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
      await tx.insert(mediaLinksTable).values(
        images.map(i => ({
          assetId: i.assetId,
          entityType: 'PRODUCT' as const,
          entityId: product.id,
          colorId: i.colorId || null,
          role: 'GALLERY',
          sortOrder: i.sortOrder,
          altOverride: i.alt,
        }))
      );
    }

    if (cover?.assetId) {
      await tx.insert(mediaLinksTable).values({
        assetId: cover.assetId,
        entityType: 'PRODUCT',
        entityId: product.id,
        role: 'COVER',
        sortOrder: 0,
        altOverride: cover.alt || null,
      });
    }

    return product;
  });
}

export async function updateProductWithRelations(
  id: string,
  input: Partial<ProductWithRelationsInput>
) {
  return await db.transaction(async (tx) => {
    const { variants, images, cover, ...productData } = input;

    // Update product base
    if (Object.keys(productData).length > 0) {
      const updateData: Record<string, unknown> = { ...productData };
      if (productData.priceSale !== undefined) {
        updateData.priceSale = emptyToNull(productData.priceSale);
      }
      if (productData.priceWholesale !== undefined) {
        updateData.priceWholesale = emptyToNull(productData.priceWholesale);
      }
      if (productData.priceWholesaleSale !== undefined) {
        updateData.priceWholesaleSale = emptyToNull(productData.priceWholesaleSale);
      }
      if (productData.collectionId !== undefined) {
        updateData.collectionId = emptyToNull(productData.collectionId);
      }
      if (productData.crossSellId !== undefined) {
        updateData.crossSellId = emptyToNull(productData.crossSellId);
      }
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

    // Replace images: delete existing links, insert new
    if (images !== undefined) {
      await tx.delete(mediaLinksTable).where(and(
        eq(mediaLinksTable.entityType, 'PRODUCT'),
        eq(mediaLinksTable.entityId, id),
        eq(mediaLinksTable.role, 'GALLERY')
      ));
      if (images.length > 0) {
        await tx.insert(mediaLinksTable).values(
          images.map(i => ({
            assetId: i.assetId,
            entityType: 'PRODUCT' as const,
            entityId: id,
            colorId: i.colorId || null,
            role: 'GALLERY',
            sortOrder: i.sortOrder,
            altOverride: i.alt,
          }))
        );
      }
    }

    // Replace cover: delete existing link, insert new
    if (cover !== undefined) {
      await tx.delete(mediaLinksTable).where(and(
        eq(mediaLinksTable.entityType, 'PRODUCT'),
        eq(mediaLinksTable.entityId, id),
        eq(mediaLinksTable.role, 'COVER')
      ));
      if (cover?.assetId) {
        await tx.insert(mediaLinksTable).values({
          assetId: cover.assetId,
          entityType: 'PRODUCT',
          entityId: id,
          role: 'COVER',
          sortOrder: 0,
          altOverride: cover.alt || null,
        });
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

export async function getAdminLeadById(id: string) {
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id)).limit(1);
  return lead ?? null;
}

// ── Brands ──

export async function getAdminBrands() {
  const brands = await db.select().from(brandsTable).orderBy(asc(brandsTable.sortOrder));
  const logoMap = await getSingleLinksUrlMap('BRAND', brands.map((b) => b.id), 'LOGO');
  return brands.map((b) => ({ ...b, logoUrl: logoMap.get(b.id) ?? null }));
}

export async function createBrand(data: typeof brandsTable.$inferInsert, logoAssetId?: string) {
  const [brand] = await db.insert(brandsTable).values(data).returning();
  if (logoAssetId) await replaceSingleLink('BRAND', brand.id, 'LOGO', logoAssetId);
  return brand;
}

export async function updateBrand(id: string, data: Partial<typeof brandsTable.$inferInsert>, logoAssetId?: string) {
  let brand: typeof brandsTable.$inferSelect | undefined;
  if (Object.keys(data).length > 0) {
    [brand] = await db.update(brandsTable).set(data).where(eq(brandsTable.id, id)).returning();
  } else {
    [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, id)).limit(1);
  }
  if (logoAssetId !== undefined) await replaceSingleLink('BRAND', id, 'LOGO', logoAssetId);
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
  const banners = await db.select().from(bannersTable).orderBy(asc(bannersTable.sortOrder));
  const bannerIds = banners.map((b) => b.id);
  const [desktopMap, mobileMap] = await Promise.all([
    getSingleLinksMediaMap('BANNER', bannerIds, 'DESKTOP'),
    getSingleLinksMediaMap('BANNER', bannerIds, 'MOBILE'),
  ]);
  return banners.map((b) => {
    const desktop = desktopMap.get(b.id);
    const mobile = mobileMap.get(b.id);
    return {
      ...b,
      imageDesktop: desktop?.url ?? null,
      imageDesktopMimeType: desktop?.mimeType ?? null,
      imageDesktopPreviewStart: desktop?.previewStartSeconds ?? null,
      imageDesktopPreviewDuration: desktop?.previewDurationSeconds ?? null,
      imageMobile: mobile?.url ?? null,
      imageMobileMimeType: mobile?.mimeType ?? null,
      imageMobilePreviewStart: mobile?.previewStartSeconds ?? null,
      imageMobilePreviewDuration: mobile?.previewDurationSeconds ?? null,
    };
  });
}

export async function createBanner(data: typeof bannersTable.$inferInsert, desktopAssetId?: string, mobileAssetId?: string) {
  const [banner] = await db.insert(bannersTable).values(data).returning();
  if (desktopAssetId) await replaceSingleLink('BANNER', banner.id, 'DESKTOP', desktopAssetId);
  if (mobileAssetId) await replaceSingleLink('BANNER', banner.id, 'MOBILE', mobileAssetId);
  return banner;
}

export async function updateBanner(id: string, data: Partial<typeof bannersTable.$inferInsert>, desktopAssetId?: string, mobileAssetId?: string) {
  let banner: typeof bannersTable.$inferSelect | undefined;
  if (Object.keys(data).length > 0) {
    [banner] = await db.update(bannersTable).set(data).where(eq(bannersTable.id, id)).returning();
  } else {
    [banner] = await db.select().from(bannersTable).where(eq(bannersTable.id, id)).limit(1);
  }
  if (desktopAssetId !== undefined) await replaceSingleLink('BANNER', id, 'DESKTOP', desktopAssetId);
  if (mobileAssetId !== undefined) await replaceSingleLink('BANNER', id, 'MOBILE', mobileAssetId);
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

/** Listado liviano de productos activos (id/nombre/marca) — usado por el selector de ámbito
 * "Producto específico" del panel de reglas, que necesita elegir cualquier producto activo sin
 * cargar variantes/imágenes (a diferencia de `getAdminProducts`, pensado para el listado completo). */
export async function getAdminProductsLite() {
  return db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      brandName: sql<string>`COALESCE(${brandsTable.name}, '')`,
    })
    .from(productsTable)
    .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .where(eq(productsTable.isActive, true))
    .orderBy(asc(productsTable.name));
}

// ── Corporate Sets (Sets Corporativos) ──

/** Existencia y estado activo de un conjunto de sets por id — usado por la validación de
 * conflictos de PROMO COMBO (`triggerSetId`/`targetSetId`), que necesita datos reales de BD
 * y por eso vive en la capa de rutas, no en `rules-engine/conflicts.ts` (módulo puro). */
export async function getSetActiveStatusByIds(ids: string[]): Promise<Map<string, boolean>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: corporateSetsTable.id, isActive: corporateSetsTable.isActive })
    .from(corporateSetsTable)
    .where(and(inArray(corporateSetsTable.id, ids), isNull(corporateSetsTable.deletedAt)));
  return new Map(rows.map((r) => [r.id, r.isActive ?? false]));
}

/**
 * Verifica que `triggerSetId`/`targetSetId` de una PROMO COMBO existan y estén activos —
 * requiere BD, así que vive aquí (capa de datos del panel admin) y no en
 * `rules-engine/conflicts.ts`, que es un módulo puro sin acceso a base de datos (ver comentario
 * de límite de diseño en ese archivo). Se llama solo cuando `candidate.ruleType === 'PROMO'` y
 * `config.kind === 'COMBO'`. Vive fuera de `rule-config-schemas.ts` porque ese módulo lo importa
 * también `RuleForm.tsx` (componente cliente) — traer `db` ahí rompería el bundle del navegador.
 */
export async function checkComboSetsExist(candidate: BusinessRule): Promise<RuleConflict[]> {
  const config = candidate.config as { triggerSetId?: string; targetSetId?: string };
  const ids = [config.triggerSetId, config.targetSetId].filter((id): id is string => !!id);
  if (ids.length === 0) return [];

  const statusById = await getSetActiveStatusByIds(ids);
  const conflicts: RuleConflict[] = [];

  if (config.triggerSetId && !statusById.has(config.triggerSetId)) {
    conflicts.push({ severity: 'ERROR', code: 'COMBO_SET_NOT_FOUND', message: 'El set disparador de este combo ya no existe.' });
  } else if (config.triggerSetId && statusById.get(config.triggerSetId) === false) {
    conflicts.push({ severity: 'ERROR', code: 'COMBO_SET_INACTIVE', message: 'El set disparador de este combo está inactivo.' });
  }

  if (config.targetSetId && !statusById.has(config.targetSetId)) {
    conflicts.push({ severity: 'ERROR', code: 'COMBO_SET_NOT_FOUND', message: 'El set objetivo de este combo ya no existe.' });
  } else if (config.targetSetId && statusById.get(config.targetSetId) === false) {
    conflicts.push({ severity: 'ERROR', code: 'COMBO_SET_INACTIVE', message: 'El set objetivo de este combo está inactivo.' });
  }

  return conflicts;
}

export async function getAdminSets() {
  const rows = await db
    .select({
      id: corporateSetsTable.id,
      name: corporateSetsTable.name,
      slug: corporateSetsTable.slug,
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
    .where(isNull(corporateSetsTable.deletedAt))
    .orderBy(asc(corporateSetsTable.sortOrder));

  const setIds = rows.map(r => r.id);
  const [itemCounts, coverMap, setProducts] = await Promise.all([
    setIds.length > 0
      ? db
          .select({ setId: setItemsTable.setId, count: sql<number>`count(*)` })
          .from(setItemsTable)
          .where(inArray(setItemsTable.setId, setIds))
          .groupBy(setItemsTable.setId)
      : Promise.resolve([]),
    getSingleLinksUrlMap('SET', setIds, 'COVER'),
    setIds.length > 0
      ? db
          .select({
            setId: setItemsTable.setId,
            productId: setItemsTable.productId,
            productName: productsTable.name,
            productSlug: productsTable.slug,
          })
          .from(setItemsTable)
          .innerJoin(productsTable, eq(setItemsTable.productId, productsTable.id))
          .where(inArray(setItemsTable.setId, setIds))
          .orderBy(asc(setItemsTable.sortOrder))
      : Promise.resolve([]),
  ]);

  const productIds = setProducts.map(sp => sp.productId);
  const productCovers = await getProductCoversMap(productIds);

  const countMap = new Map(itemCounts.map(c => [c.setId, Number(c.count)]));
  
  // Group products by set ID
  const productsBySetMap = new Map<
    string,
    {
      productId: string;
      name: string | null;
      slug: string;
      imageUrl: string | null;
      mimeType: string | null;
      previewStart: number | null;
      previewDuration: number | null;
    }[]
  >();
  for (const item of setProducts) {
    const list = productsBySetMap.get(item.setId) || [];
    const cover = productCovers.get(item.productId);
    list.push({
      productId: item.productId,
      name: item.productName,
      slug: item.productSlug,
      imageUrl: cover?.url ?? null,
      mimeType: cover?.mimeType ?? null,
      previewStart: cover?.previewStart ?? null,
      previewDuration: cover?.previewDuration ?? null,
    });
    productsBySetMap.set(item.setId, list);
  }

  return rows.map(r => ({
    ...r,
    itemCount: countMap.get(r.id) ?? 0,
    imageUrl: coverMap.get(r.id) ?? null,
    items: productsBySetMap.get(r.id) || [],
  }));
}


export async function getAdminSetById(id: string) {
  const [set] = await db.select().from(corporateSetsTable).where(eq(corporateSetsTable.id, id)).limit(1);
  if (!set) return null;

  const [items, coverResult] = await Promise.all([
    db
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
      .orderBy(asc(setItemsTable.sortOrder)),
    db
      .select({
        id: mediaLinksTable.id,
        assetId: mediaLinksTable.assetId,
        url: sql<string>`concat(${sql.raw("'" + process.env.R2_PUBLIC_URL + "/'")}, ${mediaAssetsTable.storageKey})`,
        storageKey: mediaAssetsTable.storageKey,
        mimeType: mediaAssetsTable.mimeType,
        alt: mediaLinksTable.altOverride,
      })
      .from(mediaLinksTable)
      .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
      .where(and(
        eq(mediaLinksTable.entityType, 'SET'),
        eq(mediaLinksTable.entityId, id),
        eq(mediaLinksTable.role, 'COVER')
      ))
      .limit(1),
  ]);

  const cover = coverResult[0] || null;
  const imageUrl = await getSingleLinkUrl('SET', id, 'COVER');

  return { ...set, cover, imageUrl, items };
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
  coverAssetId?: string;
  setGroupId?: string | null;
  brandId?: string | null;
  isActive?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
  /** Precio manual del set (override) — `undefined`/ausente no toca el valor guardado;
   * `null` lo apaga explícitamente y vuelve a la suma automática de piezas. */
  priceManual?: string | null;
  priceManualSale?: string | null;
  manualDiscountEnd?: string | null;
  items?: SetItemInput[];
}

export async function createSetWithItems(input: CorporateSetInput) {
  const { items = [], coverAssetId, manualDiscountEnd, ...setData } = input;

  const set = await db.transaction(async (tx) => {
    const [set] = await tx.insert(corporateSetsTable).values({
      ...setData,
      manualDiscountEnd: manualDiscountEnd ? new Date(manualDiscountEnd) : undefined,
    }).returning();

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

  if (coverAssetId) await replaceSingleLink('SET', set.id, 'COVER', coverAssetId);
  return set;
}

export async function updateSetWithItems(id: string, input: Partial<CorporateSetInput>) {
  const { items, coverAssetId, manualDiscountEnd, ...setData } = input;

  const set = await db.transaction(async (tx) => {
    if (Object.keys(setData).length > 0 || manualDiscountEnd !== undefined) {
      await tx.update(corporateSetsTable).set({
        ...setData,
        ...(manualDiscountEnd !== undefined
          ? { manualDiscountEnd: manualDiscountEnd ? new Date(manualDiscountEnd) : null }
          : {}),
      }).where(eq(corporateSetsTable.id, id));
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

  if (coverAssetId !== undefined) await replaceSingleLink('SET', id, 'COVER', coverAssetId);
  return set;
}

export async function softDeleteSet(id: string) {
  await db
    .update(corporateSetsTable)
    .set({ deletedAt: new Date() })
    .where(eq(corporateSetsTable.id, id));
}

export async function restoreSet(id: string) {
  await db
    .update(corporateSetsTable)
    .set({ deletedAt: null })
    .where(eq(corporateSetsTable.id, id));
}

export async function permanentlyDeleteSet(id: string) {
  await db.transaction(async (tx) => {
    // 1. Eliminar relaciones set-piezas
    await tx.delete(setItemsTable).where(eq(setItemsTable.setId, id));
    // 2. Eliminar vínculos de medios polimórficos de tipo SET
    await tx.delete(mediaLinksTable).where(and(
      eq(mediaLinksTable.entityType, 'SET'),
      eq(mediaLinksTable.entityId, id)
    ));
    // 3. Eliminar reglas de negocio asociadas a este set
    await tx.delete(businessRulesTable).where(and(
      eq(businessRulesTable.scope, 'SET'),
      eq(businessRulesTable.scopeId, id)
    ));
    // 4. Eliminar el set corporativo propiamente dicho
    await tx.delete(corporateSetsTable).where(eq(corporateSetsTable.id, id));
  });
}

export async function getTrashedSets() {
  const rows = await db
    .select({
      id: corporateSetsTable.id,
      name: corporateSetsTable.name,
      slug: corporateSetsTable.slug,
      setGroupId: corporateSetsTable.setGroupId,
      groupName: setGroupsTable.name,
      brandId: corporateSetsTable.brandId,
      brandName: brandsTable.name,
      isActive: corporateSetsTable.isActive,
      isFeatured: corporateSetsTable.isFeatured,
      sortOrder: corporateSetsTable.sortOrder,
      deletedAt: corporateSetsTable.deletedAt,
    })
    .from(corporateSetsTable)
    .leftJoin(setGroupsTable, eq(corporateSetsTable.setGroupId, setGroupsTable.id))
    .leftJoin(brandsTable, eq(corporateSetsTable.brandId, brandsTable.id))
    .where(isNotNull(corporateSetsTable.deletedAt))
    .orderBy(desc(corporateSetsTable.deletedAt));

  const setIds = rows.map(r => r.id);
  const [itemCounts, coverMap] = await Promise.all([
    setIds.length > 0
      ? db
          .select({ setId: setItemsTable.setId, count: sql<number>`count(*)` })
          .from(setItemsTable)
          .where(inArray(setItemsTable.setId, setIds))
          .groupBy(setItemsTable.setId)
      : Promise.resolve([]),
    getSingleLinksUrlMap('SET', setIds, 'COVER'),
  ]);

  const countMap = new Map(itemCounts.map(c => [c.setId, Number(c.count)]));

  return rows.map(r => ({
    ...r,
    itemCount: countMap.get(r.id) ?? 0,
    imageUrl: coverMap.get(r.id) ?? null,
  }));
}


interface ProductCoverInfo {
  url: string;
  mimeType: string;
  previewStart: number | null;
  previewDuration: number | null;
}

async function getProductCoversMap(productIds: string[]): Promise<Map<string, ProductCoverInfo>> {
  if (productIds.length === 0) return new Map();
  const links = await db
    .select({
      entityId: mediaLinksTable.entityId,
      role: mediaLinksTable.role,
      storageKey: mediaAssetsTable.storageKey,
      mimeType: mediaAssetsTable.mimeType,
      previewStart: mediaAssetsTable.previewStartSeconds,
      previewDuration: mediaAssetsTable.previewDurationSeconds,
      sortOrder: mediaLinksTable.sortOrder,
    })
    .from(mediaLinksTable)
    .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
    .where(and(
      eq(mediaLinksTable.entityType, 'PRODUCT'),
      inArray(mediaLinksTable.role, ['COVER', 'GALLERY']),
      inArray(mediaLinksTable.entityId, productIds)
    ));

  const coverMap = new Map<string, ProductCoverInfo>();
  const linksByProduct = new Map<string, typeof links>();
  for (const link of links) {
    if (!linksByProduct.has(link.entityId)) {
      linksByProduct.set(link.entityId, []);
    }
    linksByProduct.get(link.entityId)!.push(link);
  }

  for (const productId of productIds) {
    const productLinks = linksByProduct.get(productId) || [];
    const coverLink = productLinks.find((l) => l.role === 'COVER');
    const chosen = coverLink ?? productLinks
      .filter((l) => l.role === 'GALLERY')
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0];
    if (chosen) {
      coverMap.set(productId, {
        url: resolveMediaUrl(chosen.storageKey),
        mimeType: chosen.mimeType,
        previewStart: chosen.previewStart,
        previewDuration: chosen.previewDuration,
      });
    }
  }

  return coverMap;
}

// ── Productos disponibles para armar sets (visibility GROUPS o BOTH) ──

/**
 * Productos elegibles como pieza de un set (visibility GROUPS o BOTH), con el resumen de
 * variantes (colores/tallas) y la portada — usado por el selector con búsqueda del ensamblador
 * de sets para mostrar advertencias inline sin consultas adicionales por pieza.
 */
export async function getGroupEligibleProducts() {
  const products = await db
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

  const productIds = products.map((p) => p.id);
  if (productIds.length === 0) return [];

  const [variants, coverMap] = await Promise.all([
    db
      .select({
        productId: variantsTable.productId,
        size: variantsTable.size,
        status: variantsTable.status,
        colorId: colorsTable.id,
        colorName: colorsTable.name,
        colorHex: colorsTable.hex,
      })
      .from(variantsTable)
      .leftJoin(colorsTable, eq(variantsTable.colorId, colorsTable.id))
      .where(inArray(variantsTable.productId, productIds)),
    getProductCoversMap(productIds),
  ]);

  return products.map((p) => {
    const productVariants = variants.filter((v) => v.productId === p.id);
    const colorMap = new Map<string, { id: string; name: string; hex: string }>();
    const sizeSet = new Set<string>();
    let hasActiveVariant = false;
    for (const v of productVariants) {
      if (v.colorId && !colorMap.has(v.colorId)) {
        colorMap.set(v.colorId, { id: v.colorId, name: v.colorName ?? '', hex: v.colorHex ?? '' });
      }
      sizeSet.add(v.size);
      if (v.status === 'AVAILABLE') hasActiveVariant = true;
    }
    return {
      ...p,
      imageUrl: coverMap.get(p.id)?.url ?? null,
      colors: Array.from(colorMap.values()),
      sizes: Array.from(sizeSet),
      hasActiveVariant,
    };
  });
}


// ── Cotizaciones: ver src/lib/quotes/service.ts (CRUD completo del módulo Cotizaciones Pro) ──

// ── Corporate Accounts (Cuentas Corporativas) ──

export async function getAdminCorporateAccounts(status?: string) {
  const where = status ? eq(corporateAccountsTable.status, status) : undefined;
  return db.select().from(corporateAccountsTable).where(where).orderBy(desc(corporateAccountsTable.createdAt));
}

export async function getAdminCorporateAccountById(id: string) {
  const [account] = await db.select().from(corporateAccountsTable).where(eq(corporateAccountsTable.id, id)).limit(1);
  return account ?? null;
}

export async function updateCorporateAccountStatus(
  id: string,
  status: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
  approvedBy: string
) {
  const [account] = await db
    .update(corporateAccountsTable)
    .set({
      status,
      approvedBy,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(corporateAccountsTable.id, id))
    .returning();
  return account;
}

// ── Business Rules (Motor de Reglas) ──

export async function getAdminRules(filters?: { ruleType?: string; scope?: string }) {
  const conditions: SQL[] = [];
  if (filters?.ruleType) conditions.push(eq(businessRulesTable.ruleType, filters.ruleType));
  if (filters?.scope) conditions.push(eq(businessRulesTable.scope, filters.scope));

  return db
    .select()
    .from(businessRulesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(businessRulesTable.priority), desc(businessRulesTable.createdAt));
}

export async function getAdminRuleById(id: string) {
  const [rule] = await db.select().from(businessRulesTable).where(eq(businessRulesTable.id, id)).limit(1);
  return rule ?? null;
}

export async function createRule(data: {
  name: string;
  ruleType: string;
  scope: string;
  scopeId: string | null;
  config: unknown;
  priority?: number;
  validFrom?: Date | null;
  validTo?: Date | null;
}) {
  const [rule] = await db.insert(businessRulesTable).values(data).returning();
  return rule;
}

export async function updateRule(
  id: string,
  changes: Partial<{
    name: string;
    scope: string;
    scopeId: string | null;
    config: unknown;
    isActive: boolean;
    priority: number;
    validFrom: Date | null;
    validTo: Date | null;
  }>
) {
  const [rule] = await db
    .update(businessRulesTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(businessRulesTable.id, id))
    .returning();
  return rule;
}

export async function deleteRule(id: string) {
  await db.delete(businessRulesTable).where(eq(businessRulesTable.id, id));
}

import { db } from '@/db';
import {
  corporateSets as corporateSetsTable,
  setGroups as setGroupsTable,
  setItems as setItemsTable,
  products as productsTable,
  brands as brandsTable,
  colors as colorsTable,
  productVariants as variantsTable,
  businessRules as businessRulesTable,
  corporateAccounts as corporateAccountsTable,
  quoteRequests as quoteRequestsTable,
  quoteAttachments as quoteAttachmentsTable,
} from '@/db/schema';
import { eq, and, inArray, asc, desc } from 'drizzle-orm';
import type { BusinessRule } from './rules-engine';
import type { CorporateSetSummary, CorporateSetDetail, SetPiece, SetGroupSummary } from './corporate-types';
import type { ProductColor, ProductVariant } from './types';

function wholesalePriceOf(priceWholesale: string | null, priceWholesaleSale: string | null): number | null {
  if (priceWholesaleSale) return Number(priceWholesaleSale);
  if (priceWholesale) return Number(priceWholesale);
  return null;
}

// ── Todas las reglas de negocio activas (para el motor de reglas) ──
export async function getAllBusinessRules(): Promise<BusinessRule[]> {
  const rows = await db.select().from(businessRulesTable).where(eq(businessRulesTable.isActive, true));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    ruleType: r.ruleType as BusinessRule['ruleType'],
    scope: r.scope as BusinessRule['scope'],
    scopeId: r.scopeId,
    config: r.config as Record<string, unknown>,
    isActive: r.isActive ?? true,
    priority: r.priority ?? 0,
    validFrom: r.validFrom,
    validTo: r.validTo,
  }));
}

export async function getActiveSetGroups(): Promise<SetGroupSummary[]> {
  const rows = await db
    .select({ id: setGroupsTable.id, name: setGroupsTable.name, slug: setGroupsTable.slug })
    .from(setGroupsTable)
    .where(eq(setGroupsTable.isActive, true))
    .orderBy(asc(setGroupsTable.sortOrder));
  return rows;
}

// ── Grid público de sets activos ──
export async function getActiveCorporateSets(): Promise<CorporateSetSummary[]> {
  const rows = await db
    .select({
      id: corporateSetsTable.id,
      slug: corporateSetsTable.slug,
      name: corporateSetsTable.name,
      description: corporateSetsTable.description,
      imageUrl: corporateSetsTable.imageUrl,
      groupName: setGroupsTable.name,
      groupSlug: setGroupsTable.slug,
      brandName: brandsTable.name,
      isFeatured: corporateSetsTable.isFeatured,
      sortOrder: corporateSetsTable.sortOrder,
    })
    .from(corporateSetsTable)
    .leftJoin(setGroupsTable, eq(corporateSetsTable.setGroupId, setGroupsTable.id))
    .leftJoin(brandsTable, eq(corporateSetsTable.brandId, brandsTable.id))
    .where(eq(corporateSetsTable.isActive, true))
    .orderBy(asc(corporateSetsTable.sortOrder));

  const setIds = rows.map((r) => r.id);
  if (setIds.length === 0) return [];

  const items = await db
    .select({
      setId: setItemsTable.setId,
      quantityPerSet: setItemsTable.quantityPerSet,
      priceWholesale: productsTable.priceWholesale,
      priceWholesaleSale: productsTable.priceWholesaleSale,
    })
    .from(setItemsTable)
    .leftJoin(productsTable, eq(setItemsTable.productId, productsTable.id))
    .where(inArray(setItemsTable.setId, setIds));

  return rows.map((set) => {
    const setItems = items.filter((i) => i.setId === set.id);
    let referencePrice = 0;
    let hasMissingPrices = false;
    for (const item of setItems) {
      const price = wholesalePriceOf(item.priceWholesale, item.priceWholesaleSale);
      if (price === null) {
        hasMissingPrices = true;
        continue;
      }
      referencePrice += price * (item.quantityPerSet ?? 1);
    }
    return {
      id: set.id,
      slug: set.slug,
      name: set.name,
      description: set.description,
      imageUrl: set.imageUrl,
      groupName: set.groupName,
      groupSlug: set.groupSlug,
      brandName: set.brandName,
      isFeatured: set.isFeatured ?? false,
      pieceCount: setItems.length,
      referencePrice: setItems.length > 0 ? referencePrice : null,
      hasMissingPrices,
    };
  });
}

// ── Detalle de un set (para /corporativo/s/[slug]) ──
export async function getCorporateSetBySlug(slug: string): Promise<CorporateSetDetail | null> {
  const [set] = await db
    .select({
      id: corporateSetsTable.id,
      slug: corporateSetsTable.slug,
      name: corporateSetsTable.name,
      description: corporateSetsTable.description,
      imageUrl: corporateSetsTable.imageUrl,
      setGroupId: corporateSetsTable.setGroupId,
      brandId: corporateSetsTable.brandId,
      groupName: setGroupsTable.name,
      groupSlug: setGroupsTable.slug,
      brandName: brandsTable.name,
      isFeatured: corporateSetsTable.isFeatured,
    })
    .from(corporateSetsTable)
    .leftJoin(setGroupsTable, eq(corporateSetsTable.setGroupId, setGroupsTable.id))
    .leftJoin(brandsTable, eq(corporateSetsTable.brandId, brandsTable.id))
    .where(and(eq(corporateSetsTable.slug, slug), eq(corporateSetsTable.isActive, true)))
    .limit(1);

  if (!set) return null;

  const items = await db
    .select({
      setItemId: setItemsTable.id,
      productId: setItemsTable.productId,
      quantityPerSet: setItemsTable.quantityPerSet,
      sortOrder: setItemsTable.sortOrder,
      productName: productsTable.name,
      productSlug: productsTable.slug,
      priceWholesale: productsTable.priceWholesale,
      priceWholesaleSale: productsTable.priceWholesaleSale,
    })
    .from(setItemsTable)
    .leftJoin(productsTable, eq(setItemsTable.productId, productsTable.id))
    .where(eq(setItemsTable.setId, set.id))
    .orderBy(asc(setItemsTable.sortOrder));

  const productIds = items.map((i) => i.productId);
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

  let referencePrice = 0;
  let hasMissingPrices = false;

  const pieces: SetPiece[] = items.map((item) => {
    const price = wholesalePriceOf(item.priceWholesale, item.priceWholesaleSale);
    if (price === null) {
      hasMissingPrices = true;
    } else {
      referencePrice += price * (item.quantityPerSet ?? 1);
    }

    const productVariants = variants.filter((v) => v.productId === item.productId);
    const colorMap = new Map<string, ProductColor>();
    const sizeSet = new Set<string>();
    for (const v of productVariants) {
      if (!colorMap.has(v.colorId)) {
        colorMap.set(v.colorId, { id: v.colorId, name: v.colorName || '', code: v.colorCode || '', hex: v.colorHex || '' });
      }
      sizeSet.add(v.size);
    }

    const mappedVariants: ProductVariant[] = productVariants.map((v) => ({
      id: v.id,
      sku: v.sku,
      colorId: v.colorId,
      size: v.size as ProductVariant['size'],
      fit: (v.fit as ProductVariant['fit']) || undefined,
      images: [],
      status: v.status as ProductVariant['status'],
    }));

    return {
      setItemId: item.setItemId,
      productId: item.productId!,
      productName: item.productName || '',
      productSlug: item.productSlug || '',
      quantityPerSet: item.quantityPerSet ?? 1,
      priceWholesale: item.priceWholesale ? Number(item.priceWholesale) : null,
      priceWholesaleSale: item.priceWholesaleSale ? Number(item.priceWholesaleSale) : null,
      colors: Array.from(colorMap.values()),
      availableSizes: Array.from(sizeSet),
      variants: mappedVariants,
    };
  });

  return {
    id: set.id,
    slug: set.slug,
    name: set.name,
    description: set.description,
    imageUrl: set.imageUrl,
    setGroupId: set.setGroupId,
    brandId: set.brandId,
    groupName: set.groupName,
    groupSlug: set.groupSlug,
    brandName: set.brandName,
    isFeatured: set.isFeatured ?? false,
    pieceCount: pieces.length,
    referencePrice: pieces.length > 0 ? referencePrice : null,
    hasMissingPrices,
    pieces,
  };
}

// ── Precios de sets por ID (para calcular pricing del carrito en servidor) ──
export async function getSetPricesByIds(setIds: string[]): Promise<Record<string, { pricePerSet: number; hasMissingPrices: boolean }>> {
  if (setIds.length === 0) return {};

  const items = await db
    .select({
      setId: setItemsTable.setId,
      quantityPerSet: setItemsTable.quantityPerSet,
      priceWholesale: productsTable.priceWholesale,
      priceWholesaleSale: productsTable.priceWholesaleSale,
    })
    .from(setItemsTable)
    .leftJoin(productsTable, eq(setItemsTable.productId, productsTable.id))
    .where(inArray(setItemsTable.setId, setIds));

  const result: Record<string, { pricePerSet: number; hasMissingPrices: boolean }> = {};
  for (const setId of setIds) {
    const setItems = items.filter((i) => i.setId === setId);
    let pricePerSet = 0;
    let hasMissingPrices = false;
    for (const item of setItems) {
      const price = wholesalePriceOf(item.priceWholesale, item.priceWholesaleSale);
      if (price === null) {
        hasMissingPrices = true;
        continue;
      }
      pricePerSet += price * (item.quantityPerSet ?? 1);
    }
    result[setId] = { pricePerSet, hasMissingPrices };
  }
  return result;
}

// ── Metadata de sets (setGroupId, brandId) para el motor de reglas ──
export async function getSetMetaByIds(setIds: string[]): Promise<Record<string, { setGroupId: string | null; brandId: string | null }>> {
  if (setIds.length === 0) return {};
  const rows = await db
    .select({ id: corporateSetsTable.id, setGroupId: corporateSetsTable.setGroupId, brandId: corporateSetsTable.brandId })
    .from(corporateSetsTable)
    .where(inArray(corporateSetsTable.id, setIds));
  return Object.fromEntries(rows.map((r) => [r.id, { setGroupId: r.setGroupId, brandId: r.brandId }]));
}

// ── Portal del cliente corporativo ──

export async function getCorporateAccountByUserId(userId: string) {
  const [account] = await db
    .select()
    .from(corporateAccountsTable)
    .where(eq(corporateAccountsTable.userId, userId))
    .limit(1);
  return account ?? null;
}

export async function getQuoteRequestsByAccountId(accountId: string) {
  const quotes = await db
    .select()
    .from(quoteRequestsTable)
    .where(eq(quoteRequestsTable.accountId, accountId))
    .orderBy(desc(quoteRequestsTable.createdAt));

  const quoteIds = quotes.map((q) => q.id);
  const attachments = quoteIds.length > 0
    ? await db.select().from(quoteAttachmentsTable).where(inArray(quoteAttachmentsTable.quoteId, quoteIds))
    : [];

  return quotes.map((q) => ({
    ...q,
    attachments: attachments.filter((a) => a.quoteId === q.id),
  }));
}

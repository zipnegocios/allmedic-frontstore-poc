import { db } from '@/db';
import {
  corporateSets as corporateSetsTable,
  setBlocks as setBlocksTable,
  setBlockOptions as setBlockOptionsTable,
  setRecommendedItems as setRecommendedItemsTable,
  setColorCombos as setColorCombosTable,
  setColorComboItems as setColorComboItemsTable,
  products as productsTable,
  brands as brandsTable,
  colors as colorsTable,
  productVariants as variantsTable,
  productTypes as productTypesTable,
  businessRules as businessRulesTable,
  corporateAccounts as corporateAccountsTable,
  quotes as quotesTable,
  quoteDocuments as quoteDocumentsTable,
  mediaLinks as mediaLinksTable,
  mediaAssets as mediaAssetsTable,
} from '@/db/schema';
import { eq, and, inArray, asc, desc, isNotNull, isNull } from 'drizzle-orm';
import type { BusinessRule, SetPieceInfo } from './rules-engine';
import type { CorporateSetSummary, CorporateSetDetail, SetPiece, SetBlock } from './corporate-types';
import type { ProductColor, ProductVariant, Gender } from './types';
import { resolveMediaUrl, isVideoMime, type MediaItem } from './media';
import { effectiveManualPrice } from './set-pricing';
import { genderFromDb, CORTE_ATTRIBUTE_SLUG } from './data-service';
import type { AttributesPayload } from './attributes-payload/build-payload';

/** Portadas primaria+secundaria de sets (paridad con productos) — mismo patrón
 * de `mapDbProductToProduct` en `data-service.ts`: `MediaItem` con `type`
 * derivado de `mimeType` para que el hover-swap público soporte video. */
async function getCoverMediaMap(setIds: string[]): Promise<Map<string, { cover: MediaItem; secondaryCover?: MediaItem }>> {
  if (setIds.length === 0) return new Map();
  const links = await db
    .select({
      setId: mediaLinksTable.entityId,
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
      eq(mediaLinksTable.entityType, 'SET'),
      inArray(mediaLinksTable.role, ['COVER', 'COVER_SECONDARY']),
      inArray(mediaLinksTable.entityId, setIds)
    ));

  const coverBySet = new Map<string, MediaItem>();
  const secondaryBySet = new Map<string, MediaItem>();
  for (const l of links) {
    const item: MediaItem = {
      url: resolveMediaUrl(l.storageKey),
      type: isVideoMime(l.mimeType) ? 'video' : 'image',
      mimeType: l.mimeType,
      width: l.width,
      height: l.height,
      durationSeconds: l.durationSeconds,
      previewStartSeconds: l.previewStartSeconds,
      previewDurationSeconds: l.previewDurationSeconds,
    };
    if (l.role === 'COVER') coverBySet.set(l.setId, item);
    else secondaryBySet.set(l.setId, item);
  }

  const map = new Map<string, { cover: MediaItem; secondaryCover?: MediaItem }>();
  for (const [setId, cover] of coverBySet) {
    map.set(setId, { cover, secondaryCover: secondaryBySet.get(setId) });
  }
  return map;
}

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

// ── Grid público de sets activos ──
export async function getActiveCorporateSets(): Promise<CorporateSetSummary[]> {
  const rows = await db
    .select({
      id: corporateSetsTable.id,
      slug: corporateSetsTable.slug,
      name: corporateSetsTable.name,
      description: corporateSetsTable.description,
      brandName: brandsTable.name,
      brandId: corporateSetsTable.brandId,
      isFeatured: corporateSetsTable.isFeatured,
      sortOrder: corporateSetsTable.sortOrder,
      priceManual: corporateSetsTable.priceManual,
      priceManualSale: corporateSetsTable.priceManualSale,
      manualDiscountEnd: corporateSetsTable.manualDiscountEnd,
      createdAt: corporateSetsTable.createdAt,
    })
    .from(corporateSetsTable)
    .leftJoin(brandsTable, eq(corporateSetsTable.brandId, brandsTable.id))
    .where(and(eq(corporateSetsTable.isActive, true), isNull(corporateSetsTable.deletedAt)))
    .orderBy(asc(corporateSetsTable.sortOrder));

  const setIds = rows.map((r) => r.id);
  if (setIds.length === 0) return [];

  // Bloques del set (siempre 2) con sus opciones (siempre 2 cada uno) — el grid agrega
  // colores/tallas/estilos/precio a través de TODAS las opciones cargadas, no solo la
  // primera de cada bloque, porque el "Desde $X" y los filtros deben reflejar toda la
  // composición posible del set.
  const blocks = await db
    .select({ id: setBlocksTable.id, setId: setBlocksTable.setId, quantityPerSet: setBlocksTable.quantityPerSet })
    .from(setBlocksTable)
    .where(inArray(setBlocksTable.setId, setIds));
  const blockIds = blocks.map((b) => b.id);
  const quantityPerBlock = new Map(blocks.map((b) => [b.id, b.quantityPerSet ?? 1]));
  const setIdByBlockId = new Map(blocks.map((b) => [b.id, b.setId]));

  const options = blockIds.length > 0
    ? await db
        .select({
          blockId: setBlockOptionsTable.blockId,
          productId: setBlockOptionsTable.productId,
          priceWholesale: productsTable.priceWholesale,
          priceWholesaleSale: productsTable.priceWholesaleSale,
          productName: productsTable.name,
          productTypeId: productsTable.productTypeId,
          productTypeName: productTypesTable.name,
          gender: productsTable.gender,
        })
        .from(setBlockOptionsTable)
        .leftJoin(productsTable, eq(setBlockOptionsTable.productId, productsTable.id))
        .leftJoin(productTypesTable, eq(productsTable.productTypeId, productTypesTable.id))
        .where(inArray(setBlockOptionsTable.blockId, blockIds))
    : [];

  const items = options.map((o) => ({
    setId: setIdByBlockId.get(o.blockId)!,
    productId: o.productId,
    quantityPerSet: quantityPerBlock.get(o.blockId) ?? 1,
    priceWholesale: o.priceWholesale,
    priceWholesaleSale: o.priceWholesaleSale,
    productName: o.productName,
    productTypeId: o.productTypeId,
    productTypeName: o.productTypeName,
    gender: o.gender,
  }));

  const recommendedRows = await db
    .select({ setId: setRecommendedItemsTable.setId })
    .from(setRecommendedItemsTable)
    .where(inArray(setRecommendedItemsTable.setId, setIds));
  const setsWithRecommended = new Set(recommendedRows.map((r) => r.setId));

  const productIds = Array.from(new Set(items.map((i) => i.productId).filter((id): id is string => !!id)));

  // Solo variantes activas ("sin opción muerta") alimentan colores/tallas/cortes/estilos agregados.
  const variants = productIds.length > 0
    ? await db
        .select({
          productId: variantsTable.productId,
          colorId: variantsTable.colorId,
          size: variantsTable.size,
          colorName: colorsTable.name,
          colorCode: colorsTable.code,
          colorHex: colorsTable.hex,
          attributesPayload: variantsTable.attributesPayload,
        })
        .from(variantsTable)
        .leftJoin(colorsTable, eq(variantsTable.colorId, colorsTable.id))
        .where(and(inArray(variantsTable.productId, productIds), eq(variantsTable.status, 'AVAILABLE')))
    : [];

  const coverMedia = await getCoverMediaMap(setIds);
  const blocksBySet = new Map<string, typeof blocks>();
  for (const b of blocks) {
    if (!blocksBySet.has(b.setId)) blocksBySet.set(b.setId, []);
    blocksBySet.get(b.setId)!.push(b);
  }
  const optionsByBlock = new Map<string, typeof options>();
  for (const o of options) {
    if (!optionsByBlock.has(o.blockId)) optionsByBlock.set(o.blockId, []);
    optionsByBlock.get(o.blockId)!.push(o);
  }

  return rows.map((set) => {
    const setItems = items.filter((i) => i.setId === set.id);
    const setBlockRows = blocksBySet.get(set.id) ?? [];

    // Precio "Desde $X" (Decisión 3): mínimo de cada bloque × su cantidad, sumado entre bloques.
    let autoPrice = 0;
    let hasMissingPrices = false;
    for (const block of setBlockRows) {
      const blockPrices = (optionsByBlock.get(block.id) ?? [])
        .map((o) => wholesalePriceOf(o.priceWholesale, o.priceWholesaleSale))
        .filter((p): p is number => p !== null);
      if (blockPrices.length === 0) {
        hasMissingPrices = true;
        continue;
      }
      autoPrice += Math.min(...blockPrices) * (block.quantityPerSet ?? 1);
    }
    const manualPrice = effectiveManualPrice(set.priceManual, set.priceManualSale, set.manualDiscountEnd);
    const referencePrice = manualPrice ?? autoPrice;
    if (manualPrice !== null) hasMissingPrices = false;

    const setProductIds = Array.from(new Set(setItems.map((i) => i.productId).filter((id): id is string => !!id)));
    const productTypes = Array.from(new Set(setItems.map((i) => i.productTypeName).filter((n): n is string => !!n)));
    const genders = Array.from(
      new Set(setItems.map((i) => (i.gender ? genderFromDb[i.gender] : undefined)).filter((g): g is Gender => !!g))
    );
    const pieceNames = Array.from(new Set(setItems.map((i) => i.productName).filter((n): n is string => !!n)));

    const setVariants = variants.filter((v) => setProductIds.includes(v.productId));
    const colorMap = new Map<string, ProductColor>();
    const sizeSet = new Set<string>();
    const stylesMap = new Map<string, Set<string>>();
    for (const v of setVariants) {
      if (v.colorId && !colorMap.has(v.colorId)) {
        colorMap.set(v.colorId, { id: v.colorId, name: v.colorName || '', code: v.colorCode || '', hex: v.colorHex || '' });
      }
      sizeSet.add(v.size);
      const payload = v.attributesPayload as AttributesPayload | null | undefined;
      if (payload?.styles) {
        for (const [slug, value] of Object.entries(payload.styles)) {
          if (!stylesMap.has(slug)) stylesMap.set(slug, new Set());
          stylesMap.get(slug)!.add(value);
        }
      }
    }
    const availableStyles: Record<string, string[]> = Object.fromEntries(
      Array.from(stylesMap.entries(), ([slug, values]) => [slug, Array.from(values)])
    );

    return {
      id: set.id,
      slug: set.slug,
      name: set.name,
      description: set.description,
      cover: coverMedia.get(set.id)?.cover ?? null,
      secondaryCover: coverMedia.get(set.id)?.secondaryCover ?? null,
      brandName: set.brandName,
      brandId: set.brandId,
      productIds: setProductIds,
      isFeatured: set.isFeatured ?? false,
      pieceCount: setBlockRows.length,
      hasRecommendedItems: setsWithRecommended.has(set.id),
      referencePrice: setBlockRows.length > 0 || manualPrice !== null ? referencePrice : null,
      hasMissingPrices,
      colors: Array.from(colorMap.values()),
      sizes: Array.from(sizeSet),
      genders,
      productTypes,
      availableStyles,
      pieceNames,
      createdAt: set.createdAt ? set.createdAt.toISOString() : new Date(0).toISOString(),
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
      brandId: corporateSetsTable.brandId,
      brandName: brandsTable.name,
      isFeatured: corporateSetsTable.isFeatured,
      priceManual: corporateSetsTable.priceManual,
      priceManualSale: corporateSetsTable.priceManualSale,
      manualDiscountEnd: corporateSetsTable.manualDiscountEnd,
      colorMode: corporateSetsTable.colorMode,
      createdAt: corporateSetsTable.createdAt,
    })
    .from(corporateSetsTable)
    .leftJoin(brandsTable, eq(corporateSetsTable.brandId, brandsTable.id))
    .where(and(
      eq(corporateSetsTable.slug, slug),
      eq(corporateSetsTable.isActive, true),
      isNull(corporateSetsTable.deletedAt)
    ))
    .limit(1);

  if (!set) return null;

  const blockRows = await db
    .select({ id: setBlocksTable.id, blockCode: setBlocksTable.blockCode, quantityPerSet: setBlocksTable.quantityPerSet })
    .from(setBlocksTable)
    .where(eq(setBlocksTable.setId, set.id))
    .orderBy(asc(setBlocksTable.blockCode));

  const blockIds = blockRows.map((b) => b.id);
  const quantityPerBlockId = new Map(blockRows.map((b) => [b.id, b.quantityPerSet ?? 1]));

  const optionRows = blockIds.length > 0
    ? await db
        .select({
          setItemId: setBlockOptionsTable.id,
          blockId: setBlockOptionsTable.blockId,
          productId: setBlockOptionsTable.productId,
          sortOrder: setBlockOptionsTable.sortOrder,
          productName: productsTable.name,
          productSlug: productsTable.slug,
          priceWholesale: productsTable.priceWholesale,
          priceWholesaleSale: productsTable.priceWholesaleSale,
          productTypeId: productsTable.productTypeId,
          productTypeName: productTypesTable.name,
          gender: productsTable.gender,
        })
        .from(setBlockOptionsTable)
        .leftJoin(productsTable, eq(setBlockOptionsTable.productId, productsTable.id))
        .leftJoin(productTypesTable, eq(productsTable.productTypeId, productTypesTable.id))
        .where(inArray(setBlockOptionsTable.blockId, blockIds))
        .orderBy(asc(setBlockOptionsTable.sortOrder))
    : [];

  const recommendedRows = await db
    .select({
      setItemId: setRecommendedItemsTable.id,
      productId: setRecommendedItemsTable.productId,
      sortOrder: setRecommendedItemsTable.sortOrder,
      productName: productsTable.name,
      productSlug: productsTable.slug,
      priceWholesale: productsTable.priceWholesale,
      priceWholesaleSale: productsTable.priceWholesaleSale,
      productTypeId: productsTable.productTypeId,
      productTypeName: productTypesTable.name,
      gender: productsTable.gender,
    })
    .from(setRecommendedItemsTable)
    .leftJoin(productsTable, eq(setRecommendedItemsTable.productId, productsTable.id))
    .leftJoin(productTypesTable, eq(productsTable.productTypeId, productTypesTable.id))
    .where(eq(setRecommendedItemsTable.setId, set.id))
    .orderBy(asc(setRecommendedItemsTable.sortOrder));

  // `items` unifica opciones de bloque + recomendadas para la resolución de variantes/imágenes
  // de abajo (mismo patrón para ambas) — el blockId (ausente en recomendadas) distingue el origen.
  const items = [
    ...optionRows.map((o) => ({ ...o, quantityPerSet: quantityPerBlockId.get(o.blockId) ?? 1, blockId: o.blockId as string | null })),
    ...recommendedRows.map((r) => ({ ...r, quantityPerSet: 1, blockId: null as string | null })),
  ];

  const productIds = items.map((i) => i.productId);
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

  // Imágenes por producto+color — mismo patrón que el catálogo individual (`data-service.ts`,
  // `fetchProductsWithJoins`): permite que el armador cambie las fotos de una pieza según el
  // color elegido, igual que la ficha de producto individual.
  const imageLinks = productIds.length > 0
    ? await db
        .select({
          productId: mediaLinksTable.entityId,
          colorId: mediaLinksTable.colorId,
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
          eq(mediaLinksTable.role, 'GALLERY'),
          inArray(mediaLinksTable.entityId, productIds)
        ))
        .orderBy(asc(mediaLinksTable.sortOrder))
    : [];

  const productTypesAgg = new Set<string>();
  const gendersAgg = new Set<Gender>();
  const colorMapAgg = new Map<string, ProductColor>();
  const sizeSetAgg = new Set<string>();
  const stylesMapAgg = new Map<string, Set<string>>();

  const pieces: Array<SetPiece & { blockId: string | null }> = items.map((item) => {
    const productVariants = variants.filter((v) => v.productId === item.productId);

    if (item.productTypeName) productTypesAgg.add(item.productTypeName);
    if (item.gender && genderFromDb[item.gender]) gendersAgg.add(genderFromDb[item.gender]);
    for (const v of productVariants) {
      if (v.status !== 'AVAILABLE') continue;
      if (!colorMapAgg.has(v.colorId)) {
        colorMapAgg.set(v.colorId, { id: v.colorId, name: v.colorName || '', code: v.colorCode || '', hex: v.colorHex || '' });
      }
      sizeSetAgg.add(v.size);
      const payload = v.attributesPayload as AttributesPayload | null | undefined;
      if (payload?.styles) {
        for (const [slug, value] of Object.entries(payload.styles)) {
          if (!stylesMapAgg.has(slug)) stylesMapAgg.set(slug, new Set());
          stylesMapAgg.get(slug)!.add(value);
        }
      }
    }

    const colorMap = new Map<string, ProductColor>();
    const sizeSet = new Set<string>();
    for (const v of productVariants) {
      if (!colorMap.has(v.colorId)) {
        colorMap.set(v.colorId, { id: v.colorId, name: v.colorName || '', code: v.colorCode || '', hex: v.colorHex || '' });
      }
      sizeSet.add(v.size);
    }

    // Imágenes de esta pieza agrupadas por color — mismo criterio que retail: fallback a
    // imágenes sin color asignado ('_default') si el color no tiene imágenes propias.
    const productImageLinks = imageLinks.filter((i) => i.productId === item.productId);
    const imagesByColor = new Map<string, MediaItem[]>();
    for (const img of productImageLinks) {
      const key = img.colorId || '_default';
      if (!imagesByColor.has(key)) imagesByColor.set(key, []);
      imagesByColor.get(key)!.push({
        url: resolveMediaUrl(img.storageKey),
        type: isVideoMime(img.mimeType) ? 'video' : 'image',
        mimeType: img.mimeType,
        width: img.width,
        height: img.height,
        durationSeconds: img.durationSeconds,
        previewStartSeconds: img.previewStartSeconds,
        previewDurationSeconds: img.previewDurationSeconds,
      });
    }

    const mappedVariants: ProductVariant[] = productVariants.map((v) => {
      const payload = v.attributesPayload as AttributesPayload | null | undefined;
      return {
        id: v.id,
        sku: v.sku ?? '',
        colorId: v.colorId,
        size: v.size as ProductVariant['size'],
        fit: (payload?.styles?.[CORTE_ATTRIBUTE_SLUG] as ProductVariant['fit'] | undefined) ?? undefined,
        styles: payload?.styles ?? {},
        images: imagesByColor.get(v.colorId) || imagesByColor.get('_default') || [],
        status: v.status as ProductVariant['status'],
      };
    });

    return {
      setItemId: item.setItemId,
      productId: item.productId!,
      productName: item.productName || '',
      productSlug: item.productSlug || '',
      quantityPerSet: item.blockId ? (item.quantityPerSet ?? 1) : undefined,
      priceWholesale: item.priceWholesale ? Number(item.priceWholesale) : null,
      priceWholesaleSale: item.priceWholesaleSale ? Number(item.priceWholesaleSale) : null,
      colors: Array.from(colorMap.values()),
      availableSizes: Array.from(sizeSet),
      variants: mappedVariants,
      blockId: item.blockId,
    };
  });

  // Precio "Desde $X" (Decisión 3): mínimo de cada bloque × su cantidad, sumado entre bloques —
  // las piezas recomendadas NUNCA participan de este cálculo (Decisión 2).
  let referencePrice = 0;
  let hasMissingPrices = false;
  for (const block of blockRows) {
    const blockPieces = pieces.filter((p) => p.blockId === block.id);
    const blockPrices = blockPieces
      .map((p) => (p.priceWholesaleSale ?? p.priceWholesale))
      .filter((p): p is number => p !== null && p !== undefined);
    if (blockPrices.length === 0) {
      hasMissingPrices = true;
      continue;
    }
    referencePrice += Math.min(...blockPrices) * (block.quantityPerSet ?? 1);
  }

  const coverMedia = await getCoverMediaMap([set.id]);

  // Combinaciones de color curadas (modo MIXED) — solo se consultan/usan cuando aplica; en
  // modo PAIRED el armador calcula la intersección de color directamente de `pieces[].colors`.
  let colorCombos: CorporateSetDetail['colorCombos'] = [];
  if (set.colorMode === 'MIXED') {
    const combos = await db
      .select({ id: setColorCombosTable.id, sortOrder: setColorCombosTable.sortOrder })
      .from(setColorCombosTable)
      .where(and(eq(setColorCombosTable.setId, set.id), eq(setColorCombosTable.isActive, true)))
      .orderBy(asc(setColorCombosTable.sortOrder));
    const comboIds = combos.map((c) => c.id);
    const comboItems = comboIds.length > 0
      ? await db
          .select({ comboId: setColorComboItemsTable.comboId, productId: setColorComboItemsTable.productId, colorCode: setColorComboItemsTable.colorCode })
          .from(setColorComboItemsTable)
          .where(inArray(setColorComboItemsTable.comboId, comboIds))
      : [];
    colorCombos = combos.map((c) => ({
      id: c.id,
      items: comboItems.filter((i) => i.comboId === c.id).map((i) => ({ productId: i.productId, colorCode: i.colorCode })),
    }));
  }

  const manualPrice = effectiveManualPrice(set.priceManual, set.priceManualSale, set.manualDiscountEnd);
  const effectiveHasMissingPrices = manualPrice !== null ? false : hasMissingPrices;

  const blocks = blockRows.map((block): SetBlock => {
    const blockPieces = pieces.filter((p) => p.blockId === block.id);
    const [opt1, opt2] = blockPieces;
    return {
      id: block.id,
      blockCode: block.blockCode as 'A' | 'B',
      quantityPerSet: block.quantityPerSet ?? 1,
      options: [opt1, opt2],
    };
  }) as [SetBlock, SetBlock];
  const recommendedPieces: SetPiece[] = pieces.filter((p) => p.blockId === null);

  return {
    id: set.id,
    slug: set.slug,
    name: set.name,
    description: set.description,
    cover: coverMedia.get(set.id)?.cover ?? null,
    secondaryCover: coverMedia.get(set.id)?.secondaryCover ?? null,
    brandId: set.brandId,
    brandName: set.brandName,
    productIds: pieces.map((p) => p.productId),
    isFeatured: set.isFeatured ?? false,
    pieceCount: blocks.length,
    hasRecommendedItems: recommendedPieces.length > 0,
    referencePrice: blocks.length > 0 || manualPrice !== null ? (manualPrice ?? referencePrice) : null,
    hasMissingPrices: effectiveHasMissingPrices,
    colors: Array.from(colorMapAgg.values()),
    sizes: Array.from(sizeSetAgg),
    genders: Array.from(gendersAgg),
    productTypes: Array.from(productTypesAgg),
    availableStyles: Object.fromEntries(
      Array.from(stylesMapAgg.entries(), ([slug, values]) => [slug, Array.from(values)])
    ),
    pieceNames: pieces.map((p) => p.productName).filter((n) => !!n),
    createdAt: set.createdAt ? set.createdAt.toISOString() : new Date(0).toISOString(),
    blocks,
    recommendedPieces,
    colorMode: set.colorMode as 'PAIRED' | 'MIXED',
    colorCombos,
  };
}

// ── Precios de sets por ID (para calcular pricing del carrito en servidor) ──
// Es el único punto de entrada del precio por set hacia `computeCartPricing` — un precio
// manual (override) del set reemplaza aquí la suma automática; el resto del motor de pricing
// (VOLUME_SCALE, PROMO) no necesita ningún cambio porque todos consumen este valor ya resuelto.
export async function getSetPricesByIds(setIds: string[]): Promise<Record<string, { pricePerSet: number; hasMissingPrices: boolean }>> {
  if (setIds.length === 0) return {};

  const [blockRows, setRows] = await Promise.all([
    db
      .select({
        setId: setBlocksTable.setId,
        blockId: setBlocksTable.id,
        quantityPerSet: setBlocksTable.quantityPerSet,
        priceWholesale: productsTable.priceWholesale,
        priceWholesaleSale: productsTable.priceWholesaleSale,
      })
      .from(setBlocksTable)
      .innerJoin(setBlockOptionsTable, eq(setBlockOptionsTable.blockId, setBlocksTable.id))
      .leftJoin(productsTable, eq(setBlockOptionsTable.productId, productsTable.id))
      .where(inArray(setBlocksTable.setId, setIds)),
    db
      .select({
        id: corporateSetsTable.id,
        priceManual: corporateSetsTable.priceManual,
        priceManualSale: corporateSetsTable.priceManualSale,
        manualDiscountEnd: corporateSetsTable.manualDiscountEnd,
      })
      .from(corporateSetsTable)
      .where(inArray(corporateSetsTable.id, setIds)),
  ]);
  const manualById = new Map(setRows.map((s) => [s.id, s]));

  const result: Record<string, { pricePerSet: number; hasMissingPrices: boolean }> = {};
  for (const setId of setIds) {
    const setBlockRows = blockRows.filter((r) => r.setId === setId);
    const blockIds = Array.from(new Set(setBlockRows.map((r) => r.blockId)));
    let pricePerSet = 0;
    let hasMissingPrices = false;
    for (const blockId of blockIds) {
      const optionsOfBlock = setBlockRows.filter((r) => r.blockId === blockId);
      const prices = optionsOfBlock
        .map((o) => wholesalePriceOf(o.priceWholesale, o.priceWholesaleSale))
        .filter((p): p is number => p !== null);
      if (prices.length === 0) {
        hasMissingPrices = true;
        continue;
      }
      pricePerSet += Math.min(...prices) * (optionsOfBlock[0].quantityPerSet ?? 1);
    }
    const manual = manualById.get(setId);
    const manualPrice = manual ? effectiveManualPrice(manual.priceManual, manual.priceManualSale, manual.manualDiscountEnd) : null;
    result[setId] = {
      pricePerSet: manualPrice ?? pricePerSet,
      hasMissingPrices: manualPrice !== null ? false : hasMissingPrices,
    };
  }
  return result;
}

// ── Metadata de sets (brandId, piezas por set) para el motor de reglas ──
export async function getSetMetaByIds(
  setIds: string[]
): Promise<Record<string, { brandId: string | null; piecesPerSet: number }>> {
  if (setIds.length === 0) return {};

  const [setRows, blockRows] = await Promise.all([
    db
      .select({ id: corporateSetsTable.id, brandId: corporateSetsTable.brandId })
      .from(corporateSetsTable)
      .where(inArray(corporateSetsTable.id, setIds)),
    db
      .select({ setId: setBlocksTable.setId, quantityPerSet: setBlocksTable.quantityPerSet })
      .from(setBlocksTable)
      .where(inArray(setBlocksTable.setId, setIds)),
  ]);

  // piecesPerSet = suma de quantityPerSet de los 2 bloques (no de las opciones cargadas) —
  // cada bloque aporta su cantidad una sola vez, sin importar cuál de sus 2 opciones se elija.
  const piecesBySet = new Map<string, number>();
  for (const block of blockRows) {
    piecesBySet.set(block.setId, (piecesBySet.get(block.setId) ?? 0) + (block.quantityPerSet ?? 1));
  }

  return Object.fromEntries(
    setRows.map((r) => [r.id, { brandId: r.brandId, piecesPerSet: piecesBySet.get(r.id) ?? 1 }])
  );
}

// ── Composición de sets (productos + cantidad por set) — usada para resolver reglas de ámbito
// PRODUCT y para COLOR_RESTRICTION (ver `SetMeta.pieces` en rules-engine/types.ts). Devuelve TODAS
// las opciones de bloque + piezas recomendadas: una regla de ámbito PRODUCTO puede apuntar a
// cualquiera de ellas sin importar cuál elija después el cliente — distinto de `piecesPerSet`
// (getSetMetaByIds), que sí depende del número de bloques, no del número de opciones. Las piezas
// recomendadas se incluyen con quantityPerSet: 1 mostrando su presencia, pero quedan fuera de
// MIN_QUANTITY/COLOR_RESTRICTION porque esas reglas evalúan solo las piezas REALMENTE elegidas en
// el carrito (`CorporateCartLine.pieceSelections`), no esta lista completa de opciones.
export async function getSetPiecesByIds(setIds: string[]): Promise<Record<string, SetPieceInfo[]>> {
  const result: Record<string, SetPieceInfo[]> = {};
  for (const setId of setIds) result[setId] = [];
  if (setIds.length === 0) return result;

  const [blockOptionRows, recommendedRows] = await Promise.all([
    db
      .select({
        setId: setBlocksTable.setId,
        productId: setBlockOptionsTable.productId,
        productName: productsTable.name,
        quantityPerSet: setBlocksTable.quantityPerSet,
      })
      .from(setBlockOptionsTable)
      .innerJoin(setBlocksTable, eq(setBlockOptionsTable.blockId, setBlocksTable.id))
      .leftJoin(productsTable, eq(setBlockOptionsTable.productId, productsTable.id))
      .where(inArray(setBlocksTable.setId, setIds)),
    db
      .select({
        setId: setRecommendedItemsTable.setId,
        productId: setRecommendedItemsTable.productId,
        productName: productsTable.name,
      })
      .from(setRecommendedItemsTable)
      .leftJoin(productsTable, eq(setRecommendedItemsTable.productId, productsTable.id))
      .where(inArray(setRecommendedItemsTable.setId, setIds)),
  ]);

  for (const row of blockOptionRows) {
    result[row.setId].push({
      productId: row.productId,
      productName: row.productName ?? undefined,
      quantityPerSet: row.quantityPerSet ?? 1,
    });
  }
  for (const row of recommendedRows) {
    result[row.setId].push({
      productId: row.productId,
      productName: row.productName ?? undefined,
      quantityPerSet: 1,
    });
  }
  return result;
}

/** Una fila de variante con su disponibilidad manual (`status`) — usada para resolver la
 * disponibilidad efectiva de cada combinación producto/talla/color del carrito corporativo. */
export interface VariantAvailabilityRow {
  productId: string;
  size: string;
  colorCode: string | null;
  status: string;
}

// ── Disponibilidad manual (status) de todas las variantes de los productos pedidos ──
// Una sola consulta para todos los productos del carrito (sin N+1 por línea) — la resolución de
// qué status aplica a cada combinación pedida (talla/color exactos, o agregada cuando el cliente
// no eligió color) vive en el llamador (`POST /api/corporate/quotes`), que conoce la forma exacta
// de cada `pieceSelection`.
export async function getVariantAvailabilityByProductIds(productIds: string[]): Promise<VariantAvailabilityRow[]> {
  if (productIds.length === 0) return [];

  return db
    .select({
      productId: variantsTable.productId,
      size: variantsTable.size,
      colorCode: colorsTable.code,
      status: variantsTable.status,
    })
    .from(variantsTable)
    .leftJoin(colorsTable, eq(variantsTable.colorId, colorsTable.id))
    .where(inArray(variantsTable.productId, productIds));
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

/** Cotizaciones visibles en el portal del cliente: solo las publicadas explícitamente
 * (`publishedToPortalAt`) — el resto son borradores/trabajo interno del vendedor. */
export async function getQuotesByAccountId(accountId: string) {
  const rows = await db
    .select()
    .from(quotesTable)
    .where(and(
      eq(quotesTable.accountId, accountId),
      isNotNull(quotesTable.publishedToPortalAt),
      isNull(quotesTable.deletedAt)
    ))
    .orderBy(desc(quotesTable.createdAt));

  const quoteIds = rows.map((q) => q.id);
  const documents = quoteIds.length > 0
    ? await db.select().from(quoteDocumentsTable).where(inArray(quoteDocumentsTable.quoteId, quoteIds))
    : [];

  return rows.map((q) => ({
    ...q,
    attachments: documents.filter((d) => d.quoteId === q.id),
  }));
}

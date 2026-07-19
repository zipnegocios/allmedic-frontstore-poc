import { db } from '@/db';
import {
  mediaAssets as mediaAssetsTable,
  mediaLinks as mediaLinksTable,
  mediaAudit as mediaAuditTable,
  products as productsTable,
  productVariants as variantsTable,
  colors as colorsTable,
  corporateSets as corporateSetsTable,
} from '@/db/schema';
import { eq, and, ne, inArray } from 'drizzle-orm';
import { deleteObject, copyObject } from '@/lib/r2';
import { buildProductMediaKey, buildSetMediaKey, fileNameFromStorageKey, COVER_SEGMENT } from '@/lib/media';

async function writeAudit(assetId: string, action: string, payload: Record<string, unknown>, userId?: string) {
  await db.insert(mediaAuditTable).values({ assetId, action, payload, userId });
}

/** Evita colisión de `storage_key` (columna única) cuando dos assets distintos
 * calculan la misma clave destino (ej. mismo nombre de archivo subido dos
 * veces al mismo color) — antepone un sufijo corto y estable derivado del id
 * del asset antes de la extensión. */
async function ensureUniqueKey(candidateKey: string, assetId: string): Promise<string> {
  const [clash] = await db
    .select({ id: mediaAssetsTable.id })
    .from(mediaAssetsTable)
    .where(and(eq(mediaAssetsTable.storageKey, candidateKey), ne(mediaAssetsTable.id, assetId)));
  if (!clash) return candidateKey;
  const suffix = assetId.slice(0, 8);
  const extMatch = candidateKey.match(/\.[^./]+$/);
  const ext = extMatch ? extMatch[0] : '';
  const base = ext ? candidateKey.slice(0, -ext.length) : candidateKey;
  return `${base}-${suffix}${ext}`;
}

export interface ReorganizeResult {
  moved: Array<{ assetId: string; oldKey: string; newKey: string }>;
  skippedReused: number;
}

/**
 * Reorganiza físicamente en R2 los medios propios de un producto hacia
 * `products/{codigoEstilo}/portada/` y `products/{codigoEstilo}/{codigoColor}/`,
 * actualizando `media_assets.storage_key` en cascada. Idempotente: los assets
 * ya ubicados en su clave esperada no se tocan. Los assets vinculados también
 * a OTRA entidad (reutilizados desde la biblioteca) nunca se mueven — solo se
 * reorganizan los que son propiedad exclusiva de este producto.
 */
export async function reorganizeProductMedia(productId: string, userId?: string): Promise<ReorganizeResult> {
  const [product] = await db.select({ code: productsTable.code }).from(productsTable).where(eq(productsTable.id, productId));
  if (!product) throw new Error('Producto no encontrado');

  const colorRows = await db
    .selectDistinct({ colorId: variantsTable.colorId, code: colorsTable.code })
    .from(variantsTable)
    .innerJoin(colorsTable, eq(variantsTable.colorId, colorsTable.id))
    .where(eq(variantsTable.productId, productId));
  const colorCodeById = new Map(colorRows.map((c) => [c.colorId, c.code]));

  const links = await db
    .select({
      assetId: mediaLinksTable.assetId,
      role: mediaLinksTable.role,
      colorId: mediaLinksTable.colorId,
      storageKey: mediaAssetsTable.storageKey,
    })
    .from(mediaLinksTable)
    .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
    .where(and(eq(mediaLinksTable.entityType, 'PRODUCT'), eq(mediaLinksTable.entityId, productId)));

  if (links.length === 0) return { moved: [], skippedReused: 0 };

  const assetIds = [...new Set(links.map((l) => l.assetId))];
  const externalLinkRows = await db
    .select({ assetId: mediaLinksTable.assetId })
    .from(mediaLinksTable)
    .where(and(inArray(mediaLinksTable.assetId, assetIds), ne(mediaLinksTable.entityId, productId)));
  const reusedElsewhere = new Set(externalLinkRows.map((r) => r.assetId));

  const moved: ReorganizeResult['moved'] = [];
  let skippedReused = 0;
  const seenAssetIds = new Set<string>();

  for (const link of links) {
    if (seenAssetIds.has(link.assetId)) continue; // un asset puede tener varios vínculos con el mismo producto (ej. COVER + GALLERY)
    seenAssetIds.add(link.assetId);

    if (reusedElsewhere.has(link.assetId)) {
      skippedReused += 1;
      continue;
    }

    const isCover = link.role === 'COVER' || link.role === 'COVER_SECONDARY';
    const colorCode = link.colorId ? colorCodeById.get(link.colorId) : undefined;
    if (!isCover && !colorCode) continue; // vínculo de galería sin color resoluble (dato inconsistente) — no se mueve

    const segment = isCover ? COVER_SEGMENT : colorCode!;
    const fileName = fileNameFromStorageKey(link.storageKey);
    let targetKey = buildProductMediaKey(product.code, segment, fileName);
    if (targetKey === link.storageKey) continue; // ya está en su lugar

    targetKey = await ensureUniqueKey(targetKey, link.assetId);
    if (targetKey === link.storageKey) continue;

    await copyObject(link.storageKey, targetKey);
    await db.update(mediaAssetsTable).set({ storageKey: targetKey, updatedAt: new Date() }).where(eq(mediaAssetsTable.id, link.assetId));
    await deleteObject(link.storageKey);
    await writeAudit(link.assetId, 'RENAME', { oldKey: link.storageKey, newKey: targetKey, reason: 'reorganize-product-media' }, userId);

    moved.push({ assetId: link.assetId, oldKey: link.storageKey, newKey: targetKey });
  }

  return { moved, skippedReused };
}

/**
 * Reorganiza físicamente en R2 la portada de un set hacia `sets/{slug}/portada/`
 * — misma lógica que `reorganizeProductMedia` (idempotente, nunca mueve assets
 * reutilizados por otra entidad), pero para el único rol `COVER` que usan los sets.
 */
export async function reorganizeSetMedia(setId: string, userId?: string): Promise<ReorganizeResult> {
  const [set] = await db.select({ slug: corporateSetsTable.slug }).from(corporateSetsTable).where(eq(corporateSetsTable.id, setId));
  if (!set) throw new Error('Set no encontrado');

  const links = await db
    .select({
      assetId: mediaLinksTable.assetId,
      storageKey: mediaAssetsTable.storageKey,
    })
    .from(mediaLinksTable)
    .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
    .where(and(eq(mediaLinksTable.entityType, 'SET'), eq(mediaLinksTable.entityId, setId), eq(mediaLinksTable.role, 'COVER')));

  if (links.length === 0) return { moved: [], skippedReused: 0 };

  const assetIds = links.map((l) => l.assetId);
  const externalLinkRows = await db
    .select({ assetId: mediaLinksTable.assetId })
    .from(mediaLinksTable)
    .where(and(inArray(mediaLinksTable.assetId, assetIds), ne(mediaLinksTable.entityId, setId)));
  const reusedElsewhere = new Set(externalLinkRows.map((r) => r.assetId));

  const moved: ReorganizeResult['moved'] = [];
  let skippedReused = 0;

  for (const link of links) {
    if (reusedElsewhere.has(link.assetId)) {
      skippedReused += 1;
      continue;
    }

    const fileName = fileNameFromStorageKey(link.storageKey);
    let targetKey = buildSetMediaKey(set.slug, fileName);
    if (targetKey === link.storageKey) continue;

    targetKey = await ensureUniqueKey(targetKey, link.assetId);
    if (targetKey === link.storageKey) continue;

    await copyObject(link.storageKey, targetKey);
    await db.update(mediaAssetsTable).set({ storageKey: targetKey, updatedAt: new Date() }).where(eq(mediaAssetsTable.id, link.assetId));
    await deleteObject(link.storageKey);
    await writeAudit(link.assetId, 'RENAME', { oldKey: link.storageKey, newKey: targetKey, reason: 'reorganize-set-media' }, userId);

    moved.push({ assetId: link.assetId, oldKey: link.storageKey, newKey: targetKey });
  }

  return { moved, skippedReused };
}

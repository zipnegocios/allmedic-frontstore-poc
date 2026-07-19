import { db } from '@/db';
import {
  mediaAssets as mediaAssetsTable,
  mediaTags as mediaTagsTable,
  mediaAssetTags as mediaAssetTagsTable,
  mediaLinks as mediaLinksTable,
  mediaComments as mediaCommentsTable,
  mediaAudit as mediaAuditTable,
  products as productsTable,
  corporateSets as corporateSetsTable,
  brands as brandsTable,
  banners as bannersTable,
  users as usersTable,
} from '@/db/schema';
import { eq, and, or, asc, desc, sql, ilike, inArray, notInArray, isNull, type SQL } from 'drizzle-orm';
import type { PgTable, AnyPgColumn } from 'drizzle-orm/pg-core';
import { deleteObject, copyObject, headObject } from '@/lib/r2';
import { renameStorageKey, type MediaEntityType } from '@/lib/media';

async function writeAudit(assetId: string | null, action: string, payload: Record<string, unknown>, userId?: string) {
  await db.insert(mediaAuditTable).values({ assetId, action, payload, userId });
}

// ── Listado ──

export async function listMediaAssets(opts: {
  folder?: string;
  tags?: string[];
  q?: string;
  unused?: boolean;
  mediaType?: 'image' | 'video' | 'all';
  page?: number;
  limit?: number;
  /** Picker enfocado (ver plan de carpetas por producto): restringe el listado a
   * `storageKey` bajo este prefijo — carpeta física de la entidad actual. */
  keyPrefix?: string;
  /** Junto con `keyPrefix`, además incluye assets vinculados a esta entidad
   * aunque vivan fuera del prefijo (badge "Reutilizado"/legacy). Sin efecto si
   * `keyPrefix` no viene. */
  linkedEntityType?: string;
  linkedEntityId?: string;
}) {
  const { folder, tags, q, unused, mediaType, page = 1, limit = 30, keyPrefix, linkedEntityType, linkedEntityId } = opts;
  const conditions: SQL<unknown>[] = [];

  if (folder) conditions.push(eq(mediaAssetsTable.folder, folder));

  if (keyPrefix) {
    let scopeCondition: SQL<unknown> = ilike(mediaAssetsTable.storageKey, `${keyPrefix}%`);
    if (linkedEntityType && linkedEntityId) {
      const linkedRows = await db.selectDistinct({ assetId: mediaLinksTable.assetId })
        .from(mediaLinksTable)
        .where(and(eq(mediaLinksTable.entityType, linkedEntityType), eq(mediaLinksTable.entityId, linkedEntityId)));
      const linkedIds = linkedRows.map((r) => r.assetId);
      if (linkedIds.length > 0) {
        scopeCondition = or(scopeCondition, inArray(mediaAssetsTable.id, linkedIds))!;
      }
    }
    conditions.push(scopeCondition);
  }
  if (mediaType === 'video') conditions.push(ilike(mediaAssetsTable.mimeType, 'video/%'));
  if (mediaType === 'image') conditions.push(ilike(mediaAssetsTable.mimeType, 'image/%'));
  if (q) {
    conditions.push(or(
      ilike(mediaAssetsTable.fileName, `%${q}%`),
      ilike(mediaAssetsTable.altText, `%${q}%`),
      ilike(mediaAssetsTable.title, `%${q}%`)
    )!);
  }

  let assetIdsFilter: string[] | undefined;
  if (tags && tags.length > 0) {
    const rows = await db
      .select({ assetId: mediaAssetTagsTable.assetId })
      .from(mediaAssetTagsTable)
      .innerJoin(mediaTagsTable, eq(mediaAssetTagsTable.tagId, mediaTagsTable.id))
      .where(inArray(mediaTagsTable.slug, tags));
    assetIdsFilter = rows.map((r) => r.assetId);
    if (assetIdsFilter.length === 0) return { assets: [], total: 0, page, limit };
    conditions.push(inArray(mediaAssetsTable.id, assetIdsFilter));
  }

  if (unused) {
    const linked = await db.selectDistinct({ assetId: mediaLinksTable.assetId }).from(mediaLinksTable);
    const linkedIds = linked.map((l) => l.assetId);
    if (linkedIds.length > 0) {
      conditions.push(notInArray(mediaAssetsTable.id, linkedIds));
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(mediaAssetsTable).where(where),
    db.select().from(mediaAssetsTable).where(where)
      .orderBy(desc(mediaAssetsTable.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);

  const assets = keyPrefix
    ? rows.map((r) => ({ ...r, origin: r.storageKey.startsWith(keyPrefix) ? ('own' as const) : ('reused' as const) }))
    : rows;

  return { assets, total: Number(countResult[0]?.count ?? 0), page, limit };
}

// ── Presign / Confirm ──

export async function confirmMediaUpload(input: {
  key: string;
  fileName: string;
  folder: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  checksumSha256?: string;
  durationSeconds?: number;
  previewStartSeconds?: number;
  previewDurationSeconds?: number;
  userId?: string;
}) {
  const head = await headObject(input.key);
  if (!head) throw new Error('El archivo no se encontró en R2 tras la subida');

  const [asset] = await db.insert(mediaAssetsTable).values({
    storageKey: input.key,
    fileName: input.fileName,
    folder: input.folder,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    width: input.width,
    height: input.height,
    checksumSha256: input.checksumSha256,
    durationSeconds: input.durationSeconds,
    previewStartSeconds: input.previewStartSeconds ?? 0,
    previewDurationSeconds: input.previewDurationSeconds ?? (input.durationSeconds ? Math.min(3, input.durationSeconds) : 3),
    createdBy: input.userId,
  }).returning();

  await writeAudit(asset.id, 'UPLOAD', { key: input.key }, input.userId);
  return asset;
}

// ── Detalle ──

const ENTITY_TABLES: Record<MediaEntityType, { table: PgTable; idCol: AnyPgColumn; nameCol: AnyPgColumn }> = {
  PRODUCT: { table: productsTable, idCol: productsTable.id, nameCol: productsTable.name },
  SET: { table: corporateSetsTable, idCol: corporateSetsTable.id, nameCol: corporateSetsTable.name },
  BRAND: { table: brandsTable, idCol: brandsTable.id, nameCol: brandsTable.name },
  BANNER: { table: bannersTable, idCol: bannersTable.id, nameCol: bannersTable.title },
};

export async function getMediaAssetDetail(id: string) {
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, id));
  if (!asset) return null;

  const [tagRows, links, comments, audit] = await Promise.all([
    db.select({ id: mediaTagsTable.id, name: mediaTagsTable.name, slug: mediaTagsTable.slug })
      .from(mediaAssetTagsTable)
      .innerJoin(mediaTagsTable, eq(mediaAssetTagsTable.tagId, mediaTagsTable.id))
      .where(eq(mediaAssetTagsTable.assetId, id)),
    db.select().from(mediaLinksTable).where(eq(mediaLinksTable.assetId, id)),
    db.select({
      id: mediaCommentsTable.id,
      body: mediaCommentsTable.body,
      createdAt: mediaCommentsTable.createdAt,
      userName: usersTable.name,
    }).from(mediaCommentsTable)
      .leftJoin(usersTable, eq(mediaCommentsTable.userId, usersTable.id))
      .where(eq(mediaCommentsTable.assetId, id))
      .orderBy(desc(mediaCommentsTable.createdAt)),
    db.select({
      id: mediaAuditTable.id,
      action: mediaAuditTable.action,
      payload: mediaAuditTable.payload,
      createdAt: mediaAuditTable.createdAt,
      userName: usersTable.name,
    }).from(mediaAuditTable)
      .leftJoin(usersTable, eq(mediaAuditTable.userId, usersTable.id))
      .where(eq(mediaAuditTable.assetId, id))
      .orderBy(desc(mediaAuditTable.createdAt)),
  ]);

  const usages = await Promise.all(links.map(async (link) => {
    const entityType = link.entityType as MediaEntityType;
    const entry = ENTITY_TABLES[entityType];
    if (!entry) return { ...link, entityName: null };
    const [row] = await db.select({ name: entry.nameCol }).from(entry.table).where(eq(entry.idCol, link.entityId));
    return { ...link, entityName: row?.name ?? null };
  }));

  return { asset, tags: tagRows, links: usages, comments, audit };
}

// ── Edición / Renombrado ──

export async function updateMediaAsset(id: string, input: {
  altText?: string;
  title?: string;
  caption?: string;
  folder?: string;
  fileName?: string;
  tagIds?: string[];
  previewStartSeconds?: number;
  previewDurationSeconds?: number;
  userId?: string;
}) {
  const [current] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, id));
  if (!current) throw new Error('Medio no encontrado');

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.altText !== undefined) updates.altText = input.altText;
  if (input.title !== undefined) updates.title = input.title;
  if (input.caption !== undefined) updates.caption = input.caption;
  if (input.folder !== undefined) updates.folder = input.folder;

  if (input.previewStartSeconds !== undefined || input.previewDurationSeconds !== undefined) {
    const start = input.previewStartSeconds ?? current.previewStartSeconds ?? 0;
    const duration = input.previewDurationSeconds ?? current.previewDurationSeconds ?? 3;
    if (current.durationSeconds != null && start + duration > current.durationSeconds) {
      throw new Error('La ventana de vista previa excede la duración del video');
    }
    updates.previewStartSeconds = start;
    updates.previewDurationSeconds = duration;
  }

  if (input.fileName && input.fileName !== current.fileName) {
    const newKey = renameStorageKey(current.storageKey, input.fileName);
    if (newKey !== current.storageKey) {
      await copyObject(current.storageKey, newKey);
      await deleteObject(current.storageKey);
      updates.storageKey = newKey;
      await writeAudit(id, 'RENAME', { oldKey: current.storageKey, newKey }, input.userId);
    }
    updates.fileName = input.fileName;
  }

  const [updated] = await db.update(mediaAssetsTable).set(updates).where(eq(mediaAssetsTable.id, id)).returning();

  if (input.tagIds) {
    await db.delete(mediaAssetTagsTable).where(eq(mediaAssetTagsTable.assetId, id));
    if (input.tagIds.length > 0) {
      await db.insert(mediaAssetTagsTable).values(input.tagIds.map((tagId) => ({ assetId: id, tagId })));
    }
  }

  await writeAudit(id, 'UPDATE_SEO', { fields: Object.keys(updates) }, input.userId);
  return updated;
}

// ── Eliminación ──

export async function deleteMediaAsset(id: string, force: boolean, userId?: string) {
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, id));
  if (!asset) throw new Error('Medio no encontrado');

  const links = await db.select().from(mediaLinksTable).where(eq(mediaLinksTable.assetId, id));

  if (links.length > 0 && !force) {
    const usageByType: Record<string, number> = {};
    for (const link of links) usageByType[link.entityType] = (usageByType[link.entityType] ?? 0) + 1;
    const error = new Error('Medio en uso') as Error & { usage?: Record<string, number> };
    error.usage = usageByType;
    throw error;
  }

  if (links.length > 0) {
    await db.delete(mediaLinksTable).where(eq(mediaLinksTable.assetId, id));
  }

  await db.delete(mediaCommentsTable).where(eq(mediaCommentsTable.assetId, id));
  await deleteObject(asset.storageKey);
  await db.delete(mediaAssetsTable).where(eq(mediaAssetsTable.id, id));
  await writeAudit(null, 'DELETE', { assetId: id, storageKey: asset.storageKey }, userId);
}

// ── Comentarios ──

export async function addMediaComment(assetId: string, body: string, userId?: string) {
  const [comment] = await db.insert(mediaCommentsTable).values({ assetId, body, userId }).returning();
  return comment;
}

// ── Vínculos ──

export async function createMediaLink(input: {
  assetId: string;
  entityType: string;
  entityId: string;
  colorId?: string;
  role?: string;
  sortOrder?: number;
  altOverride?: string;
  titleOverride?: string;
  captionOverride?: string;
  userId?: string;
}) {
  const [link] = await db.insert(mediaLinksTable).values({
    assetId: input.assetId,
    entityType: input.entityType,
    entityId: input.entityId,
    colorId: input.colorId,
    role: input.role ?? 'GALLERY',
    sortOrder: input.sortOrder ?? 0,
    altOverride: input.altOverride,
    titleOverride: input.titleOverride,
    captionOverride: input.captionOverride,
  }).returning();

  await writeAudit(input.assetId, 'LINK', { entityType: input.entityType, entityId: input.entityId, role: input.role }, input.userId);
  return link;
}

export async function deleteMediaLink(id: string, userId?: string) {
  const [link] = await db.select().from(mediaLinksTable).where(eq(mediaLinksTable.id, id));
  if (!link) throw new Error('Vínculo no encontrado');
  await db.delete(mediaLinksTable).where(eq(mediaLinksTable.id, id));
  await writeAudit(link.assetId, 'UNLINK', { entityType: link.entityType, entityId: link.entityId }, userId);
}

export async function updateMediaLink(id: string, input: {
  sortOrder?: number;
  altOverride?: string;
  titleOverride?: string;
  captionOverride?: string;
  role?: string;
}) {
  const updates: Record<string, unknown> = {};
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.altOverride !== undefined) updates.altOverride = input.altOverride;
  if (input.titleOverride !== undefined) updates.titleOverride = input.titleOverride;
  if (input.captionOverride !== undefined) updates.captionOverride = input.captionOverride;
  if (input.role !== undefined) updates.role = input.role;

  const [updated] = await db.update(mediaLinksTable).set(updates).where(eq(mediaLinksTable.id, id)).returning();
  return updated;
}

// ── Links por entidad (usado por el frontstore y por el picker) ──

export async function getMediaLinksForEntity(entityType: string, entityId: string, colorId?: string) {
  const conditions: SQL<unknown>[] = [
    eq(mediaLinksTable.entityType, entityType),
    eq(mediaLinksTable.entityId, entityId),
  ];
  conditions.push(colorId ? eq(mediaLinksTable.colorId, colorId) : isNull(mediaLinksTable.colorId));

  return db.select({
    link: mediaLinksTable,
    asset: mediaAssetsTable,
  }).from(mediaLinksTable)
    .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
    .where(and(...conditions))
    .orderBy(asc(mediaLinksTable.sortOrder));
}

// ── Tags ──

export async function listMediaTags() {
  return db.select().from(mediaTagsTable).orderBy(asc(mediaTagsTable.name));
}

export async function createMediaTag(name: string, slug: string) {
  const [tag] = await db.insert(mediaTagsTable).values({ name, slug }).returning();
  return tag;
}

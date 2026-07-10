import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  mediaAssets as mediaAssetsTable,
  mediaLinks as mediaLinksTable,
  mediaAudit as mediaAuditTable,
  productImages as productImagesTable,
  products as productsTable,
  colors as colorsTable,
  banners as bannersTable,
  brands as brandsTable,
  corporateSets as corporateSetsTable,
} from "@/db/schema";
import { putObject } from "@/lib/r2";
import { buildStorageKey, resolveMediaUrl, type MediaFolder } from "@/lib/media";

const DRY_RUN = process.argv.includes("--dry-run");
const IMAGES_DIR = path.join(process.cwd(), "public", "images");
const EXCLUDED_LOGOS = new Set(["allmedic_logo_black.png", "allmedic_logo_white.png"]);
const CACHE_CONTROL = "public, max-age=31536000, immutable";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

interface Report {
  uploaded: string[];
  skippedDuplicate: string[];
  skippedDryRun: string[];
  linksCreated: string[];
  legacyColumnsUpdated: string[];
  unresolvedMissingFile: string[];
  orphanFiles: string[];
}

const report: Report = {
  uploaded: [],
  skippedDuplicate: [],
  skippedDryRun: [],
  linksCreated: [],
  legacyColumnsUpdated: [],
  unresolvedMissingFile: [],
  orphanFiles: [],
};

const handledFiles = new Set<string>(); // relative paths from public/images/, e.g. "product-1-navy-1.jpg" or "brands/figs.png"

function mimeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function sha256File(filePath: string): { checksum: string; buffer: Buffer } {
  const buffer = readFileSync(filePath);
  const checksum = createHash("sha256").update(buffer).digest("hex");
  return { checksum, buffer };
}

function localPathFromUrl(url: string): string | null {
  if (!url.startsWith("/images/")) return null;
  return url.replace(/^\/images\//, "");
}

/** Sube (si no existe) y registra un media_asset. Devuelve el id del asset (nuevo o reutilizado). */
async function uploadAndRegisterAsset(opts: {
  relativeFile: string; // e.g. "product-1-navy-1.jpg" or "brands/figs.png"
  folder: MediaFolder;
  segments: string[];
  fileName: string;
  altText?: string;
}): Promise<{ assetId: string; storageKey: string; isNew: boolean }> {
  const localPath = path.join(IMAGES_DIR, opts.relativeFile);
  handledFiles.add(opts.relativeFile.replace(/\\/g, "/"));

  if (!existsSync(localPath)) {
    report.unresolvedMissingFile.push(`${opts.relativeFile} (esperado en ${localPath})`);
    throw new Error("missing_file");
  }

  const storageKey = buildStorageKey(opts.folder, opts.segments, opts.fileName);
  const { checksum, buffer } = sha256File(localPath);

  const [existing] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.storageKey, storageKey));
  if (existing) {
    report.skippedDuplicate.push(`${opts.relativeFile} -> ${storageKey} (ya migrado)`);
    return { assetId: existing.id, storageKey, isNew: false };
  }

  if (DRY_RUN) {
    report.skippedDryRun.push(`${opts.relativeFile} -> ${storageKey}`);
    return { assetId: "dry-run", storageKey, isNew: true };
  }

  const mimeType = mimeFor(localPath);
  const metadata = await sharp(buffer).metadata();

  await putObject(storageKey, buffer, mimeType, CACHE_CONTROL);

  const [asset] = await db.insert(mediaAssetsTable).values({
    storageKey,
    fileName: opts.fileName,
    folder: opts.folder,
    mimeType,
    sizeBytes: buffer.length,
    width: metadata.width,
    height: metadata.height,
    checksumSha256: checksum,
    altText: opts.altText,
  }).returning();

  await db.insert(mediaAuditTable).values({
    assetId: asset.id,
    action: "UPLOAD",
    payload: { origin: "MIGRATION", localFile: opts.relativeFile },
  });

  report.uploaded.push(`${opts.relativeFile} -> ${storageKey}`);
  return { assetId: asset.id, storageKey, isNew: true };
}

async function ensureLink(opts: {
  assetId: string;
  entityType: "PRODUCT" | "SET" | "BRAND" | "BANNER";
  entityId: string;
  colorId?: string | null;
  role: string;
  sortOrder?: number;
  altOverride?: string;
}) {
  if (DRY_RUN || opts.assetId === "dry-run") return;

  const conditions = [
    eq(mediaLinksTable.assetId, opts.assetId),
    eq(mediaLinksTable.entityType, opts.entityType),
    eq(mediaLinksTable.entityId, opts.entityId),
    eq(mediaLinksTable.role, opts.role),
    ...(opts.colorId ? [eq(mediaLinksTable.colorId, opts.colorId)] : []),
  ];
  const [existing] = await db.select().from(mediaLinksTable).where(and(...conditions));
  if (existing) return;

  await db.insert(mediaLinksTable).values({
    assetId: opts.assetId,
    entityType: opts.entityType,
    entityId: opts.entityId,
    colorId: opts.colorId ?? null,
    role: opts.role,
    sortOrder: opts.sortOrder ?? 0,
    altOverride: opts.altOverride,
  });
  report.linksCreated.push(`${opts.entityType}:${opts.entityId} (${opts.role})`);
}

// ─── A) Product images ───
async function migrateProductImages() {
  const rows = await db.select({
    id: productImagesTable.id,
    productId: productImagesTable.productId,
    colorId: productImagesTable.colorId,
    url: productImagesTable.url,
    alt: productImagesTable.alt,
    sortOrder: productImagesTable.sortOrder,
    productSlug: productsTable.slug,
    colorCode: colorsTable.code,
  })
    .from(productImagesTable)
    .innerJoin(productsTable, eq(productImagesTable.productId, productsTable.id))
    .leftJoin(colorsTable, eq(productImagesTable.colorId, colorsTable.id));

  for (const row of rows) {
    const relativeFile = localPathFromUrl(row.url);
    if (!relativeFile) continue; // ya apunta a otro host (probablemente ya migrado a R2)

    try {
      const { assetId } = await uploadAndRegisterAsset({
        relativeFile,
        folder: "PRODUCTS",
        segments: [row.productSlug, row.colorCode ?? "sin-color"],
        fileName: path.basename(relativeFile),
        altText: row.alt ?? undefined,
      });
      await ensureLink({
        assetId,
        entityType: "PRODUCT",
        entityId: row.productId,
        colorId: row.colorId,
        role: "GALLERY",
        sortOrder: row.sortOrder ?? 0,
        altOverride: row.alt ?? undefined,
      });
    } catch (err) {
      if (!(err instanceof Error && err.message === "missing_file")) throw err;
    }
  }
}

// ─── B) Banners ───
async function migrateBanners() {
  const rows = await db.select().from(bannersTable);

  for (const row of rows) {
    const updates: Record<string, string> = {};

    for (const [field, role] of [["imageDesktop", "DESKTOP"], ["imageMobile", "MOBILE"]] as const) {
      const url = row[field as "imageDesktop" | "imageMobile"];
      if (!url) continue;
      const relativeFile = localPathFromUrl(url);
      if (!relativeFile) continue;

      try {
        const { assetId, storageKey } = await uploadAndRegisterAsset({
          relativeFile,
          folder: "BANNERS",
          segments: [],
          fileName: path.basename(relativeFile),
          altText: row.title,
        });
        await ensureLink({ assetId, entityType: "BANNER", entityId: row.id, role });
        if (assetId !== "dry-run") updates[field] = resolveMediaUrl(storageKey);
      } catch (err) {
        if (!(err instanceof Error && err.message === "missing_file")) throw err;
      }
    }

    if (!DRY_RUN && Object.keys(updates).length > 0) {
      await db.update(bannersTable).set(updates).where(eq(bannersTable.id, row.id));
      report.legacyColumnsUpdated.push(`banners.${row.id}: ${Object.keys(updates).join(", ")}`);
    }
  }
}

// ─── C) Brand logos ───
async function migrateBrandLogos() {
  const rows = await db.select().from(brandsTable);

  for (const row of rows) {
    if (!row.logoUrl) continue;
    const relativeFile = localPathFromUrl(row.logoUrl);
    if (!relativeFile) continue;

    try {
      const { assetId, storageKey } = await uploadAndRegisterAsset({
        relativeFile,
        folder: "BRANDS",
        segments: [row.slug],
        fileName: path.basename(relativeFile),
        altText: `Logo ${row.name}`,
      });
      await ensureLink({ assetId, entityType: "BRAND", entityId: row.id, role: "LOGO" });
      if (!DRY_RUN && assetId !== "dry-run") {
        await db.update(brandsTable).set({ logoUrl: resolveMediaUrl(storageKey) }).where(eq(brandsTable.id, row.id));
        report.legacyColumnsUpdated.push(`brands.${row.id}.logoUrl`);
      }
    } catch (err) {
      if (!(err instanceof Error && err.message === "missing_file")) throw err;
    }
  }
}

// ─── D) Corporate sets cover ───
async function migrateCorporateSets() {
  const rows = await db.select().from(corporateSetsTable);

  for (const row of rows) {
    if (!row.imageUrl) continue;
    const relativeFile = localPathFromUrl(row.imageUrl);
    if (!relativeFile) continue;

    try {
      const { assetId, storageKey } = await uploadAndRegisterAsset({
        relativeFile,
        folder: "SETS",
        segments: [row.slug],
        fileName: path.basename(relativeFile),
        altText: row.name,
      });
      await ensureLink({ assetId, entityType: "SET", entityId: row.id, role: "COVER" });
      if (!DRY_RUN && assetId !== "dry-run") {
        await db.update(corporateSetsTable).set({ imageUrl: resolveMediaUrl(storageKey) }).where(eq(corporateSetsTable.id, row.id));
        report.legacyColumnsUpdated.push(`corporate_sets.${row.id}.imageUrl`);
      }
    } catch (err) {
      if (!(err instanceof Error && err.message === "missing_file")) throw err;
    }
  }
}

// ─── E) Categorías de la home (referencia hardcodeada en código, sin fila en BD) ───
const HOME_CATEGORY_FILES = ["category-women.jpg", "category-men.jpg", "category-accessories.jpg"];

async function migrateHomeCategories(): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  for (const file of HOME_CATEGORY_FILES) {
    try {
      const { storageKey, assetId } = await uploadAndRegisterAsset({
        relativeFile: file,
        folder: "SITE",
        segments: [],
        fileName: file,
        altText: file.replace("category-", "").replace(".jpg", ""),
      });
      if (assetId !== "dry-run") urls[file] = resolveMediaUrl(storageKey);
    } catch (err) {
      if (!(err instanceof Error && err.message === "missing_file")) throw err;
    }
  }
  return urls;
}

// ─── Inventario completo de public/images/ (para detectar huérfanos) ───
function listAllImageFiles(): string[] {
  const results: string[] = [];
  function walk(dir: string, prefix: string) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const rel = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(full).isDirectory()) {
        walk(full, rel);
      } else if (!EXCLUDED_LOGOS.has(rel)) {
        results.push(rel);
      }
    }
  }
  walk(IMAGES_DIR, "");
  return results;
}

async function main() {
  console.log(`\n=== Migración de medios a R2 ${DRY_RUN ? "(DRY RUN)" : "(EJECUCIÓN REAL)"} ===\n`);

  await migrateProductImages();
  await migrateBanners();
  await migrateBrandLogos();
  await migrateCorporateSets();
  const categoryUrls = await migrateHomeCategories();

  const allFiles = listAllImageFiles();
  for (const file of allFiles) {
    if (!handledFiles.has(file)) report.orphanFiles.push(file);
  }

  console.log(`Subidos: ${report.uploaded.length}`);
  report.uploaded.forEach((x) => console.log(`  + ${x}`));
  console.log(`\nOmitidos (ya migrados / duplicados): ${report.skippedDuplicate.length}`);
  report.skippedDuplicate.forEach((x) => console.log(`  = ${x}`));
  if (DRY_RUN) {
    console.log(`\nPendientes de subir (dry-run): ${report.skippedDryRun.length}`);
    report.skippedDryRun.forEach((x) => console.log(`  ~ ${x}`));
  }
  console.log(`\nVínculos creados: ${report.linksCreated.length}`);
  report.linksCreated.forEach((x) => console.log(`  -> ${x}`));
  console.log(`\nColumnas legacy actualizadas: ${report.legacyColumnsUpdated.length}`);
  report.legacyColumnsUpdated.forEach((x) => console.log(`  ~ ${x}`));

  console.log(`\n⚠ Referencias en BD sin archivo físico: ${report.unresolvedMissingFile.length}`);
  report.unresolvedMissingFile.forEach((x) => console.log(`  ! ${x}`));

  console.log(`\n⚠ Archivos huérfanos (sin referencia en BD, NO subidos): ${report.orphanFiles.length}`);
  report.orphanFiles.forEach((x) => console.log(`  ? ${x}`));

  if (!DRY_RUN && Object.keys(categoryUrls).length > 0) {
    console.log(`\n=== Actualiza manualmente src/legacy-pages/Home.tsx con estas URLs ===`);
    for (const [file, url] of Object.entries(categoryUrls)) {
      console.log(`  ${file} -> ${url}`);
    }
  }

  const totalClassified = allFiles.length - report.orphanFiles.length;
  console.log(`\n=== Resumen: ${totalClassified}/${allFiles.length} archivos clasificados (${report.orphanFiles.length} huérfanos) ===\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Migración fallida:", err);
  process.exit(1);
});

const FOLDER_PREFIXES: Record<string, string> = {
  PRODUCTS: "products",
  SETS: "sets",
  BRANDS: "brands",
  BANNERS: "banners",
  SITE: "site",
};

export type MediaFolder = keyof typeof FOLDER_PREFIXES;

function getPublicUrl(): string {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) throw new Error("Falta la variable de entorno R2_PUBLIC_URL");
  return url.replace(/\/$/, "");
}

/** Construye la URL pública final de un asset a partir de su storage_key. */
export function resolveMediaUrl(storageKey: string): string {
  return `${getPublicUrl()}/${storageKey}`;
}

interface SeoBase {
  altText: string | null;
  title: string | null;
  caption: string | null;
}

interface SeoOverride {
  altOverride: string | null;
  titleOverride: string | null;
  captionOverride: string | null;
}

/** Regla única de resolución SEO: el override contextual del vínculo gana sobre el valor base del asset. */
export function resolveSeo(link: SeoOverride, asset: SeoBase) {
  return {
    alt: link.altOverride ?? asset.altText ?? "",
    title: link.titleOverride ?? asset.title ?? "",
    caption: link.captionOverride ?? asset.caption ?? "",
  };
}

function slugifySegment(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Genera un storage_key con la estructura de carpetas definida en el plan. */
export function buildStorageKey(folder: MediaFolder, segments: string[], fileName: string): string {
  const prefix = FOLDER_PREFIXES[folder];
  const cleanSegments = segments.filter(Boolean).map(slugifySegment);
  const cleanFileName = slugifySegment(fileName.replace(/\.[^.]+$/, "")) + (fileName.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? "");
  return [prefix, ...cleanSegments, cleanFileName].join("/");
}

/** Mantiene el directorio del storage_key actual y reemplaza solo el nombre de archivo (para renombrar). */
export function renameStorageKey(oldKey: string, newFileName: string): string {
  const lastSlash = oldKey.lastIndexOf("/");
  const dir = lastSlash >= 0 ? oldKey.slice(0, lastSlash) : "";
  const oldFileName = lastSlash >= 0 ? oldKey.slice(lastSlash + 1) : oldKey;
  const oldExt = oldFileName.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? "";
  const newExt = newFileName.match(/\.[^.]+$/)?.[0]?.toLowerCase();
  const baseName = newFileName.replace(/\.[^.]+$/, "");
  const cleanFileName = slugifySegment(baseName) + (newExt ?? oldExt);
  return dir ? `${dir}/${cleanFileName}` : cleanFileName;
}

export const ALLOWED_MEDIA_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_MEDIA_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MEDIA_FOLDERS = Object.keys(FOLDER_PREFIXES) as MediaFolder[];
export const MEDIA_ENTITY_TYPES = ["PRODUCT", "SET", "BRAND", "BANNER"] as const;
export type MediaEntityType = (typeof MEDIA_ENTITY_TYPES)[number];
export const MEDIA_LINK_ROLES = ["GALLERY", "LOGO", "DESKTOP", "MOBILE", "COVER"] as const;
export type MediaLinkRole = (typeof MEDIA_LINK_ROLES)[number];

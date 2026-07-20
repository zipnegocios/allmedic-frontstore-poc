const FOLDER_PREFIXES: Record<string, string> = {
  PRODUCTS: "products",
  SETS: "sets",
  BRANDS: "brands",
  COLLECTIONS: "collections",
  BANNERS: "banners",
  SITE: "site",
};

export type MediaFolder = keyof typeof FOLDER_PREFIXES;

// Dominio público del bucket R2. No es secreto (queda expuesto en cada URL de imagen servida
// al navegador), así que se usa como fallback fijo: las variables NEXT_PUBLIC_* de Next.js solo
// se "hornean" en el bundle del cliente si existen en tiempo de BUILD de Docker, y EasyPanel solo
// inyecta variables de entorno en tiempo de RUNTIME del contenedor — sin este fallback, el bundle
// del cliente queda con `undefined` para siempre sin importar qué env vars se configuren después.
const R2_PUBLIC_URL_FALLBACK = "https://media.allmedicuniforms.com";

function getPublicUrl(): string {
  const url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? process.env.R2_PUBLIC_URL ?? R2_PUBLIC_URL_FALLBACK;
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

export function slugifySegment(input: string): string {
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

/** Sanea un segmento de carpeta que representa un CÓDIGO de negocio (código de
 * estilo de producto, código de color) preservando mayúsculas — a diferencia de
 * `slugifySegment` (que fuerza minúsculas para nombres de archivo/slugs), estos
 * códigos ya son identificadores cortos y estables (`CK3900`, `BLK`) que el admin
 * reconoce visualmente en el bucket; forzarlos a minúsculas los volvería
 * irreconocibles sin ganar nada en seguridad de URL. */
export function sanitizeCodeSegment(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Segmento fijo de la subcarpeta de portada dentro de la carpeta de una entidad
 * (producto o set) — compartido entre ambas, no exclusivo de productos. */
export const COVER_SEGMENT = "portada";

/** Segmento fijo para imágenes de galería sin color asignado (patrón legacy,
 * soportado explícitamente por `VariantsMediaSection`) — sin esto, esas
 * imágenes no tienen ninguna subcarpeta de color válida a la que mudarse y
 * quedarían para siempre sin reorganizar. */
export const NO_COLOR_SEGMENT = "sin-color";

function buildFolderMediaKey(folder: MediaFolder, mainSegment: string, subSegment: string, fileName: string): string {
  const prefix = FOLDER_PREFIXES[folder];
  const mainSeg = sanitizeCodeSegment(mainSegment);
  const subSeg = subSegment === COVER_SEGMENT ? COVER_SEGMENT : sanitizeCodeSegment(subSegment);
  const cleanFileName = slugifySegment(fileName.replace(/\.[^.]+$/, "")) + (fileName.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? "");
  return [prefix, mainSeg, subSeg, cleanFileName].join("/");
}

/** Construye la clave física de un medio de producto bajo la carpeta por
 * código de estilo: `products/{CODIGO}/portada/archivo.ext` o
 * `products/{CODIGO}/{CODIGO-COLOR}/archivo.ext`. El código de estilo y el de
 * color preservan mayúsculas (`sanitizeCodeSegment`); el nombre de archivo se
 * sanea con `slugifySegment` como el resto del sistema. */
export function buildProductMediaKey(codigoEstilo: string, colorCodeOrPortada: string | typeof COVER_SEGMENT, fileName: string): string {
  return buildFolderMediaKey('PRODUCTS', codigoEstilo, colorCodeOrPortada, fileName);
}

/** Construye la clave física de la portada de un set: `sets/{slug}/portada/archivo.ext`. */
export function buildSetMediaKey(slug: string, fileName: string): string {
  return buildFolderMediaKey('SETS', slug, COVER_SEGMENT, fileName);
}

/** Extrae el nombre de archivo (última porción) de un storage_key existente —
 * usado por el servicio de reorganización para preservar el nombre al mover un
 * asset a su carpeta esperada. */
export function fileNameFromStorageKey(storageKey: string): string {
  const lastSlash = storageKey.lastIndexOf("/");
  return lastSlash >= 0 ? storageKey.slice(lastSlash + 1) : storageKey;
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

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/webm"];
export const ALLOWED_MEDIA_MIME_TYPES = [...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_VIDEO_MIME_TYPES];

export function isVideoMime(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
/** @deprecated usar maxSizeForMime(mimeType) — se mantiene por compatibilidad con el límite de imágenes. */
export const MAX_MEDIA_SIZE_BYTES = MAX_IMAGE_SIZE_BYTES;

export function maxSizeForMime(mimeType: string): number {
  return isVideoMime(mimeType) ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
}

export const MAX_VIDEO_PREVIEW_DURATION_SECONDS = 30;

export const MEDIA_FOLDERS = Object.keys(FOLDER_PREFIXES) as MediaFolder[];
export const MEDIA_ENTITY_TYPES = ["PRODUCT", "SET", "BRAND", "BANNER", "COLLECTION"] as const;
export type MediaEntityType = (typeof MEDIA_ENTITY_TYPES)[number];
// `COVER_SECONDARY`: segunda imagen de portada del producto (nivel producto, no
// por color) — habilita el crossfade "hover image swap" en la card del catálogo
// público. Opcional, a diferencia de `COVER`.
export const MEDIA_LINK_ROLES = ["GALLERY", "LOGO", "DESKTOP", "MOBILE", "COVER", "COVER_SECONDARY"] as const;
export type MediaLinkRole = (typeof MEDIA_LINK_ROLES)[number];
/** Folders donde se permite subir video (Sets y Brands siguen solo-imagen). */
export const VIDEO_ALLOWED_FOLDERS: MediaFolder[] = ["PRODUCTS", "BANNERS"];

export interface MediaAssetSummary {
  id: string;
  storageKey: string;
  fileName: string;
  folder: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  previewStartSeconds: number | null;
  previewDurationSeconds: number | null;
  altText: string | null;
  title: string | null;
  caption: string | null;
  createdAt: string | null;
  /** Solo presente cuando el listado usó `keyPrefix` (picker enfocado): 'own' si
   * el asset vive en la carpeta de la entidad, 'reused' si está vinculado a ella
   * pero vive en otra ruta (reutilizado desde la biblioteca o legacy). */
  origin?: 'own' | 'reused';
}

/** Item de medio ya resuelto (URL pública) para consumo en componentes públicos/admin. */
export interface MediaItem {
  url: string;
  type: 'image' | 'video';
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSeconds?: number | null;
  previewStartSeconds?: number | null;
  previewDurationSeconds?: number | null;
}

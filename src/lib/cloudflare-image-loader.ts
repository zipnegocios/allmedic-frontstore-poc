interface CloudflareLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

const PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

/**
 * Loader custom para next/image que usa Cloudflare Image Transformations (edge).
 * En desarrollo local, si no hay PUBLIC_URL configurada, retorna el src tal cual.
 */
export default function cloudflareImageLoader({ src, width, quality }: CloudflareLoaderParams): string {
  if (!PUBLIC_URL) return src;

  // Si src ya es una URL absoluta a otro host (ej. logos locales en /images), no transformar.
  if (src.startsWith("/") && !src.startsWith(PUBLIC_URL)) return src;

  const base = src.startsWith("http") ? src : `${PUBLIC_URL}/${src.replace(/^\//, "")}`;
  const params = `width=${width},quality=${quality ?? 80},format=auto`;

  // La URL de transformación se aplica sobre la zona del dominio público, insertando /cdn-cgi/image/...
  const url = new URL(base);
  return `${url.origin}/cdn-cgi/image/${params}${url.pathname}`;
}

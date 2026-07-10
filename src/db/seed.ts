/**
 * OBSOLETO — este seed sembraba banners/marcas/imágenes de producto con rutas de texto
 * (`/images/...`) y filas en `product_images`, ambos reemplazados por la Media Library
 * (`media_assets` + `media_links`, ver `scripts/migrate-media-to-r2.ts`).
 *
 * La base de datos de stage/producción ya está sembrada. Para poblar un catálogo demo
 * nuevo, crea productos/marcas/banners desde el panel admin (que sube imágenes vía R2)
 * en vez de reactivar este script.
 */

console.error(
  "[seed.ts] Este script está obsoleto — el esquema de imágenes (product_images, banners.image_*, brands.logo_url) ya no existe.\n" +
  "Usa el panel admin (/admin) para crear productos, marcas y banners con imágenes reales en R2."
);
process.exit(1);

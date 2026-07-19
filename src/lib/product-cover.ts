import type { Product } from './types';
import type { MediaItem } from './media';

// Módulo deliberadamente sin `import { db } from '@/db'` ni nada que arrastre
// `pg`: estas funciones son puras (operan sobre un `Product` ya resuelto) y se
// importan desde Client Components (ProductCard, Header, MegaMenu, etc.) —
// si vivieran en `data-service.ts` (que sí importa `db`), Turbopack intenta
// empaquetar `pg` para el navegador y el build de producción falla con
// "Module not found: Can't resolve 'dns'/'fs'/'net'/'tls'" (node builtins que
// no existen en el bundle de cliente). `data-service.ts` re-exporta desde aquí
// para no romper a los consumidores server-side existentes.

export function resolveCoverMedia(product: Product): MediaItem {
  if (product.cover) return product.cover;
  // Fallback to first GALLERY image of any variant
  for (const variant of product.variants) {
    if (variant.images && variant.images.length > 0) {
      return variant.images[0];
    }
  }
  // Fallback to placeholder
  return {
    url: '/images/placeholder-product.jpg',
    type: 'image',
    mimeType: 'image/jpeg',
    width: null,
    height: null,
  };
}

/** Segunda imagen del par primaria/secundaria de portada (crossfade hover) —
 * único punto de verdad, análogo a `resolveCoverMedia`. Sin fallback a variantes:
 * si no hay secundaria, el consumidor debe desactivar el hover-swap en vez de
 * repetir la primaria (evita un crossfade falso "hacia la misma imagen"). */
export function resolveSecondaryCoverMedia(product: Product): MediaItem | undefined {
  return product.secondaryCover;
}

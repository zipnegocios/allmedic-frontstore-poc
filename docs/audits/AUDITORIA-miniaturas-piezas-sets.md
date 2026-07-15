# Auditoría — Miniaturas de piezas rotas en las cards de `/admin/sets`

**Fecha:** 2026-07-15
**Alcance:** Fase 0 del plan (solo lectura, sin cambios en datos ni código de producción).

## 1. Dump de URLs generadas

Script de solo lectura: `scripts/diagnose-set-piece-thumbnails.ts` (`npx tsx scripts/diagnose-set-piece-thumbnails.ts`).

Para las 4 piezas (producto, set) de los 2 sets activos existentes en la BD conectada:

| Set | Producto | Rol | `storage_key` | URL con 1 resolución | URL real renderizada en la card |
|---|---|---|---|---|---|
| 958ff357… | Lindsey Scrub Pants | COVER | `products/koi-lindsey-scrub-pants/nv/product-6-navy-1.jpg` | `https://media.allmedicuniforms.com/products/koi-lindsey-scrub-pants/nv/product-6-navy-1.jpg` | `https://media.allmedicuniforms.com/https://media.allmedicuniforms.com/products/koi-lindsey-scrub-pants/nv/product-6-navy-1.jpg` |
| 9083dbb1… | Lindsey Scrub Pants | COVER | (mismo asset) | (misma) | (misma, duplicada) |
| 9083dbb1… | Lexie Scrub Top | COVER | `products/figs-catarina-scrub-top/bg/product-8-navy-1.jpg` | `https://media.allmedicuniforms.com/products/figs-catarina-scrub-top/bg/product-8-navy-1.jpg` | `https://media.allmedicuniforms.com/https://media.allmedicuniforms.com/products/figs-catarina-scrub-top/bg/product-8-navy-1.jpg` |
| 958ff357… | Workwear Scrub Top | COVER | `products/cherokee-workwear-scrub-top/nv/product-3-navy-1.jpg` | `https://media.allmedicuniforms.com/products/cherokee-workwear-scrub-top/nv/product-3-navy-1.jpg` | `https://media.allmedicuniforms.com/https://media.allmedicuniforms.com/products/cherokee-workwear-scrub-top/nv/product-3-navy-1.jpg` |

Todas las piezas tienen vínculo `COVER` (0 casos sin vínculo).

## 2. Verificación HTTP

| URL | Status |
|---|---|
| `.../products/koi-lindsey-scrub-pants/nv/product-6-navy-1.jpg` (1 resolución) | **200** |
| `.../https://media.allmedicuniforms.com/products/koi-lindsey-scrub-pants/nv/product-6-navy-1.jpg` (URL real de la card) | **404** |
| `.../products/figs-catarina-scrub-top/bg/product-8-navy-1.jpg` (1 resolución) | **200** |
| `.../products/cherokee-workwear-scrub-top/nv/product-3-navy-1.jpg` (1 resolución) | **200** |

Los 3 assets de portada de producto usados por las piezas de sets **existen en el bucket R2 y responden 200** cuando se les aplica `resolveMediaUrl` una sola vez.

## 3. Causa raíz confirmada

**Ninguna de las causas anticipadas (a, b, c, d) del plan aplica.** El diagnóstico contradice la conclusión preliminar del plan: no es un problema de datos, de bucket R2, ni de configuración de entorno.

**Causa raíz real: doble resolución de URL en código**, en `src/lib/admin-data-service.ts`:

- `getProductCoversMap()` (línea 980) **ya devuelve URLs completas** (`Promise<Map<string, string>>` con `coverMap.set(productId, resolveMediaUrl(coverLink.storageKey))`, líneas 1010 y 1017) — a pesar de que su nombre y el uso en `getAdminSets` sugieren que devuelve `storage_key` crudos.
- `getAdminSets()` (líneas 750-751) trata el valor del map como si fuera un `storage_key` crudo y le vuelve a aplicar `resolveMediaUrl()`:
  ```ts
  const storageKey = productCovers.get(item.productId); // en realidad ya es una URL completa
  const imageUrl = storageKey ? resolveMediaUrl(storageKey) : null; // BUG: segunda resolución
  ```
- Resultado: `imageUrl = "https://media.allmedicuniforms.com/" + "https://media.allmedicuniforms.com/products/..."`, una URL malformada que el navegador intenta cargar como una ruta literal y que el servidor responde con 404 → ícono de imagen rota.

Esto también explica por qué la **portada del propio set sí carga**: `getAdminSets` obtiene esa URL de `getSingleLinksUrlMap('SET', ...)` (línea 717) y la usa directamente vía `coverMap.get(r.id) ?? null` (línea 764), **sin** volver a llamar `resolveMediaUrl`.

## 4. Comparación asset roto vs. asset sano

No hay diferencia real entre los assets — ambos son `media_assets` válidos con `storage_key` bien formado y objeto presente en R2 (confirmado por status 200 con una sola resolución). La única diferencia es la ruta de código que los consume: una llama `resolveMediaUrl` una vez (sano) y la otra dos veces (roto).

## 5. Alcance del daño

Se revisaron todos los call-sites de `resolveMediaUrl` (`grep` en `src/` y `scripts/`):

- **`getProductCoversMap()`** tiene un solo llamador adicional además de `getAdminSets`: `getGroupEligibleProducts()` (línea 1069, selector de piezas al armar un set). Ese call-site usa `coverMap.get(p.id) ?? null` **directamente sin segunda resolución** — no está afectado.
- El catálogo público / sitio corporativo (`src/lib/corporate-data-service.ts`, `src/lib/data-service.ts`) **no reutiliza `getProductCoversMap`**; construye sus propios maps de portada con una sola resolución cada uno. No está afectado.
- **Conclusión de alcance:** el bug está confinado exclusivamente a la fila "Piezas" de las cards de `/admin/sets` (uso de `getAdminSets`). Ningún otro punto del admin ni del sitio público consume `productCovers` de esta forma.

## Siguiente paso

Fix de una línea en `getAdminSets` (eliminar la segunda llamada a `resolveMediaUrl`, ya que `getProductCoversMap` ya entrega la URL resuelta) — no requiere migración de datos, subida a R2, ni cambio de variables de entorno. Ver `docs/reports/REPORTE-miniaturas-piezas-sets-2026-07-15.md` para el detalle de la corrección aplicada.

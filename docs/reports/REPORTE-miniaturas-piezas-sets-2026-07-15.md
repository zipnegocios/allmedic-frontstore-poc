# Reporte — Corrección de miniaturas de piezas rotas en `/admin/sets`

## Causa raíz confirmada

Doble resolución de URL en código, no un problema de datos ni de R2. Ver detalle completo en [docs/audits/AUDITORIA-miniaturas-piezas-sets.md](../audits/AUDITORIA-miniaturas-piezas-sets.md).

`getProductCoversMap()` en `src/lib/admin-data-service.ts` ya devolvía la URL completa (`resolveMediaUrl(storageKey)` aplicado internamente), pero `getAdminSets()` volvía a tratar ese valor como un `storage_key` crudo y le aplicaba `resolveMediaUrl()` una segunda vez, generando URLs como `https://media.allmedicuniforms.com/https://media.allmedicuniforms.com/products/...jpg` (404).

## Corrección aplicada

1. **`src/lib/admin-data-service.ts`**
   - `getProductCoversMap()` ahora devuelve `Map<string, ProductCoverInfo>` (`{ url, mimeType, previewStart, previewDuration }`) en vez de un valor ambiguo, y sigue resolviendo la URL **una sola vez**.
   - `getAdminSets()` consume ese objeto directamente (`cover?.url`) sin volver a llamar `resolveMediaUrl`, y ahora también propaga `mimeType`/`previewStart`/`previewDuration` de la portada de cada pieza.
   - `getGroupEligibleProducts()` (selector de piezas del armador de sets) se actualizó al nuevo shape (`coverMap.get(p.id)?.url`) para no romper compilación; no se le agregó soporte de video por estar fuera del alcance reportado.

2. **`src/app/admin/(dashboard)/sets/page.tsx`**
   - `AdminSetItem` ahora incluye `mimeType`, `previewStart`, `previewDuration`.
   - Nuevo componente `PieceThumb`: si la portada de la pieza es un video (`mimeType` empieza con `video/`), renderiza un `<video>` muted/loop posicionado en el `previewStart` configurado del asset; si es imagen, renderiza `<img>`; en ambos casos, `onError` hace fallback a las iniciales del producto (nunca el ícono roto del navegador).
   - Nuevo componente `SetCoverThumb`: mismo endurecimiento `onError` para la portada del propio set (fallback al ícono de caja). Los sets no admiten upload de video (`VIDEO_ALLOWED_FOLDERS` no incluye `SETS`), así que no requiere lógica de video.

## Verificación

- Script de diagnóstico de solo lectura (temporal, eliminado tras uso) confirmó con datos reales de la BD conectada: antes del fix, las URLs de portada de las 4 piezas existentes venían duplicadas y respondían **404**; los mismos assets con una sola resolución respondían **200** (los objetos en R2 nunca estuvieron rotos).
- Tras el fix, se volvió a ejecutar `getAdminSets()` directamente (6 piezas, incluyendo sets nuevos creados durante la sesión): todas las `imageUrl` sin duplicación y **HTTP 200**.
- No hay actualmente ninguna pieza con portada en video en la BD, por lo que la rama de `<video>` de `PieceThumb` no pudo verificarse contra datos reales; su lógica replica el patrón ya probado en producción de `isVideoMime`/`mimeType.startsWith('video/')` usado en `MediaThumb.tsx`.

## Assets huérfanos pendientes

Ninguno. El diagnóstico de Fase 0 no encontró objetos faltantes en R2, `storage_key` malformados, ni discrepancias de bucket/dominio — el escenario contradijo la hipótesis preliminar del plan (casos a/b/c/d no aplican).

## Alcance

El bug estaba confinado a la fila "Piezas" de las cards de `/admin/sets`. No afectaba el catálogo público, el sitio corporativo, ni el selector de piezas del armador de sets (ese consumía el map correctamente sin doble resolución).

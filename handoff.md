# Handoff — Portadas por color en Sets Corporativos

## 1) Objetivo

Desacoplar la portada única (primaria/secundaria) de los sets corporativos y permitir una portada primaria (obligatoria) + secundaria (opcional) **por cada color** del set, con un orden manual donde el primero es el "color por defecto". El filtro de color de `/corporativo` pasa a cambiar dinámicamente la imagen de la card según el color elegido, no solo a filtrar qué cards se muestran.

## 2) Estado actual

**Funciona y está verificado** (`npm run build`, `tsc --noEmit`, `eslint`, `vitest` todos en verde sobre los archivos tocados):

- Modelo de datos: tabla `set_colors` (Set × Color, con `sortOrder`) + `media_links.colorId` poblado para `entityType='SET'`.
- Migración de schema aplicada en la base de desarrollo (`0028_solid_the_hood.sql`, vía `drizzle-kit generate` + aplicación manual del SQL — ver sección "Intentos fallidos").
- Migración de datos ejecutada: el único set vigente ("Skechers Athletic Pro Caballero") quedó con 6 colores en `set_colors`, con su portada original asignada al primer color.
- Backend: `admin-data-service.ts` (CRUD de `setColors` con patrón delete-all+insert-all, igual que `blocks`/`recommendedItems`), `corporate-data-service.ts` (`getColorCoverMediaMap`, `coversByColor` en `CorporateSetSummary`), `media-reorganize-service.ts` (storage organizado por `sets/{slug}/portada/{colorCode}/`).
- Admin (`/admin/sets/nuevo` y `/admin/sets/[id]`): nueva sección "Portadas por color" (`SetColorsSection.tsx`) desacoplada de "Datos generales", con drag-and-drop (`@dnd-kit`, mismo patrón que la galería de productos) para reordenar, ubicada después de "Bloques del set" y antes de "Precio" en el wizard mobile y en la vista desktop.
- Frontend `/corporativo`: filtro de color pasó de multi-select a selección única (`colorId: string | null`), toggle-to-null al reclickear el mismo swatch. Las cards (grid y lista) resuelven su imagen vía `resolveCardCover()` según el color filtrado, con fallback al color por defecto + badge de punto de color (Popover táctil, copy "Disponible en este color — imagen de referencia") cuando el color filtrado no tiene portada propia.
- PDP de set (`/corporativo/s/[slug]`) **no fue tocado** — ya tenía su propio sistema de galería dinámica por color basado en `productVariants`, fuera del alcance de este feature.

**Pendiente (no implementado en esta sesión):**

- Verificación manual end-to-end en navegador (crear/editar un set en el admin, cargar portadas de 2+ colores, reordenar, guardar, y confirmar en `/corporativo` que el filtro cambia la imagen). No se usó Chrome DevTools MCP (prohibido) ni ningún navegador — solo build/lint/typecheck/tests automatizados.
- No se probó el flujo de creación de un set nuevo desde cero en la UI real (`/admin/sets/nuevo`) más allá de que compila y tipa correctamente.
- El componente `ColorFallbackBadge` en `SetListItem.tsx` usa `absolute top-3 right-3`, mismo valor que en la card grid — en la miniatura más chica de la vista lista (`w-24 h-24` en mobile) podría verse ligeramente ajustado/recortado. No se ajustó el CSS para ese caso específico, es un detalle visual menor pendiente de revisión.
- No se migró/tocó nada del worktree separado `.claude/worktrees/ensamblador-sets-bloques` ni `rbac-gestion-usuarios` — sus tests de `docs.test.ts` fallan por una razón preexistente no relacionada (falta `COLOR_PAIRING` en `RULE_DOCS`), confirmado que ya fallaban antes de esta sesión.

## 3) Archivos y cambios

**Base de datos:**
- `src/db/schema/corporate.ts` — nueva tabla `setColors` (`set_colors`: `id`, `setId` cascade, `colorId` sin onDelete explícito, `sortOrder`, unique `(setId, colorId)`).
- `src/db/migrations/0028_solid_the_hood.sql` — migración generada y aplicada.
- `scripts/migrate-set-colors.ts` — script one-off (idempotente, soporta `--dry-run`) que calculó la intersección de colores entre bloques y pobló `set_colors` + reasignó `colorId` en `media_links` para el set existente. Ya ejecutado contra desarrollo; queda en el repo por si hace falta re-ejecutar en otro entorno.

**Backend:**
- `src/lib/admin-data-service.ts` — `replaceSingleLink` acepta `colorId` opcional; `getAdminSetById` devuelve `setColors[]` en vez de `cover`/`secondaryCover` sueltos; `createSetWithItems`/`updateSetWithItems` manejan `setColors` (delete-all+insert-all + `replaceSingleLink` por color); tipo `CorporateSetInput` actualizado.
- `src/lib/media-reorganize-service.ts` — `reorganizeSetMedia` ahora resuelve `colorCode` por `media_links.colorId` y construye la key con subcarpeta de color.
- `src/lib/media.ts` — `buildSetMediaKey` acepta `colorCode` opcional, usa `buildStorageKey` (no `buildFolderMediaKey`, que solo soporta 2 niveles) para poder anidar `portada/{colorCode}/`.
- `src/lib/corporate-data-service.ts` — nueva `getColorCoverMediaMap` (reemplaza a la vieja `getCoverMediaMap`, eliminada); `getActiveCorporateSets`, `getCorporateSetBySlug` y `getLatestCorporateSets` la usan; `cover`/`secondaryCover` a nivel set ahora se derivan del color por defecto (`coversByColor[0]`).
- `src/lib/corporate-types.ts` — `CorporateSetSummary.coversByColor: Array<{colorId, colorCode, sortOrder, cover, secondaryCover}>` nuevo.
- `src/lib/resolve-card-cover.ts` (nuevo) — `resolveCardCover(set, activeColorId)`, lógica compartida de resolución de portada + flag `isFallback`.

**Admin — formulario de sets:**
- `src/components/admin/set-form/schema.ts` — `SetColorSchema` nuevo; `SetFormSchema` perdió `coverAssetId`/`secondaryCoverAssetId`/etc. de nivel raíz, ganó `setColors: SetColorSchema[]` (min 1).
- `src/components/admin/set-form/CoverSlot.tsx` (nuevo) — extraído de `GeneralSection.tsx` para reusar en cada fila de color.
- `src/components/admin/set-form/SetColorsSection.tsx` (nuevo) — sección "Portadas por color": calcula intersección de colores, drag-and-drop con `@dnd-kit`, agrega/quita colores, fetch de combos MIXED cuando aplica.
- `src/components/admin/set-form/color-mode-utils.ts` — nueva función `computeSetColorIntersection(colorMode, items, products, colorCombos)`.
- `src/components/admin/set-form/GeneralSection.tsx` — perdió los 2 `CoverSlot` de portada; queda solo con nombre/slug/descripción/flags.
- `src/components/admin/set-form/wizard-steps.ts` — nuevo paso `set-colors` entre `pieces` y `price`.
- `src/components/admin/set-form/validation-summary.ts` — reemplazó labels de `coverAssetId`/`secondaryCoverAssetId` por `setColors`.
- `src/components/admin/SetForm.tsx` — `pickerRequest` ahora incluye `colorIndex`; `MediaPicker` resuelve `colorCode` de la fila activa para la subcarpeta de storage; `defaultValues`, `buildSetPayload` y ambas ramas (mobile/desktop) actualizadas.
- `src/app/admin/(dashboard)/sets/[id]/page.tsx` — `initialData` mapea `set.setColors` en vez de los campos de portada sueltos.
- `src/app/api/admin/sets/route.ts` y `src/app/api/admin/sets/[id]/route.ts` — schemas zod `CreateSetSchema`/`UpdateSetSchema` actualizados con `setColors`.

**Frontend `/corporativo`:**
- `src/lib/set-filter-logic.ts` — `SetFilterState.colors: string[]` → `colorId: string | null`; `matchesSetFilters`, `countActiveSetFilters` actualizados.
- `src/components/catalog/SetFilterSidebar.tsx` — swatches de color con toggle-to-null.
- `src/components/catalog/ColorFallbackBadge.tsx` (nuevo) — Popover táctil del badge de fallback.
- `src/app/(store)/corporativo/CorporativoContent.tsx` — cards del grid usan `resolveCardCover`, badge de fallback agregado.
- `src/components/catalog/SetListItem.tsx` — mismo cambio para la vista de lista, nueva prop `activeColorId`.

**Tests actualizados** (por cambios de tipos/contrato, no nueva cobertura):
- `src/lib/__tests__/set-filter-logic.test.ts`
- `src/components/admin/set-form/__tests__/wizard-steps.test.ts`

## 4) Intentos fallidos

- **`npm run db:migrate`** (`tsx src/db/migrate.ts`) — no aplica los archivos SQL de `src/db/migrations/`; es un script custom de sincronización imperativa que no conoce `set_colors`. No usar para esto.
- **`drizzle-kit push`** — falló con `Interactive prompts require a TTY terminal` (el entorno de ejecución no tiene TTY). No usar en este entorno; en su lugar se aplicó el SQL de la migración generada directamente contra la base con un script `pg.Pool` temporal (borrado después de usarlo).
- Escribir el script de aplicación de migración en `/tmp` (vía Git Bash) — falló con `ERR_MODULE_NOT_FOUND` para `dotenv` porque esa ruta queda fuera de `node_modules` del proyecto. Hay que escribir scripts temporales dentro del repo (ej. `scripts/_temp.mjs`) para que `npx tsx` resuelva dependencias.
- El explorador inicial (subagente) reportó "3 sets, incluyendo posibles inconsistencias" — en realidad había 2 sets en papelera (`deletedAt` no nulo) y 1 solo vigente, que es el que el usuario tenía en mente. El script de migración de datos filtra explícitamente por `deletedAt IS NULL` para no tocar los borrados.

## 5) Próximos pasos

1. Verificación manual en navegador (no automatizable con las herramientas disponibles en esta sesión):
   - Ir a `/admin/sets/[id]` del set "Skechers Athletic Pro Caballero", confirmar que la sección "Portadas por color" muestra los 6 colores con la portada migrada visible en el color por defecto.
   - Cargar una portada primaria + secundaria para 1–2 colores más, reordenar por drag-and-drop, guardar, y confirmar que persiste.
   - Ir a `/corporativo`, aplicar el filtro de color (ahora selección única) y confirmar que la card cambia de imagen; reclickear el mismo color y confirmar que se deselecciona.
   - Filtrar por un color que el set tenga pero sin portada propia y confirmar que aparece el badge de fallback con el Popover.
2. Revisar visualmente el badge de fallback en la vista de lista (`SetListItem`) en mobile — puede necesitar ajuste de posición/tamaño dado el contenedor más chico.
3. Probar el flujo completo de creación de un set nuevo desde `/admin/sets/nuevo`, incluyendo el bloqueo de guardado cuando no hay ningún color con portada.
4. Si se detectan problemas de datos en el único set migrado, corregir manualmente desde el admin (ya lo anticipaste como aceptable).
5. Sugerencia de mensaje de commit (no ejecutado — solo se sugiere, según las reglas del proyecto):
   ```
   git commit -m "feat(sets): desacoplar portada por color (Set x Color) y filtro dinamico en /corporativo"
   ```

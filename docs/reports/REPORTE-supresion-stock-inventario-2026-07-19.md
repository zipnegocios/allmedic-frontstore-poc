# Reporte — Supresión total de stock e inventario

**Fecha:** 2026-07-19
**Plan ejecutado:** `docs/superpowers/plans/2026-07-18-supresion-stock-inventario.md`

## Resumen

Se eliminó por completo el manejo de stock numérico e inventario del sistema (BD, backend, frontend y admin). El `status` manual de disponibilidad por variante (`AVAILABLE | BACKORDER | OUT_OF_STOCK`) queda como única fuente de verdad de disponibilidad, y su efecto se extendió al flujo corporativo (armador + `POST /api/corporate/quotes`) con re-validación bloqueante en servidor.

## Hallazgos de la auditoría (Fase 0) que ajustaron el alcance

- **`SetMeta.pieces` / `SetPieceInfo` se conservan.** No eran exclusivos de inventario: `pricing.ts` los usa para resolver ámbito `PRODUCT` de promociones, y `validate.ts` para `MIN_QUANTITY` contextual y el cálculo de unidades por pieza/color de `COLOR_RESTRICTION`. Solo se corrigió el comentario que los describía como "usados por INVENTORY_MODE".
- **`getSetPiecesByIds` se conserva** por la misma razón — alimenta `setMetaWithPieces`, usado por la validación general de reglas, no solo por inventario.
- **La query del armador (`getCorporateSetBySlug`) ya traía `status` sin filtrar** por variante — no hizo falta extender ninguna consulta para que el armador conociera la disponibilidad real.
- **Sin referencias estructurales a inventario en JSONB de cotizaciones** (`quoteItems.pricingBreakdown` solo guarda `{ composition: pieceSelections } `).
- **1 sola fila `INVENTORY_MODE`** existía en BD (GLOBAL, activa, sin `scopeId`) — la sembrada por el seed.

## Cambios por capa

**Base de datos:** `product_variants` perdió `stock`, `min_stock`, `location` (migración `0004_supresion_stock_inventario.sql`, aplicada). `business_rules` perdió la fila `INVENTORY_MODE`. Migradores idempotentes (`src/db/migrate.ts`, `scripts/migrate.js`) y seeds (`seed-corporate.ts`, `seed-from-dummy.ts`, `seed-postgres.ts`) actualizados para no volver a crearlas.

**Motor de reglas puro:** `src/lib/rules-engine/inventory.ts` y su suite de tests eliminados. `INVENTORY_MODE` fuera de `RuleType`, `InventoryModeConfig`, `InventoryIssue`(`Severity`), `InventoryStockSnapshot` y `ResolvedRules.inventoryMode`. Tests de `docs`/`rules-engine` actualizados (9 tipos de regla en vez de 10).

**Capa de datos y API:** `getInventorySnapshotByProductIds` reemplazada por `getVariantAvailabilityByProductIds` (una sola consulta, sin agregación de stock). Endpoint dry-run `POST /api/corporate/cart/check-inventory` eliminado. `POST /api/corporate/quotes` reescrito: resuelve la variante concreta de cada `pieceSelection` con una única consulta agregada, bloquea (400) en `OUT_OF_STOCK` o combinación inexistente, y registra avisos de `BACKORDER` en `internalNotes` (mismo mecanismo `noteBlocks` que ya existía). APIs y capa de datos de admin de productos dejaron de leer/escribir `stock`/`minStock`.

**Frontend corporativo:** `SetDetailContent.tsx` perdió la capa numérica de disponibilidad (`stockSnapshot`, "X disp. en esta talla/color") — el bloqueo/aviso visual de `status` ya existía de antes vía `SizeSelector`/`ColorSwatchGroup` (reutilizados del catálogo individual, sin duplicar componentes). `CorporateCartContext.tsx` perdió el dry-run debounced y `inventoryIssues`; `canSubmit` vuelve a depender solo de `validation.canSubmit`. `CorporateCartDrawer.tsx`/`solicitud/page.tsx` perdieron el render de avisos de inventario — el error 400 del servidor se muestra con el patrón de errores ya existente.

**Frontend individual:** sin cambios funcionales — confirmado que `Product.tsx`, `ProductCard.tsx` y `data-service.ts` solo usaban `status`.

**Admin:** `product-form/schema.ts` y `VariantsMediaSection.tsx` perdieron los campos/inputs de Stock y Stock mínimo (`status` se conserva). `/admin/reglas` perdió `INVENTORY_MODE` del selector, schema de validación, docs embebidos y detector de conflictos (nunca lo evaluaba). El dashboard perdió el widget "Stock bajo".

**Documentación:** `docs/audits/AUDITORIA-motor-reglas.md` y `AUDITORIA-corporativo-armador.md` reescritas de forma atemporal (9 tipos de regla, sin sección de inventario). Los `docs/reports/*` y `docs/superpowers/plans/*` fechados se dejaron intactos como registro histórico de sesiones pasadas — no son documentación viva del estado actual.

## Efectos colaterales encontrados y corregidos (no pedidos explícitamente, pero directamente relacionados)

- `CorporateCartDrawer.tsx` tenía una rama de texto ("Resuelve el stock insuficiente...") que quedó inalcanzable al unificar `canSubmit` con `validation.canSubmit` — se simplificó el ternario.
- Copy en `PiecesSection.tsx` ("no tiene stock disponible") reformulada para no usar el término inventario.

## Validación

- `tsc --noEmit`: limpio.
- `next build`: exitoso, confirmado que `/api/corporate/cart/check-inventory` ya no existe como ruta.
- `eslint` (repo completo): mismo baseline de errores preexistentes que antes del plan en cada archivo tocado (comparado línea por línea contra `git show HEAD`) — cero hallazgos nuevos.
- `vitest run`: 329/329 tests en verde (33 archivos), sin la suite de `inventory.test.ts`.
- Migración `0004` aplicada contra la BD real; `migrate.ts` y `seed-corporate.ts` ejecutados — `seed-corporate.ts` confirmó que ya no reinserta `INVENTORY_MODE`.
- Verificación directa en BD: `product_variants` sin `stock`/`min_stock`/`location`; `business_rules` sin filas `INVENTORY_MODE`.

## Caso límite resuelto (flag del plan, punto 3.3)

Una combinación pedida sin variante existente en BD se trata como violación 400 "combinación no disponible" (mismo criterio que `OUT_OF_STOCK`), tal como recomendaba el plan.

## Pendiente de verificación manual (checklist para Gustavo)

Ver la lista de 7 pasos en la sección "Verificación manual en producción" del plan — no se pudo ejecutar en esta sesión porque el proyecto tiene prohibido el uso de Chrome DevTools MCP; la validación automatizada (arriba) cubre build/lint/typecheck/tests, pero el recorrido visual en `/admin`, `/catalogo` y `/corporativo` queda para revisión manual.

## Commits sugeridos

```bash
git commit -m "feat!: eliminar el manejo de stock e inventario del sistema, conservando la disponibilidad manual por variante y extendiendola al flujo corporativo con re-validacion en servidor"
```

O en commits separados:

```bash
git commit -m "feat!: eliminar INVENTORY_MODE del motor de reglas y el stock numerico de product_variants con migracion de supresion"
git commit -m "feat: validar disponibilidad manual de variantes en el armador corporativo y en POST /api/corporate/quotes"
git commit -m "docs: actualizar auditorias y documentacion del motor de reglas sin inventario"
```

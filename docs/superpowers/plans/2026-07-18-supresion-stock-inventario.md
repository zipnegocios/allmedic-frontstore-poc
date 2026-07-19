# Supresión Total de Stock e Inventario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar por completo el manejo de stock numérico e inventario del sistema (código + base de datos, backend, frontend y admin), conservando únicamente el `status` manual de disponibilidad por variante (`AVAILABLE | BACKORDER | OUT_OF_STOCK`) como concepto independiente del inventario, y extendiendo su efecto al flujo corporativo con re-validación en servidor.

**Architecture:** Se elimina la regla `INVENTORY_MODE` del motor de reglas puro (`src/lib/rules-engine/`), el snapshot de stock de la capa de datos, el endpoint dry-run de inventario y las columnas numéricas de `product_variants`. El `status` manual pasa a ser la única fuente de verdad de disponibilidad: el catálogo individual mantiene su comportamiento actual sin cambios, y el flujo corporativo (armador de combinaciones + `POST /api/corporate/quotes`) pasa a respetarlo con el mismo criterio (bloqueo en `OUT_OF_STOCK`, aviso informativo en `BACKORDER`).

**Tech Stack:** Next.js App Router, Drizzle ORM/PostgreSQL, react-hook-form + zod, shadcn/ui, Vitest.

---

## Decisiones arquitectónicas ya tomadas (NO reabrir)

1. **`status` de variante se conserva** con sus tres valores y su copy actual (Disponible / Bajo pedido / Agotado). El front individual mantiene badges y bloqueo sin cambios de comportamiento.
2. **Supresión total e inmediata en BD**: migración Drizzle con `DROP COLUMN` de `stock`, `min_stock` y `location` en `product_variants`, y `DELETE` de todas las filas `INVENTORY_MODE` en `business_rules` (incluida la global sembrada).
3. **El flujo corporativo respeta el `status` igual que el individual**: el armador de combinaciones bloquea la selección de variantes `OUT_OF_STOCK` y muestra aviso informativo en `BACKORDER`. Este es un comportamiento parcialmente nuevo (hoy el armador no consulta `status` directamente).
4. **Re-validación completa en servidor**: `POST /api/corporate/quotes` rechaza con 400 si alguna combinación incluye una variante `OUT_OF_STOCK` (espejo del bloqueo del armador) y registra en las notas internas de la cotización los avisos de variantes `BACKORDER` (reutilizando el mecanismo de `noteBlocks` que hoy usan los avisos informativos de inventario).

## Global Constraints

- Todo copy de usuario/UI en español (Ecuador). Cero referencias temporales en docs ("próximamente", "eliminado en esta fase", etc.) — la documentación describe el estado final como si siempre hubiera sido así.
- Regla de oro del proyecto: toda validación de negocio se re-ejecuta en servidor; el cliente solo previsualiza.
- El motor de reglas (`src/lib/rules-engine/`) permanece **puro, sin dependencias de BD**.
- No duplicar componentes para responsive; no introducir deuda técnica.
- El comportamiento del catálogo individual respecto al `status` **no cambia en absoluto** (badges, bloqueo de agotado, selección inicial de talla que evita `OUT_OF_STOCK`, avisos de `BACKORDER` al agregar al carrito).
- Principio "sin opciones muertas": tras la supresión, ninguna UI del admin debe ofrecer configuraciones de inventario que ya no hacen nada.
- No ejecutar `git commit` ni `git push`; solo sugerir mensajes de commit al final.
- No usar MCP Chrome DevTools.
- Validación exclusivamente por build, lint, typecheck y Vitest.
- Ejecutar migraciones Drizzle y seeds necesarios para dejar el entorno consistente.
- No crear archivos Markdown de resumen; entregar el resumen ejecutivo en el chat y generar el reporte de cambios en `docs/reports/`.

---

## Fase 0 — Auditoría obligatoria (antes de tocar código)

Producir una **matriz de estado verificada** en el chat (no como archivo) antes de cualquier cambio. Buscar en todo el repo (`grep -ri`) los términos: `stock`, `minStock`, `min_stock`, `inventory`, `INVENTORY_MODE`, `InventoryIssue`, `InventoryStockSnapshot`, `checkInventory`, `getInventorySnapshot`, `check-inventory`, `location` (en contexto de variantes), `agotado`, `OUT_OF_STOCK`, `BACKORDER`.

- [ ] **0.1 — Confirmar el inventario de puntos de contacto.** Verificar y ampliar esta lista preliminar:
  - **BD/esquema:** `src/db/schema/products.ts` (`stock`, `minStock`, `location` en `productVariants`), `src/db/migrate.ts` y `scripts/migrate.js` (bloques `ALTER TABLE ... ADD COLUMN stock/location/min_stock` y `CREATE TABLE product_variants` con esas columnas), seeds que escriban stock.
  - **Motor de reglas:** `src/lib/rules-engine/inventory.ts` (completo), `types.ts` (`INVENTORY_MODE` en `RuleType`, `InventoryModeConfig`, `InventoryIssue`, `InventoryIssueSeverity`, `InventoryStockSnapshot`, `SetMeta.pieces`, `SetPieceInfo`), `resolve.ts` (default y resolución de `inventoryMode` en `ResolvedRules`), `docs.ts` (entrada `INVENTORY_MODE` + menciones en `interactions`/`warnings` de otras reglas), `validation.ts`/`pricing.ts` si referencian inventario, detector de conflictos, `__tests__/inventory.test.ts` (13 tests) y cualquier test de otros módulos que use `inventoryMode`.
  - **Capa de datos:** `src/lib/corporate-data-service.ts` — `getInventorySnapshotByProductIds` (eliminar) y `getSetPiecesByIds` (verificar si tiene otros consumidores además de inventario; ver 0.2).
  - **API:** `src/app/api/corporate/quotes/route.ts` (bloque de `checkInventory`, `stockSnapshot`, `blockIssues`, `informativeIssues`), `src/app/api/corporate/cart/check-inventory/route.ts` (eliminar endpoint completo), APIs de admin de productos que lean/escriban `stock`/`minStock`/`location`.
  - **Front corporativo:** `CorporateCartContext.tsx` (dry-run con debounce, `inventoryIssues`, composición de `canSubmit`), `CorporateCartDrawer.tsx`, `solicitud/page.tsx`, `SetDetailContent.tsx` (armador).
  - **Front individual:** `src/legacy-pages/Product.tsx`, `src/components/catalog/ProductCard.tsx` — verificar que solo usan `status` (se conservan) y detectar cualquier uso de stock numérico (eliminar).
  - **Admin:** `src/components/admin/product-form/VariantsSection.tsx` (campos stock/stock mínimo), `schema.ts` (`VariantSchema.stock/minStock`; `STATUSES` se conserva), listado `/admin/products` (columnas o filtros de stock), `/admin/reglas` (`RuleForm`, selector de tipo de regla, docs embebidos, filtros), y cualquier dashboard/widget de "stock bajo".
  - **Docs del repo:** `docs/audits/AUDITORIA-motor-reglas.md` y cualquier doc que describa `INVENTORY_MODE` — actualizar de forma atemporal (la regla simplemente no existe; no narrar su eliminación).
- [ ] **0.2 — Verificar dependencias cruzadas de `SetMeta.pieces` y `getSetPiecesByIds`.** `piecesPerSet` (número) lo usa `MIN_QUANTITY` con `countUnit: "PIECES"` y **debe conservarse**. Determinar si `SetMeta.pieces` (array `SetPieceInfo[]`) y `getSetPiecesByIds` tienen algún consumidor distinto de inventario (p. ej. `computeCartPricing`, `validateCorporateCart`, editor de cotizaciones). Si el único consumidor es inventario → eliminarlos; si hay otro consumidor real → conservarlos y documentar por qué. ⚠️ FLAG PARA REVISIÓN: reportar el hallazgo en el resumen final.
- [ ] **0.3 — Verificar la forma actual de datos del armador.** Confirmar cómo `SetDetailContent.tsx` obtiene las variantes de cada pieza (talla/color) y si el `status` ya viaja en ese payload. Si no viaja, identificar la query de la capa de datos a extender (sin crear queries duplicadas).
- [ ] **0.4 — Verificar filas reales de `INVENTORY_MODE` en BD** (cuenta y ámbitos) para dimensionar el `DELETE` de la migración.
- [ ] **0.5 — Confirmar que ninguna cotización/quote persiste referencias estructurales a inventario** (p. ej. `pricingBreakdown` u otros JSONB). Los textos históricos ya grabados en `internal_notes` son snapshots inmutables y **no se tocan**.

**Checkpoint:** presentar la matriz verificada y cualquier desviación respecto a este plan antes de continuar con la Fase 1.

---

## Fase 1 — Base de datos

- [ ] **1.1 — Actualizar el esquema Drizzle.** En `src/db/schema/products.ts`, eliminar `stock`, `minStock` y `location` de `productVariants`. `status` permanece intacto.
- [ ] **1.2 — Generar migración Drizzle** con:
  - `ALTER TABLE product_variants DROP COLUMN IF EXISTS stock;`
  - `ALTER TABLE product_variants DROP COLUMN IF EXISTS min_stock;`
  - `ALTER TABLE product_variants DROP COLUMN IF EXISTS location;`
  - `DELETE FROM business_rules WHERE rule_type = 'INVENTORY_MODE';`
- [ ] **1.3 — Limpiar migradores idempotentes legacy.** En `src/db/migrate.ts` y `scripts/migrate.js`: eliminar los bloques que agregan `stock`/`location`/`min_stock`, y quitar esas columnas del `CREATE TABLE IF NOT EXISTS product_variants` para que instalaciones nuevas nazcan sin ellas.
- [ ] **1.4 — Actualizar seeds.** En `src/db/seed-corporate.ts`, eliminar la regla global `INVENTORY_MODE` de `globalRulesData`. Revisar otros seeds que escriban `stock`/`minStock`/`location` en variantes y limpiarlos.
- [ ] **1.5 — Ejecutar** la migración y los seeds necesarios para dejar el entorno consistente.

**Validación:** build + typecheck deben fallar en todos los puntos que aún referencien las columnas eliminadas — usar esos errores como checklist natural de las fases siguientes.

---

## Fase 2 — Motor de reglas (módulo puro)

- [ ] **2.1 — Eliminar `src/lib/rules-engine/inventory.ts`** completo y `src/lib/rules-engine/__tests__/inventory.test.ts`.
- [ ] **2.2 — Limpiar `types.ts`:** quitar `INVENTORY_MODE` de `RuleType`, `InventoryModeConfig`, `InventoryIssue`, `InventoryIssueSeverity`, `InventoryStockSnapshot`, y `inventoryMode` de `ResolvedRules`. Según 0.2, quitar (o conservar con justificación) `SetPieceInfo` y `SetMeta.pieces`. `SetMeta.piecesPerSet` se conserva (lo usa `MIN_QUANTITY` en `PIECES`).
- [ ] **2.3 — Limpiar `resolve.ts`:** eliminar el default y la resolución de `inventoryMode`.
- [ ] **2.4 — Limpiar `docs.ts`:** eliminar la entrada `INVENTORY_MODE` y toda mención a inventario/stock en `interactions`/`warnings` de otras reglas. Redacción atemporal.
- [ ] **2.5 — Detector de conflictos:** eliminar cualquier chequeo que involucre `INVENTORY_MODE`.
- [ ] **2.6 — Tests colaterales:** actualizar tests de `resolve`/`validation`/`pricing` que construyan `ResolvedRules` o reglas `INVENTORY_MODE`.

---

## Fase 3 — Capa de datos y API

- [ ] **3.1 — `corporate-data-service.ts`:** eliminar `getInventorySnapshotByProductIds`. Aplicar la decisión de 0.2 sobre `getSetPiecesByIds`.
- [ ] **3.2 — Eliminar el endpoint dry-run** `POST /api/corporate/cart/check-inventory` (carpeta de ruta completa).
- [ ] **3.3 — Reescribir la sección de disponibilidad de `POST /api/corporate/quotes`:**
  - Eliminar snapshot de stock, `checkInventory`, `blockIssues`/`informativeIssues` de inventario.
  - Nueva verificación de `status`: resolver la variante concreta de cada `pieceSelection` (productId + size + color; contemplar piezas sin talla y/o sin color según `SIZE_MODE`) con una única consulta agregada — **sin** consultas por fila.
    - Si alguna variante resuelta tiene `status = 'OUT_OF_STOCK'` → 400 con detalle en español de qué set/pieza/talla/color está agotado (misma forma de respuesta `{ error, violations }` que el resto de validaciones).
    - Si hay variantes `BACKORDER` → la solicitud procede (201) y se agrega un bloque a `noteBlocks`: `"Piezas bajo pedido al momento de la solicitud:"` con el detalle por línea.
    - ⚠️ Caso límite — combinación sin variante existente en BD: definir comportamiento explícito (recomendado: tratar como violación 400 "combinación no disponible", coherente con "sin opciones muertas"). FLAG PARA REVISIÓN en el resumen final.
- [ ] **3.4 — APIs de admin de productos:** eliminar lectura/escritura de `stock`, `minStock`, `location` en create/update de variantes. `status` sigue siendo editable.
- [ ] **3.5 — Capa de datos del armador:** según 0.3, extender la query existente de detalle de set corporativo para incluir `status` por variante de cada pieza, si aún no viaja.

---

## Fase 4 — Frontend corporativo

- [ ] **4.1 — `SetDetailContent.tsx` (armador de combinaciones):**
  - Opciones de talla/color cuya variante resuelta esté `OUT_OF_STOCK`: visibles pero deshabilitadas, con el badge/copy "Agotado" (reutilizar el lenguaje visual de disponibilidad del catálogo individual; extraer a componente compartido solo si no implica duplicación — nunca dos versiones del mismo JSX).
  - Variantes `BACKORDER`: seleccionables, con aviso informativo "Bajo pedido" en la fila de la combinación.
  - Una combinación ya agregada que quede agotada tras un cambio de datos no debe poder reenviarse: el bloqueo real es el del servidor (3.3); la UI muestra el error 400 devuelto.
- [ ] **4.2 — `CorporateCartContext.tsx`:** eliminar el debounce del dry-run, el estado `inventoryIssues` y su participación en `canSubmit` (que vuelve a depender solo de `validation.canSubmit`). Eliminar todo fetch a `/api/corporate/cart/check-inventory`.
- [ ] **4.3 — `CorporateCartDrawer.tsx` y `solicitud/page.tsx`:** eliminar el render de avisos de inventario (rojo/ámbar). Asegurar que el error 400 de disponibilidad del servidor se muestre con el mismo patrón de errores de reglas ya existente.

---

## Fase 5 — Frontend individual

- [ ] **5.1 — Verificación de no-regresión (sin cambios funcionales):** `Product.tsx`, `ProductCard.tsx`, buscador y carrito individual conservan exactamente el comportamiento actual basado en `status`. Solo eliminar cualquier referencia residual a stock numérico que aparezca en la auditoría (tipos, props, mapeos de `data-service.ts` que expongan `stock`).

---

## Fase 6 — Admin

- [ ] **6.1 — `product-form/schema.ts`:** eliminar `stock` y `minStock` de `VariantSchema`. `STATUSES` y el campo `status` se conservan.
- [ ] **6.2 — `VariantsSection.tsx`:** eliminar los inputs de stock y stock mínimo (y `location` si existe en la UI); ajustar el `appendVariant` y el layout de la fila. El wizard mobile hereda el cambio automáticamente (componente único — no tocar presentaciones por separado).
- [ ] **6.3 — Listado `/admin/products`:** eliminar columnas, badges o filtros basados en stock numérico (tanto en tabla desktop como en las cards mobile). Los derivados de `status` se conservan.
- [ ] **6.4 — `/admin/reglas`:** eliminar `INVENTORY_MODE` del selector de tipo de regla, del formulario (`RuleForm`), de los filtros, de los docs embebidos y del detector de conflictos en UI. Verificar que una regla inexistente en BD (ya borrada por la migración) no deje estados rotos en el listado.
- [ ] **6.5 — Dashboards/widgets:** eliminar cualquier indicador de "stock bajo" o similar detectado en la auditoría.

---

## Fase 7 — Documentación y limpieza final

- [ ] **7.1 — Docs del repo:** actualizar `docs/audits/AUDITORIA-motor-reglas.md` y todo doc que describa inventario/`INVENTORY_MODE`, con redacción atemporal (el sistema tiene nueve tipos de regla; no narrar que "antes eran diez").
- [ ] **7.2 — Barrido final:** `grep -ri` de los términos de la Fase 0 sobre `src/` y `docs/` — el resultado debe ser vacío salvo: (a) usos legítimos de `status`/`OUT_OF_STOCK`/`BACKORDER`/`agotado` (disponibilidad manual conservada) y (b) snapshots inmutables históricos en BD (no aplica a código).
- [ ] **7.3 — Reporte de cambios** en `docs/reports/` según el flujo global.

---

## Validación final

- `npm run build` ✅
- `npm run lint` ✅
- Typecheck ✅
- `vitest` completo ✅ (sin tests de inventario; suites de resolve/validation/pricing verdes)
- Migración y seeds ejecutados ✅

## Verificación manual en producción (checklist para Gustavo)

1. `/admin/products` → editar un producto: la fila de variante muestra color, talla, fit, SKU y estado — sin stock ni stock mínimo. Cambiar estado a "Agotado" y guardar.
2. Catálogo individual: el producto muestra badge "Agotado" en la tarjeta y bloquea "agregar al carrito" en la ficha (comportamiento idéntico al previo).
3. `/corporativo` → armador de un set que incluya esa pieza: la talla/color agotada aparece deshabilitada con badge; una variante "Bajo pedido" es seleccionable con aviso.
4. Enviar una solicitud corporativa con piezas "Bajo pedido": la solicitud entra (201) y la cotización en `/admin/cotizaciones` muestra la nota interna de piezas bajo pedido.
5. Intentar enviar (manipulando el request si es necesario) una combinación con variante agotada: el servidor responde 400 con el detalle.
6. `/admin/reglas`: "Modo de inventario" no existe en el selector ni en filtros ni en docs; las reglas restantes funcionan.
7. BD: `product_variants` sin columnas `stock`/`min_stock`/`location`; `business_rules` sin filas `INVENTORY_MODE`.

## Commits sugeridos

```bash
git commit -m "feat!: eliminar el manejo de stock e inventario del sistema, conservando la disponibilidad manual por variante y extendiendola al flujo corporativo con re-validacion en servidor"
```

O en commits separados si se prefiere granularidad:

```bash
git commit -m "feat!: eliminar INVENTORY_MODE del motor de reglas y el stock numerico de product_variants con migracion de supresion"
git commit -m "feat: validar disponibilidad manual de variantes en el armador corporativo y en POST /api/corporate/quotes"
git commit -m "docs: actualizar auditorias y documentacion del motor de reglas sin inventario"
```

# Auditoría — Ensamblador de sets corporativos: bloques de alternancia

Fecha: 2026-07-23. Fase 0 del plan `docs/superpowers/plans/2026-07-23-ensamblador-sets-bloques-alternancia.md`, obligatoria
antes de tocar código. Todo lo listado abajo es lectura directa de código o consulta directa (read-only) a la base de
datos real, no inferencia sobre intención de diseño.

## 1. Consumidores de `setItems` (tabla Drizzle)

**Definición:** `src/db/schema/corporate.ts:44-61` — tabla `set_items`: `id, setId (FK → corporate_sets, cascade),
productId (FK → products), quantityPerSet (default 1), sortOrder (default 0)`. Índices `idx_set_items_set`,
`idx_set_items_product`. Constraint único `uq_set_items_set_product` (línea 55) — impide el mismo producto dos veces
en el mismo set. Relación en `corporate.ts:37-41` (`corporateSets.items = many(setItems)`).

Consumidores reales (confirmados leyendo cada archivo; se descartaron coincidencias de texto que eran variables de
estado React locales, no la tabla):

- **`src/lib/corporate-data-service.ts`** (front público):
  - `getActiveCorporateSets` (101-230): JOIN de `setItemsTable` con `products`/`productTypes` (125-140), calcula
    `autoPrice` sumando `priceWholesale(Sale) × quantityPerSet` (163-177), agrega colores/tallas/estilos del grid.
  - `getCorporateSetBySlug` (233-472): trae cada `setItem` con producto/precio/tipo/género (260-278), variantes e
    imágenes por producto+color (281-416) para construir `pieces: SetPiece[]`.
  - `getSetPricesByIds` (478-525): entrada del precio por set hacia `computeCartPricing` — suma
    `priceWholesale(Sale) × quantityPerSet`, salvo `priceManual`.
  - `getSetMetaByIds` (528-552): agrega `piecesPerSet` sumando `quantityPerSet` — usado por `MIN_QUANTITY` con
    `countUnit: "PIECES"`.
  - `getSetPiecesByIds` (556-580): devuelve `SetPieceInfo[]` (productId, productName, quantityPerSet) — usado por
    reglas de ámbito PRODUCTO y por `COLOR_RESTRICTION` en `validate.ts`.

- **`src/lib/admin-data-service.ts`** (panel admin):
  - `getAdminSets` (1065-1146): cuenta piezas por set y arma `productsBySetMap` para el listado.
  - `getAdminSetById` (1149-1200): trae `items` completos para precargar `SetForm`.
  - `createSetWithItems` (1249-1287): `deriveSetBrandId` desde `items.map(i => i.productId)` (1251); inserta filas en
    `setItemsTable` en transacción (1260-1269); llama `syncColorPairingRule` (1271).
  - `updateSetWithItems` (1289-1337): **borra TODAS las filas de `setItemsTable` del set y reinserta desde cero** si
    `items !== undefined` (1304-1316) — reemplazo atómico completo, no diff/upsert.
  - `permanentlyDeleteSet` (1353-1373): borra `setItemsTable` explícito antes de borrar el set (el cascade ya lo
    cubriría, pero se hace explícito por claridad).
  - `getTrashedSets`: mismo conteo de piezas para la papelera.

- **`src/components/admin/SetForm.tsx`**: no importa `setItemsTable` — usa `useFieldArray({ control, name: 'items' })`
  (línea 115) sobre `SetFormData['items']`. `buildSetPayload` envía `{ ...data, items: data.items.map((item, idx) =>
  ({...item, sortOrder: idx})) }`.

- **`src/components/admin/set-form/PiecesSection.tsx`**: presentación pura — recibe `items`, `fields`, `append`,
  `remove` como props desde `SetForm.tsx`. No toca Drizzle.

- **`src/components/admin/set-form/schema.ts`** (9-12, 35): `SetItemSchema = z.object({ productId, quantityPerSet })`;
  `SetFormSchema.items = z.array(SetItemSchema).min(1, ...)` — exige **mínimo 1 pieza, sin tope**, sin agrupación por
  bloques. No existe hoy ninguna validación de "exactamente 2 opciones por bloque, 2 bloques fijos".

- **`src/db/seed-corporate.ts`** (94-190): `seedCorporateSets()` inserta 3 sets de ejemplo con `colorMode: "PAIRED"`,
  2-3 `items` cada uno, vía `db.insert(schema.setItems)` — idempotente (omite si el slug ya existe).

Descartados por ser falsos positivos (variable de estado React `setItems`/`setItemsPerPage`, sin relación con la
tabla): `useSetFilter.ts`, `papelera/page.tsx`, `QuoteEditor.tsx`, `CartContext.tsx`, `legacy-pages/Home.tsx`,
`FilterableProductSection.tsx`, `BrandCarousel.tsx`, `CorporativoContent.tsx`, `CatalogoContent.tsx`.

## 2. Forma exacta de `pieceSelections` — hallazgo que ajusta el plan

**Dos definiciones de tipo coexisten para la misma forma lógica, sin import compartido (drift ya existente, no
introducido por este plan):**

- `src/lib/rules-engine/types.ts:211-213` (motor puro): `CorporateCartLine { quantity: number; pieceSelections:
  Array<{ productId: string; size?: string; color?: string }> }`.
- `src/context/CorporateCartContext.tsx:17-22` (estado UI): misma forma + `id` propio de React.

**Hallazgo relevante para el plan:** el modelo actual **ya permite color por pieza** (`color?: string` en cada
selección) y ya tiene una regla `COLOR_PAIRING` (colores deben ser DISTINTOS entre piezas del mismo set) más un
`colorMode: 'PAIRED' | 'MIXED'` a nivel de set con `colorCombos` curados para el modo MIXED
(`corporate-types.ts`/`corporate-data-service.ts:422-440`). El plan pide lo opuesto: **un único color compartido**
para todas las piezas de la combinación. Esto implica que la Fase 3/6 no solo "simplifican" `COLOR_RESTRICTION` como
dice el plan, sino que deben **retirar o neutralizar `COLOR_PAIRING` y el concepto `colorMode`/`colorCombos` para el
nuevo modelo de bloques** (o documentar explícitamente que quedan reservados para un modelo que este plan reemplaza).
Se marca como punto abierto para Fase 3 — no bloquea el resto, pero el plan original no lo menciona y debe
resolverse ahí explícitamente en vez de dejarlo implícito.

**Consumo:**
- `validate.ts` (136-148, 175-207): valida estructura no vacía, talla si `sizeMode !== 'NO_SIZES'`, `COLOR_PAIRING`
  (colores distintos), `COLOR_RESTRICTION` (unidades = `quantity × quantityPerSet` por pieza+color).
- `SetDetailContent.tsx:25-32`: `PieceSelection`/`PieceSelectionMap`/`CombinationRow.pieceSelections`.
- `CorporateCartContext.tsx:69-107`: `lineKey()` serializa con `JSON.stringify` para deduplicar; `migrateLine()`
  migra un formato legacy pre-armador.
- `corporate-data-service.ts:596-609` (`getVariantAvailabilityByProductIds`).

### `INVENTORY_MODE` — no es un stub, fue eliminado del sistema (ajuste confirmado con el usuario)

- No existe en `RuleType` (`types.ts:4-14`, 10 tipos, ninguno `INVENTORY_MODE`).
- No existe en `RULE_DOCS` (`docs.ts:65-440`).
- Confirmado por `src/db/migrations/0004_supresion_stock_inventario.sql:4`: `DELETE FROM "business_rules" WHERE
  "rule_type" = 'INVENTORY_MODE'`.
- Confirmado por `docs/reports/REPORTE-supresion-stock-inventario-2026-07-19.md:22`: motor de reglas puro,
  `inventory.ts` y su suite eliminados; `INVENTORY_MODE` fuera de `RuleType`, `InventoryModeConfig`, `InventoryIssue`,
  `InventoryStockSnapshot`, `ResolvedRules.inventoryMode`.
- **`AGENTS.md:214` está desactualizado** — todavía lista `INVENTORY_MODE` como `RuleType` soportado. No es fuente de
  verdad para este plan.
- Lo que reemplazó a `INVENTORY_MODE` es `product_variants.status` (`AVAILABLE | BACKORDER | OUT_OF_STOCK`), filtrado
  en `getVariantAvailabilityByProductIds` y en `SetDetailContent.tsx:66`.

**Decisión confirmada con el usuario:** el plan se ejecuta **quitando toda mención a `INVENTORY_MODE`** en las Fases 3
y 6 — solo se evalúan `MIN_QUANTITY` y `COLOR_RESTRICTION` sobre las piezas elegidas; disponibilidad sigue
manejándose vía `product_variants.status`, fuera del motor de reglas.

## 3. `getCorporateSetBySlug` — qué trae hoy sobre variantes/colores

`src/lib/corporate-data-service.ts:233-472`. Retorna `Promise<CorporateSetDetail | null>`.

- Query de variantes (281-298): **sin filtrar por `status`** a nivel de query — el filtrado de disponibilidad para
  agregados (`colorMapAgg`/`sizeSetAgg`/`stylesMapAgg`) ocurre después (línea 348); `mappedVariants` (390-402) incluye
  variantes con cualquier `status`. El filtrado real para bloquear selección en UI vive en el cliente
  (`SetDetailContent.tsx:66`).
- **`imagesByColor` YA EXISTE** (300-324, 371-402): query separada a `mediaLinksTable`/`mediaAssetsTable`
  (`entityType: 'PRODUCT'`, `role: 'GALLERY'`), agrupada por `colorId` en `Map<string, MediaItem[]>`, con fallback a
  `'_default'`. Cada `ProductVariant.images` queda poblado por producto+color. **Confirma la Decisión técnica
  propuesta del plan** ("Fotos por color por pieza: se reutiliza el mismo patrón... confirmar si `getCorporateSetBySlug`
  ya expone esto") — sí lo expone, no falta extenderlo, solo reutilizarlo en el nuevo shape `SetBlock.options[]`.
- `pieces: SetPiece[]`: cada pieza trae `colors: ProductColor[]` y `variants: ProductVariant[]` (imágenes ya resueltas
  por color).
- `colorMode`/`colorCombos`: ver hallazgo de la sección 2 — deben resolverse explícitamente en Fase 3, no ignorarse.
- No existe hoy ningún concepto de "bloque" — lista plana `pieces[]`.

## 4. `RULE_DOCS` — entradas citadas + resolución runtime de `MIN_QUANTITY`

`src/lib/rules-engine/docs.ts`.

**`MIN_QUANTITY`** (66-112): jerarquía Producto > Set > Grupo de Sets > Marca > Global; mínimo Global y contextual se
exigen A LA VEZ. `defaultBehavior`: sin reglas activas, mínimo Global 12 sets. **Texto a actualizar en Fase 3**: no
menciona piezas/bloques directamente, no requiere cambio de redacción salvo aclarar que "cantidad de sets" ahora se
resuelve sobre combinaciones bloque A + bloque B.

**`COLOR_RESTRICTION`** (356-383): texto actual dice *"El cliente elige color por CADA PIEZA del set... colores
distintos entre piezas..."* — **este texto queda obsoleto con la Decisión 6 del plan** (un solo color por
combinación) y debe reescribirse en Fase 3 a algo como: "el cliente elige un único color para toda la combinación
(pieza del Bloque A + pieza del Bloque B); la restricción se evalúa por color × pieza usando ese mismo color para
ambas piezas de la fila".

**`INVENTORY_MODE`**: no existe entrada — confirmado, ver sección 2.

**Resolución runtime de `MIN_QUANTITY`:**
- `resolveRules()` en `src/lib/rules-engine/resolve.ts:138-155` — `pickBestRule(rules, "MIN_QUANTITY", context, now)`;
  `minQuantity: (...) ?? DEFAULT_MIN_QUANTITY`.
- `DEFAULT_MIN_QUANTITY = { min: 12, countUnit: "SETS" }` en `defaults.ts:10-13`.
- Global + contextual simultáneo: `validate.ts:49-92` — línea 50 resuelve global; 67-80 usan `resolveContextualRule`
  por ítem del carrito; 82-92 validan cada grupo contra su `config.min`.
- **Esto confirma que la Decisión 9 del plan (prellenar cantidad con `MIN_QUANTITY` resuelto) es viable sin cambios
  de arquitectura** — la PDP solo necesita invocar `resolveRules`/`resolveContextualRule` con el contexto del set
  actual, ya existe el mecanismo.

## 5. Estado real de `set_items`/`corporate_sets` en base de datos — verificado por consulta directa

Se conectó (read-only, `SELECT count(*)`) contra la base de datos real usando las credenciales de
`C:\dev\allmedic-frontstore-poc\.env.local` (fuera del worktree, no versionado). Resultado:

```
corporate_sets rows: 0
set_items rows: 0
```

**Confirma la Decisión 4 del plan tal cual está escrita**: ambas tablas están vacías en producción. El `DROP TABLE
set_items` de la Fase 1 procede sin necesidad de migración de datos ni backfill. (Nota: existe evidencia indirecta en
`docs/reports/REPORTE-supresion-stock-inventario-2026-07-19.md` de que `seed-corporate.ts` se ejecutó contra la BD
real el 2026-07-19 — es posible que las filas insertadas por ese seed hayan sido limpiadas manualmente después; no
afecta la conclusión, que se basa en el conteo real al momento de esta auditoría.)

Script de verificación temporal creado y eliminado en el mismo turno (`scripts/_tmp-check-set-items.ts`), no queda
rastro en el working tree.

## 6. Hallazgos colaterales (no bloqueantes, documentados para no perderlos)

1. **`AGENTS.md`** desactualizado en dos puntos ya conocidos y no relacionados con este plan: `setGroups`/`set_groups`
   (tabla eliminada, ver `corporate.ts:100-105`) e `INVENTORY_MODE` como tipo soportado. No se corrige en este plan
   salvo que Fase 7 decida tocar `AGENTS.md` de todos modos — en ese caso, aprovechar para corregir ambos.
2. `RuleScope` sigue incluyendo `SET_GROUP` como scope válido a nivel de tipos aunque la tabla ya no existe —
   decisión previa explícita, no tocar en este plan.
3. `updateSetWithItems`/`permanentlyDeleteSet` usan reemplazo atómico completo (borra-y-reinserta) — el nuevo esquema
   de bloques (Fase 1) debe decidir explícitamente si mantiene esta semántica. **Se adopta: mismo patrón de
   reemplazo atómico** para `set_blocks`/`set_block_options`/`set_recommended_items` en `updateSetWithItems`
   equivalente, por consistencia con el resto del admin y porque el volumen de filas es trivial (2 bloques × 2
   opciones + recomendadas).

## Ajustes de alcance confirmados con el usuario antes de ejecutar Fase 1+

- **DROP TABLE `set_items` procede sin migración de datos** (Decisión 4 del plan verificada por conteo real = 0).
- **Toda mención a `INVENTORY_MODE` se retira de las Fases 3 y 6** del plan — ese tipo de regla no existe en el motor
  desde la migración `0004_supresion_stock_inventario.sql`. Las Fases 3/6 solo evalúan `MIN_QUANTITY` y
  `COLOR_RESTRICTION` sobre las piezas elegidas; disponibilidad se sigue resolviendo vía `product_variants.status`.
- **`colorMode`/`colorCombos` se CONSERVAN — corrección importante sobre el plan original.** El plan describe "un
  color único compartido" como si fuera la única modalidad; el usuario aclaró que esto es exactamente el
  comportamiento hoy llamado `PAIRED` (por defecto), y que el modo `MIXED` (colores independientes/permutables por
  pieza, vía `colorCombos` curados) sigue siendo una modalidad válida, seleccionable por set desde el admin, para el
  nuevo modelo de bloques también. Esto reinterpreta las Fases 3/5/6 así:
  - El selector `colorMode` del admin (`PAIRED`/`MIXED`) se mantiene sin cambios de esquema.
  - En `PAIRED`: el PDP de bloques usa el selector de color global único (Decisión 6 del plan tal cual) — swatch
    único, intersección de colores entre la pieza elegida del Bloque A y la del Bloque B.
  - En `MIXED`: el PDP de bloques permite elegir color **por separado** para la pieza del Bloque A y la del Bloque B,
    usando `colorCombos` curados igual que en el modelo plano actual — la "Composición del set" y el selector de color
    global de la Decisión 6/12 solo aplican en `PAIRED`; en `MIXED` cada bloque expone su propio selector de color.
  - `COLOR_PAIRING` (la regla que exige colores DISTINTOS entre piezas) se conserva como la regla que gobierna
    `MIXED`; `COLOR_RESTRICTION` sigue evaluándose por color × pieza en ambos modos, usando el color único de la fila
    en `PAIRED` y el color específico de cada pieza en `MIXED`.
  - Fase 6 (carrito): la fila de combinación gana forma condicional según `colorMode` del set — en `PAIRED` sigue
    siendo `{ quantity, colorCode, selections: [...] }` (un solo `colorCode`); en `MIXED` cada `selection` lleva su
    propio `color` (como ya existe hoy en `pieceSelections[].color`).

**No se detectaron bloqueantes adicionales, sujeto al ajuste de alcance de `colorMode` arriba. Procede la Fase 1.**

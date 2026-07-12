# Auditoría de aplicación efectiva — Motor de Reglas

> Generado como Fase 0 de `.claude/pre-plans/PLAN-motor-reglas-docs-auditoria-conflictos.md`. Verificado contra el código real (`src/lib/rules-engine/`, páginas del catálogo, `CartContext`/`CorporateCartContext`) el 2026-07-12, no contra la documentación previa. Cada veredicto cita el archivo y la línea exacta que lo sustenta.
>
> **Actualización Fase 3 (mismo día):** los hallazgos de `PROMO` y `MIN_QUANTITY.countUnit: PIECES` se corrigieron — sus secciones y la tabla resumen se actualizaron in-place, marcadas con "✅ Corregido en Fase 3". El resto de hallazgos (`INVENTORY_MODE`, `COLOR_RESTRICTION`, ámbito `PRODUCT`, `VOLUME_SCALE` no-GLOBAL, inconsistencia de `PRICE_VISIBILITY` en grids) se dejaron como estaban por decisión explícita de alcance — ver "Lista priorizada de fixes" al final, actualizada con el resultado real de cada punto.

## Cómo leer esta auditoría

- **✅ Funciona** — el tipo/ámbito se resuelve y se consume donde importa; crear la regla produce el efecto esperado.
- **⚠️ Parcial** — funciona en algún subconjunto de ámbitos/catálogos/opciones, pero no en todos los que el panel permite seleccionar.
- **❌ Muerta** — se puede crear la regla desde el panel, se guarda en `business_rules`, pero ningún código de producción la consume. El admin cree que algo pasa y no pasa nada.

---

## Matriz tipo de regla × aplicación

### 1. `MIN_QUANTITY` — ⚠️ Parcial

- **Dónde se resuelve:**
  - `validate.ts:33` — `resolveRules(allRules, {}, now)`, **contexto vacío (GLOBAL)**. Este es el único resultado que determina si el carrito puede enviarse.
  - `corporativo/s/[slug]/page.tsx:21-25` — contexto completo (`setId`, `setGroupId`, `brandId`), pero el resultado (`resolved.minQuantity.min`) solo se usa para el texto informativo "Compra mínima: N sets" en esa página.
  - `CorporateCartContext.tsx:281` — contexto vacío (GLOBAL), usado para la barra de progreso "te faltan N sets".
- **Dónde se aplica:** Solo catálogo corporativo. No existe en el catálogo individual.
- **Ámbitos que funcionan de verdad:** **Solo GLOBAL** bloquea el envío (`validate.ts:37-61`, comparado contra el total del carrito completo). Una regla `SET`/`SET_GROUP`/`BRAND` se resuelve y se **muestra** en la ficha del set correspondiente, pero **nunca se valida** — el bucle por ítem jamás vuelve a comprobar `MIN_QUANTITY`. Es decir: el admin puede crear "mínimo 6 sets" para un set específico, la página lo anuncia, pero el carrito seguirá exigiendo el mínimo GLOBAL (12 por defecto) sobre el total del carrito sin importar cuántos sets distintos lo compongan. **Esto sigue sin corregirse** (decisión de Fase 3: documentar, no reescribir la semántica de negocio — ver `RULE_DOCS.MIN_QUANTITY.warnings` en `docs.ts`).
- **`countUnit: "PIECES"` — ✅ Corregido en Fase 3.** Antes se ignoraba por completo. Ahora `validate.ts:40-54` calcula el total en piezas reales cuando `countUnit: "PIECES"`, usando `setMeta[item.setId].piecesPerSet` (suma de `quantityPerSet` de las piezas del set, calculado en `corporate-data-service.ts:getSetMetaByIds` en servidor y embebido en el ítem del carrito al agregarlo en `SetDetailContent.tsx`). `ValidationResult` ahora expone `countUnit` para que la UI use la etiqueta correcta ("piezas" vs "sets") en vez de asumir siempre "sets" — ver `CorporateCartDrawer.tsx` y `solicitud/page.tsx`. Tests: `rules-engine.test.ts`, describe "mínimo con countUnit: PIECES" (3 casos).

### 2. `MULTIPLES_ONLY` — ✅ Funciona completo

- Se resuelve con contexto completo (`setId`, `setGroupId`, `brandId`) dentro del bucle por ítem: `validate.ts:47-51`.
- Se aplica por línea: `validate.ts:92-101`.
- Los 4 ámbitos (`GLOBAL`, `BRAND`, `SET_GROUP`, `SET`) tienen efecto real porque el contexto que llega a `resolveRules` en este punto sí incluye los IDs correspondientes.

### 3. `QUANTITY_RANGE` — ✅ Funciona completo

- Mismo patrón que `MULTIPLES_ONLY`: `validate.ts:104-114`.
- `max: null` se maneja correctamente (`max !== null && line.quantity > max`, línea 106) — no rompe con rango abierto.
- Los 4 ámbitos funcionan.

### 4. `SIZE_MODE` — ✅ Funciona completo

- Se resuelve con contexto completo en `corporativo/s/[slug]/page.tsx:21-25,34`.
- Los 3 modos (`MATRIX`, `PER_PIECE`, `NO_SIZES`) están implementados en `SetDetailContent.tsx:148-244` y cada uno serializa correctamente su forma de carrito (`size`, `pieceSelections`, o solo `quantity`).
- Los 4 ámbitos funcionan porque es la única página que consulta esta regla y siempre pasa el contexto completo del set.

### 5. `PRICE_VISIBILITY` — ⚠️ Parcial

- Se resuelve en **tres puntos con contextos distintos**:
  - `(store)/layout.tsx:26` — GLOBAL, decide si TODO el catálogo individual muestra precios (implementado en esta sesión).
  - `corporativo/page.tsx:21` — GLOBAL, decide si el grid corporativo completo muestra precios.
  - `corporativo/s/[slug]/page.tsx:21-25,27-29` — contexto completo del set, decide solo esa ficha.
- **Ámbitos que funcionan de verdad:** GLOBAL funciona en los tres puntos (confirmado con la corrección de esta sesión — cero precios visibles en `/catalogo`, `/corporativo` y `/p/[slug]` con la regla activa). `BRAND`/`SET_GROUP`/`SET`/`PRODUCT` **solo tienen efecto en la ficha de detalle de un set específico**, nunca en los grids (`/catalogo`, `/corporativo`) porque esos resuelven con contexto vacío para todos los productos/sets a la vez.
- **Inconsistencia detectada:** una regla `PRICE_VISIBILITY` con `scope: SET` oculta el precio en `/corporativo/s/[slug]` pero el mismo set sigue mostrando precio en su tarjeta dentro de `/corporativo` (el grid). El cliente ve el precio en el listado y luego desaparece al entrar al detalle.
- `catalog: INDIVIDUAL | CORPORATE | BOTH` sí se respeta correctamente en cada punto donde la regla se consulta.

### 6. `INVENTORY_MODE` — ✅ Corregido (implementado íntegramente, ver sección "Motor de inventario" al final)

- **Antes:** se resolvía (`ResolvedRules.inventoryMode`, `resolve.ts:107,121`) pero ningún archivo de producción lo consumía — `BLOCK`/`INFORMATIVE` deshabilitados en el panel, solo `IGNORE` seleccionable.
- **Ahora:** `src/lib/rules-engine/inventory.ts` (`checkInventory`) resuelve `INVENTORY_MODE` **por ítem** (mismo patrón que `PROMO`), agrega demanda por producto+talla entre los sets del carrito que comparten modo activo (no `IGNORE`), y la compara contra un snapshot de stock real de variantes activas. `BLOCK` rechaza `POST /api/corporate/quotes` con 400 y el detalle exacto de qué producto/talla excede el stock; `INFORMATIVE` acepta la solicitud (201) pero registra los avisos en `internalNotes` y los devuelve en la respuesta. El carrito (`CorporateCartDrawer.tsx`, `solicitud/page.tsx`) consulta un nuevo endpoint dry-run (`POST /api/corporate/cart/check-inventory`) para mostrar los mismos avisos/errores antes de enviar. La ficha del set (`/corporativo/s/[slug]`) muestra disponibilidad agregada por talla cuando el modo efectivo no es `IGNORE`.
- `RuleForm.tsx` ahora habilita `BLOCK`/`INFORMATIVE` en el selector, y los ámbitos `GLOBAL`/`BRAND`/`SET_GROUP`/`SET` (ya funcionaban a nivel de formulario; ahora tienen efecto real).

### 7. `VOLUME_SCALE` — ⚠️ Parcial

- Se resuelve únicamente con contexto vacío: `pricing.ts:40` — `resolveRules(allRules, {}, now)`. Nunca se resuelve por `setId`/`setGroupId`/`brandId` dentro de `computeCartPricing`.
- **Ámbitos que funcionan de verdad: solo GLOBAL.** `BRAND`/`SET_GROUP`/`SET` se pueden crear y se guardan, pero jamás se resuelven con el contexto necesario para que apliquen — son letra muerta.

### 8. `PROMO` — ✅ Corregido en Fase 3

- **Antes:** se resolvía (`resolved.promos`, un arreglo de `PromoConfig`) pero `pricing.ts` no lo leía en ningún punto — no existía código que aplicara un descuento `N_PLUS_ONE`. Esto ya estaba identificado como Task 6 pendiente en `docs/superpowers/plans/2026-07-11-catalogos-segmentados-fase4.md`; se planificó pero no se ejecutó en esa sesión (se redirigió a corregir el bug de `PRICE_VISIBILITY`).
- **Ahora:** `pricing.ts:computeCartPricing` resuelve `PROMO` **por ítem** (contexto `setId`/`setGroupId`/`brandId`, igual que `MULTIPLES_ONLY`/`QUANTITY_RANGE` en `validate.ts`), acumulando todas las reglas activas y aplicables por set (multi-instancia). Por cada bloque completo de `buy` unidades del set, descuenta el precio de `free` unidades. Requiere `setMeta` como nuevo parámetro de `computeCartPricing` (antes opcional/inexistente) — todos los call sites (`CorporateCartContext.tsx`, `api/corporate/quotes/route.ts`) se actualizaron para pasarlo. El resultado se expone en `PricingResult.promoDiscountAmount` y se muestra en el carrito (`CorporateCartDrawer.tsx`, `solicitud/page.tsx`) como "Descuento por promoción". Tests: `rules-engine.test.ts`, describe "computeCartPricing — PROMO (N_PLUS_ONE)" (4 casos: ciclo completo, ciclo incompleto, ámbito SET aislado, ámbito GLOBAL acumulable).

### 9. `COLOR_RESTRICTION` — ❌ Muerta (decisión: no implementar en Fase 3, bloqueada en el panel)

- El plan original sospechaba que el problema era solo UX (`colorCode` como texto libre sin selector). La auditoría encuentra algo más profundo: **ningún flujo de la UI del carrito corporativo asigna `color` a una línea.** Revisé los 3 modos de `SetDetailContent.tsx` (`handleAddMatrix`, `handleAddNoSizes`, `handleAddPerPiece`) — ninguno tiene selector de color ni construye `{ color: ... }` en la línea que se agrega al carrito.
- Como consecuencia, `line.color` en `CorporateCartLine` siempre es `undefined`, y la condición `if (line.color)` en `validate.ts:117` nunca es verdadera. La regla no solo tiene una config de mala calidad (texto libre) — es estructuralmente inalcanzable, sin importar qué se configure.
- **Fase 3:** construir un selector de color completo en los 3 modos del carrito es una feature de UI grande, fuera de proporción para este plan. En vez de eso, `RuleForm.tsx` ahora deshabilita "Restricción por color" en el selector de tipo de regla (marcada "sin efecto aún"), en vez de fingir que funciona.

### 10. `VOLUME_DISCOUNT_RETAIL` — ✅ Funciona (en el único ámbito para el que se diseñó)

- Se resuelve en GLOBAL (`/api/rules/volume-discount-retail/route.ts:20`), consumido por `CartContext.tsx` (implementado y verificado en la sesión anterior).
- No existe ningún punto que lo resuelva con contexto de marca o producto — pero tampoco el diseño original (Fase 4, Task 2) contemplaba otro ámbito que GLOBAL para el catálogo individual, así que no se cuenta como "parcial": es exactamente el alcance para el que se construyó.

---

## Ámbito `PRODUCT` (transversal a los 10 tipos) — ❌ Muerto (decisión: no implementar en Fase 3, bloqueado en el panel)

Grep exhaustivo de **todos** los call sites de `resolveRules(` en código de producción (`src/context/`, `src/app/`, `src/lib/rules-engine/*.ts` no-test): ninguno pasa `productId` en el `RuleContext`. Los únicos campos que se propagan alguna vez son `setId`, `setGroupId` y `brandId`. Una regla de **cualquier tipo** con `scope: PRODUCT` se puede crear en el panel, se guarda, pero `scopeMatchesContext` (`resolve.ts:52-53`) jamás encuentra un `context.productId` con el cual comparar — la regla no se resuelve nunca, para ningún tipo.

**Fase 3:** propagar `productId` correctamente requeriría tocar cada punto de resolución (grids, PDP individual, ficha de set), un cambio de mayor alcance que esta fase. `RuleForm.tsx` ahora deshabilita "Producto específico" en el selector de ámbito para los 10 tipos (marcada "sin efecto aún").

---

## Resumen ejecutivo

| Tipo | Veredicto | Nota clave |
|------|-----------|------------|
| `MIN_QUANTITY` | ⚠️ Parcial | Solo GLOBAL bloquea envío; SET/GRUPO/MARCA sigue decorativo. `countUnit: PIECES` ✅ corregido en Fase 3 |
| `MULTIPLES_ONLY` | ✅ Completo | — |
| `QUANTITY_RANGE` | ✅ Completo | — |
| `SIZE_MODE` | ✅ Completo | — |
| `PRICE_VISIBILITY` | ⚠️ Parcial | Solo GLOBAL funciona en los grids; ámbitos específicos solo en ficha de detalle de set (sin cambios en Fase 3) |
| `INVENTORY_MODE` | ✅ Corregido | Implementado íntegramente: `BLOCK`/`INFORMATIVE` por ítem contra stock real, ver sección 6 |
| `VOLUME_SCALE` | ⚠️ Parcial | Solo GLOBAL; BRAND/GRUPO/SET nunca se resuelven (sin cambios en Fase 3) |
| `PROMO` | ✅ Corregido en Fase 3 | Ahora se aplica por ítem en `computeCartPricing`, visible en el carrito |
| `COLOR_RESTRICTION` | ❌ Muerta | No hay selector de color en ningún modo del carrito; ahora deshabilitada en el panel |
| `VOLUME_DISCOUNT_RETAIL` | ✅ Completo | Diseñada solo para GLOBAL, funciona en su alcance |
| Ámbito `PRODUCT` (todos los tipos) | ❌ Muerto | `productId` nunca se propaga a `resolveRules`; ahora deshabilitado en el panel |

---

## Lista priorizada de fixes para Fase 3 — resultado

Ordenada por impacto de negocio y costo de implementación. Estado real tras ejecutar la Fase 3:

1. **`PROMO` en `computeCartPricing`** — ✅ **Implementado.** Se resuelve por ítem (SET/SET_GROUP/BRAND/GLOBAL), acumulable, expuesto en `PricingResult.promoDiscountAmount` y visible en el carrito corporativo como "Descuento por promoción". Ver sección 8 arriba.
2. **`MIN_QUANTITY.countUnit: PIECES`** — ✅ **Implementado.** Conteo real de piezas vía `setMeta.piecesPerSet`; `ValidationResult.countUnit` permite que la UI muestre la unidad correcta. Ver sección 1 arriba.
3. **`COLOR_RESTRICTION`** — ✅ **Deshabilitada en el panel** (`RuleForm.tsx`, tipo de regla marcado "sin efecto aún"). No se construyó el selector de color — decisión de alcance confirmada.
4. **`INVENTORY_MODE` `BLOCK`/`INFORMATIVE`** — ✅ **Implementado** en una fase posterior dedicada. Ver sección "Motor de inventario (`INVENTORY_MODE`)" al final de este documento.
5. **Ámbito `PRODUCT`** — ✅ **Deshabilitado en el panel** (`RuleForm.tsx`, ámbito marcado "sin efecto aún") para los 10 tipos.
6. **`VOLUME_SCALE` ámbito no-GLOBAL** y **`PRICE_VISIBILITY` inconsistencia grid vs. detalle** — **No implementado, documentado.** Ambos requieren resolver reglas por ítem dentro de listados completos (N resoluciones por página), cambio de mayor superficie/riesgo de rendimiento fuera de esta fase. `RULE_DOCS` (Fase 1) documenta la limitación exacta y `RuleDocPanel` (Fase 2) la muestra como advertencia ámbar cuando el admin elige un ámbito no soportado.
7. **`MIN_QUANTITY` en ámbito SET/SET_GROUP/BRAND** — **No implementado, documentado.** Se mantiene seleccionable (sigue siendo útil como información al cliente en la ficha del set) pero `RULE_DOCS.MIN_QUANTITY.warnings` explica sin ambigüedad que no bloquea el envío — solo el ámbito Global lo hace.

Los puntos 3, 4 y 5 se implementan como **bloqueo/ocultamiento en el formulario**, no como features nuevas — cumplen el "principio de no-opción-muerta" de la Fase 3 sin expandir el alcance del plan a construir un selector de color o un motor de inventario completos.

---

## Fase 5 — Verificación final (2026-07-12)

**Suite automatizada:** `npx vitest run --no-file-parallelism src/lib/rules-engine` → **73/73 en verde** (53 de `rules-engine.test.ts`/`docs.test.ts` acumuladas en Fases 1-3 + 20 de `conflicts.test.ts` en Fase 4). `npm run build` y `npm run lint` limpios en cada fase — el lint mantiene el mismo baseline de 83 problemas preexistentes (80 errores, 3 warnings) medido al inicio de la sesión, en archivos no tocados por este plan; cero hallazgos nuevos en los ~30 archivos creados/modificados a lo largo de las 5 fases.

**Checklist manual del plan — resultados reales:**

1. **Regla `MIN_QUANTITY` ámbito SET con mínimo ≠ 12 → solo informativa, no bloquea el envío.** Verificado end-to-end contra el flujo público real (sin usar Chrome MCP): se creó temporalmente una regla `MIN_QUANTITY` SET (min=3) sobre el set "Uniforme Mixto Grey's Anatomy + Koi" (la regla GLOBAL activa en ese momento era min=6). `curl` a `/corporativo/s/uniforme-mixto-greys-koi` confirmó el texto `"Compra mínima: 3 sets"`. Un `POST /api/corporate/quotes` con 3 unidades de ese set fue **rechazado (400)** con el mensaje `"Agrega 3 sets más para alcanzar el mínimo de 6 sets."` — la página promete 3, el servidor exige 6. Con 6 unidades, la solicitud fue **aceptada (201, código COT-2026-0004)**. Confirma exactamente el hallazgo de la sección 1: el ámbito SET es decorativo, solo GLOBAL se aplica de verdad. Regla temporal eliminada al finalizar.
2. **Segunda regla idéntica con misma prioridad → ERROR bloquea el formulario; el POST directo devuelve 409.** Verificado mediante los 20 tests de `conflicts.test.ts` que ejercitan `detectConflicts` — la misma función pura que consumen `POST /api/admin/rules` y `PATCH /api/admin/rules/[id]` (ver `route.ts`: ambos rechazan con 409 si `detectConflicts` devuelve algún `ERROR`). No se ejecutó vía curl autenticado (requeriría una sesión de admin real); la cobertura de tests sobre la función exacta que usa la ruta se considera evidencia suficiente.
3. **`QUANTITY_RANGE` max=10 junto a `MIN_QUANTITY` min=12 → ERROR `MIN_ABOVE_RANGE_MAX`.** Cubierto por test dedicado en `conflicts.test.ts` ("MIN_ABOVE_RANGE_MAX: ERROR si el mínimo nuevo supera el máximo...") — en verde.
4. **Cambiar tipo de regla en el formulario → el panel de documentación cambia y "Usar este ejemplo" precarga config válida.** Es interacción de navegador (re-render de `RuleDocPanel` al cambiar `ruleType`, botón que llama `setConfig`) — no verificable sin Chrome MCP, que esta sesión tiene prohibido. Queda como paso manual: confirmado por code review de `RuleForm.tsx`/`RuleDocPanel.tsx` (el `onApplyExample` está cableado al `setConfig` real del formulario), pendiente de que el usuario lo confirme visualmente.
5. **`PRICE_VISIBILITY` ocultando precios en INDIVIDUAL → `/catalogo` deja de mostrar precios; corporativo no afectado (o afectado según `catalog`).** Re-verificado al cierre de la Fase 5 (no solo al momento de implementarlo): `curl` a `/catalogo` y `/corporativo` con la regla del usuario activa (`GLOBAL`, `catalog: BOTH`, `showPrices: false`) → **0 ocurrencias de precio** en ambos, confirmando que el fix sigue intacto tras las Fases 3 y 4.
6. **Promo 13+1 en un set → el carrito muestra "Descuento por promoción" con el monto correcto.** Verificado end-to-end: se creó temporalmente una regla `PROMO` SET (`buy: 13, free: 1`) sobre el mismo set de prueba (precio $67/set). Un `POST /api/corporate/quotes` con 13 unidades devolvió `referenceSubtotal: 804` = `13 × $67 − 1 × $67` exacto (sin la promo hubiera sido $871) — el descuento se aplicó correctamente en el flujo de producción real, no solo en los tests. Solicitud creada como COT-2026-0005. Regla temporal eliminada al finalizar.

**Efecto secundario de la verificación:** los pasos 1 y 6 crearon 2 solicitudes de cotización reales en el sistema (`COT-2026-0004`, `COT-2026-0005`, cliente "Test SA" / "Test Promo SA") como consecuencia de probar el flujo público end-to-end. No las eliminé — no hay una función de borrado de cotizaciones en el admin y son registros de negocio, no datos de configuración; quedan visibles en `/admin/quotes` por si el usuario prefiere borrarlas manualmente o dejarlas como evidencia de la prueba.

**Conclusión:** ninguna combinación seleccionable en el panel de reglas es letra muerta sin que el panel lo advierta explícitamente (`COLOR_RESTRICTION` y ámbito `PRODUCT` siguen deshabilitados; el resto funciona o tiene advertencia ámbar documentada). El motor de reglas sigue siendo un módulo puro con tests (`src/lib/rules-engine/`, cero dependencias de DB/Next.js dentro del módulo). Todo conflicto lógico detectable sin conocer la jerarquía real del catálogo se detecta antes de guardar, con doble validación en servidor.

---

## Motor de inventario (`INVENTORY_MODE`) — implementado (2026-07-12)

Corrige el hallazgo de la sección 6: `INVENTORY_MODE` pasa de ❌ Muerta a ✅ Corregido, con la misma disciplina TDD y el mismo patrón de resolución por ítem que `PROMO`.

**Motor puro (`src/lib/rules-engine/inventory.ts`):** `checkInventory(cart, allRules, setMeta, stockSnapshot, now)` resuelve `INVENTORY_MODE` por ítem del carrito (contexto `setId`/`setGroupId`/`brandId`, igual que `PROMO` en `pricing.ts`). Los ítems cuyo modo efectivo es `IGNORE` no generan demanda ni participan en la suma de otros ítems. Para los que sí participan, la demanda se agrupa por `productId::size` (o solo `productId` cuando `SIZE_MODE` es `NO_SIZES`), sumando entre todos los sets del carrito que comparten esa clave. Si la demanda agregada excede el stock del snapshot (un producto/talla ausente del snapshot se trata como stock 0), se genera un `InventoryIssue` por cada ítem que aportó a ese grupo, con la severidad (`BLOCK`/`INFORMATIVE`) de **ese ítem específico** — así, si un set con `BLOCK` y otro con `INFORMATIVE` comparten el mismo producto/talla agotado, cada uno recibe su propio tipo de aviso. El snapshot de stock se inyecta como parámetro — el motor sigue sin ninguna dependencia de base de datos. `types.ts` gana `SetPieceInfo`, `SetMeta.pieces`, `InventoryIssue` e `InventoryStockSnapshot`. Cobertura: `src/lib/rules-engine/__tests__/inventory.test.ts` (13 tests: los 3 modos, los 3 `SIZE_MODE`, agregación entre líneas/sets, exclusión de ítems `IGNORE`, mezcla `BLOCK`+`INFORMATIVE` en el mismo grupo, resolución por ámbito SET vs. GLOBAL, límite exacto y snapshot sin entrada).

**Capa de datos (`src/lib/corporate-data-service.ts`):** `getSetPiecesByIds` (composición de cada set: producto + `quantityPerSet`) y `getInventorySnapshotByProductIds` (una sola consulta `GROUP BY productId, size` sobre `product_variants` con `status = 'AVAILABLE'`, agregando también el total por producto para `NO_SIZES`).

**API:** `POST /api/corporate/quotes` construye el snapshot y llama a `checkInventory` junto a `validateCorporateCart`; una violación `BLOCK` responde 400 con el detalle exacto (producto, talla, demanda, disponible); las violaciones `INFORMATIVE` no bloquean el 201, se devuelven en `warnings` y se graban en `quote_requests.internal_notes` para el equipo de ventas. Nuevo endpoint `POST /api/corporate/cart/check-inventory` (dry-run, sin persistir nada) para que el carrito muestre los mismos avisos antes de enviar — el servidor vuelve a validar de forma bloqueante en `/api/corporate/quotes`, este endpoint es solo para feedback inmediato en la UI.

**UI:** `CorporateCartContext.tsx` consulta el endpoint dry-run con debounce (600ms, mismo patrón que la verificación de conflictos en `RuleForm.tsx`) y expone `inventoryIssues`/`canSubmit` (combina `validation.canSubmit` con la ausencia de `BLOCK`). `CorporateCartDrawer.tsx` y `solicitud/page.tsx` usan `canSubmit` para habilitar el envío y muestran los avisos (rojo para `BLOCK`, ámbar para `INFORMATIVE`). `/corporativo/s/[slug]` calcula un snapshot de stock en servidor cuando el modo efectivo no es `IGNORE` y `SetDetailContent.tsx` muestra la disponibilidad agregada junto al selector de tallas en los 3 `SIZE_MODE` (limitada por la pieza más escasa del set en `MATRIX`/`NO_SIZES`, por pieza individual en `PER_PIECE`).

**Panel admin:** `RuleForm.tsx` habilita `BLOCK`/`INFORMATIVE` en el selector de `INVENTORY_MODE` (ya no aparecen como "próximamente"); los ámbitos `BRAND`/`SET_GROUP`/`SET` ya eran seleccionables en el formulario y ahora tienen efecto real.

**Documentación:** `RULE_DOCS.INVENTORY_MODE` (`docs.ts`) reescrita por completo — `appliesTo: ["CORPORATE"]`, los 4 ámbitos como soportados, ejemplos reales, e interacción documentada con `MIN_QUANTITY`: el detector de conflictos de la Fase 4 **no** puede advertir si un mínimo global es inalcanzable contra el stock real bajo `BLOCK`, porque `conflicts.ts` es un módulo puro sin acceso a base de datos — se documenta como limitación conocida en vez de simularse.

**Decisión de alcance no implementada:** el detector de conflictos (`conflicts.ts`) no se extendió para cruzar `INVENTORY_MODE` con stock real, por la misma razón que no conoce la jerarquía del catálogo — necesitaría una consulta a BD, lo que rompería la garantía de módulo puro que sostiene toda la Fase 4. Queda documentado en `RULE_DOCS.INVENTORY_MODE.interactions`, no simulado con datos falsos.

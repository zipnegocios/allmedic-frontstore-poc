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

### 6. `INVENTORY_MODE` — ❌ Muerta (decisión: no implementar en Fase 3, bloqueada en el panel)

- Se resuelve (aparece en `ResolvedRules.inventoryMode`, `resolve.ts:107,121`) pero **ningún archivo de producción lo consume**. Grep exhaustivo de `inventoryMode`/`INVENTORY_MODE` fuera de `rules-engine/` y sus tests: cero resultados.
- No hay lógica de bloqueo por stock (`BLOCK`) ni de aviso no bloqueante (`INFORMATIVE`) en `validate.ts`, ni en ningún flujo del catálogo corporativo o individual.
- El valor por defecto (`IGNORE`) es, en la práctica, el único comportamiento que existe — pero no porque el sistema "ignore" activamente el stock siguiendo la regla, sino porque **nadie lo consulta jamás**, con `IGNORE`, `BLOCK` o `INFORMATIVE` da exactamente igual.
- **Fase 3:** implementar bloqueo/aviso real de stock es un motor de inventario completo, fuera de proporción para este plan (y contradice la decisión de negocio original de usar cotización referencial sin chequeo de stock). En vez de eso, `RuleForm.tsx` ahora deshabilita las opciones `BLOCK` e `INFORMATIVE` en el selector (quedan marcadas "próximamente"), dejando solo `IGNORE` seleccionable — coherente con lo único que el sistema realmente hace.

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
| `INVENTORY_MODE` | ❌ Muerta | Ningún código la consume; `BLOCK`/`INFORMATIVE` ahora deshabilitados en el panel |
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
4. **`INVENTORY_MODE` `BLOCK`/`INFORMATIVE`** — ✅ **Deshabilitadas en el panel** (`RuleForm.tsx`, opciones marcadas "próximamente"), solo `IGNORE` seleccionable. No se implementó lógica de stock — decisión de alcance confirmada.
5. **Ámbito `PRODUCT`** — ✅ **Deshabilitado en el panel** (`RuleForm.tsx`, ámbito marcado "sin efecto aún") para los 10 tipos.
6. **`VOLUME_SCALE` ámbito no-GLOBAL** y **`PRICE_VISIBILITY` inconsistencia grid vs. detalle** — **No implementado, documentado.** Ambos requieren resolver reglas por ítem dentro de listados completos (N resoluciones por página), cambio de mayor superficie/riesgo de rendimiento fuera de esta fase. `RULE_DOCS` (Fase 1) documenta la limitación exacta y `RuleDocPanel` (Fase 2) la muestra como advertencia ámbar cuando el admin elige un ámbito no soportado.
7. **`MIN_QUANTITY` en ámbito SET/SET_GROUP/BRAND** — **No implementado, documentado.** Se mantiene seleccionable (sigue siendo útil como información al cliente en la ficha del set) pero `RULE_DOCS.MIN_QUANTITY.warnings` explica sin ambigüedad que no bloquea el envío — solo el ámbito Global lo hace.

Los puntos 3, 4 y 5 se implementan como **bloqueo/ocultamiento en el formulario**, no como features nuevas — cumplen el "principio de no-opción-muerta" de la Fase 3 sin expandir el alcance del plan a construir un selector de color o un motor de inventario completos.

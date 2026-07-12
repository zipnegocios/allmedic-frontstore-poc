# Auditoría de aplicación efectiva — Motor de Reglas

> Generado como Fase 0 de `.claude/pre-plans/PLAN-motor-reglas-docs-auditoria-conflictos.md`. Verificado contra el código real (`src/lib/rules-engine/`, páginas del catálogo, `CartContext`/`CorporateCartContext`) el 2026-07-12, no contra la documentación previa. Cada veredicto cita el archivo y la línea exacta que lo sustenta.

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
- **Ámbitos que funcionan de verdad:** **Solo GLOBAL** bloquea el envío (`validate.ts:37-42`, comparado contra `totalSets` del carrito completo). Una regla `SET`/`SET_GROUP`/`BRAND` se resuelve y se **muestra** en la ficha del set correspondiente, pero **nunca se valida** — el bucle por ítem (`validate.ts:44-128`) jamás vuelve a comprobar `MIN_QUANTITY`. Es decir: el admin puede crear "mínimo 6 sets" para un set específico, la página lo anuncia, pero el carrito seguirá exigiendo el mínimo GLOBAL (12 por defecto) sobre el total del carrito sin importar cuántos sets distintos lo compongan.
- **`countUnit: "PIECES"` — confirmado ignorado.** `validate.ts:27-30` calcula `totalSets` sumando `line.quantity` de todas las líneas, sin mirar `countUnit` en ningún punto. Una regla con `countUnit: "PIECES"` se comporta exactamente igual que una con `"SETS"` — el valor se guarda pero no cambia el comportamiento.
- **Impacto:** confuso para el admin y potencialmente engañoso para el cliente final (la página promete un mínimo que el sistema no exige).

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

### 6. `INVENTORY_MODE` — ❌ Muerta

- Se resuelve (aparece en `ResolvedRules.inventoryMode`, `resolve.ts:107,121`) pero **ningún archivo de producción lo consume**. Grep exhaustivo de `inventoryMode`/`INVENTORY_MODE` fuera de `rules-engine/` y sus tests: cero resultados.
- No hay lógica de bloqueo por stock (`BLOCK`) ni de aviso no bloqueante (`INFORMATIVE`) en `validate.ts`, ni en ningún flujo del catálogo corporativo o individual.
- El valor por defecto (`IGNORE`) es, en la práctica, el único comportamiento que existe — pero no porque el sistema "ignore" activamente el stock siguiendo la regla, sino porque **nadie lo consulta jamás**, con `IGNORE`, `BLOCK` o `INFORMATIVE` da exactamente igual.

### 7. `VOLUME_SCALE` — ⚠️ Parcial

- Se resuelve únicamente con contexto vacío: `pricing.ts:40` — `resolveRules(allRules, {}, now)`. Nunca se resuelve por `setId`/`setGroupId`/`brandId` dentro de `computeCartPricing`.
- **Ámbitos que funcionan de verdad: solo GLOBAL.** `BRAND`/`SET_GROUP`/`SET` se pueden crear y se guardan, pero jamás se resuelven con el contexto necesario para que apliquen — son letra muerta.

### 8. `PROMO` — ❌ Muerta

- Se resuelve (`resolved.promos`, un arreglo de `PromoConfig`) pero **`pricing.ts` no lo lee en ningún punto** — no existe código que aplique un descuento `N_PLUS_ONE` ni ningún otro `kind`.
- Esto ya estaba identificado como Task 6 pendiente en `docs/superpowers/plans/2026-07-11-catalogos-segmentados-fase4.md`; se planificó pero no se ejecutó (la sesión se redirigió a corregir el bug de `PRICE_VISIBILITY`). Sigue pendiente íntegramente.

### 9. `COLOR_RESTRICTION` — ❌ Muerta (más grave que lo sospechado en el plan)

- El plan original sospechaba que el problema era solo UX (`colorCode` como texto libre sin selector). La auditoría encuentra algo más profundo: **ningún flujo de la UI del carrito corporativo asigna `color` a una línea.** Revisé los 3 modos de `SetDetailContent.tsx` (`handleAddMatrix`, `handleAddNoSizes`, `handleAddPerPiece`) — ninguno tiene selector de color ni construye `{ color: ... }` en la línea que se agrega al carrito.
- Como consecuencia, `line.color` en `CorporateCartLine` siempre es `undefined`, y la condición `if (line.color)` en `validate.ts:117` nunca es verdadera. La regla no solo tiene una config de mala calidad (texto libre) — es estructuralmente inalcanzable, sin importar qué se configure.

### 10. `VOLUME_DISCOUNT_RETAIL` — ✅ Funciona (en el único ámbito para el que se diseñó)

- Se resuelve en GLOBAL (`/api/rules/volume-discount-retail/route.ts:20`), consumido por `CartContext.tsx` (implementado y verificado en la sesión anterior).
- No existe ningún punto que lo resuelva con contexto de marca o producto — pero tampoco el diseño original (Fase 4, Task 2) contemplaba otro ámbito que GLOBAL para el catálogo individual, así que no se cuenta como "parcial": es exactamente el alcance para el que se construyó.

---

## Ámbito `PRODUCT` (transversal a los 10 tipos) — ❌ Muerto

Grep exhaustivo de **todos** los call sites de `resolveRules(` en código de producción (`src/context/`, `src/app/`, `src/lib/rules-engine/*.ts` no-test): ninguno pasa `productId` en el `RuleContext`. Los únicos campos que se propagan alguna vez son `setId`, `setGroupId` y `brandId`. Una regla de **cualquier tipo** con `scope: PRODUCT` se puede crear en el panel, se guarda, pero `scopeMatchesContext` (`resolve.ts:52-53`) jamás encuentra un `context.productId` con el cual comparar — la regla no se resuelve nunca, para ningún tipo.

---

## Resumen ejecutivo

| Tipo | Veredicto | Nota clave |
|------|-----------|------------|
| `MIN_QUANTITY` | ⚠️ Parcial | Solo GLOBAL bloquea envío; SET/GRUPO/MARCA es decorativo; `countUnit: PIECES` ignorado |
| `MULTIPLES_ONLY` | ✅ Completo | — |
| `QUANTITY_RANGE` | ✅ Completo | — |
| `SIZE_MODE` | ✅ Completo | — |
| `PRICE_VISIBILITY` | ⚠️ Parcial | Solo GLOBAL funciona en los grids; ámbitos específicos solo en ficha de detalle de set |
| `INVENTORY_MODE` | ❌ Muerta | Ningún código la consume; `BLOCK`/`INFORMATIVE` no implementados |
| `VOLUME_SCALE` | ⚠️ Parcial | Solo GLOBAL; BRAND/GRUPO/SET nunca se resuelven |
| `PROMO` | ❌ Muerta | Task 6 de Fase 4 nunca se ejecutó |
| `COLOR_RESTRICTION` | ❌ Muerta | No hay selector de color en ningún modo del carrito corporativo |
| `VOLUME_DISCOUNT_RETAIL` | ✅ Completo | Diseñada solo para GLOBAL, funciona en su alcance |
| Ámbito `PRODUCT` (todos los tipos) | ❌ Muerto | `productId` nunca se propaga a `resolveRules` |

---

## Lista priorizada de fixes para Fase 3

Ordenada por impacto de negocio y costo de implementación:

1. **`PROMO` en `computeCartPricing`** — feature vendida en el plan de negocio original, visible en el panel, cero efecto real. Costo contenido (ya diseñado como Task 6 de Fase 4). **Implementar.**
2. **`MIN_QUANTITY.countUnit: PIECES`** — o se implementa el conteo real de piezas (requiere sumar `quantityPerSet` de `set_items` por línea) o se retira la opción del selector hasta implementarla. Dado el tamaño acotado del fix (extender `SetMeta` con piezas por set), **implementar el conteo real.**
3. **`COLOR_RESTRICTION`** — implementar un selector de color completo en los 3 modos del carrito es una feature de UI grande, fuera de proporción para esta fase. **Decisión: ocultar/deshabilitar la opción en `RuleForm.tsx`** con nota explícita "sin efecto — no existe selector de color en el carrito corporativo todavía", en vez de fingir que funciona.
4. **`INVENTORY_MODE` `BLOCK`/`INFORMATIVE`** — el negocio ya decidió `IGNORE` como comportamiento por defecto (decisión #10 del plan de negocio original: coherente con cotización referencial). Implementar bloqueo real de stock es una feature de flujo de inventario, no un fix de motor de reglas. **Decisión: deshabilitar `BLOCK`/`INFORMATIVE` en el selector, dejar solo `IGNORE` seleccionable**, con nota "próximamente" para las otras dos.
5. **Ámbito `PRODUCT`** — propagar `productId` correctamente requeriría tocar cada punto de resolución (grids, PDP individual, ficha de set) para pasar el producto específico bajo evaluación, lo cual es un cambio de mayor alcance que esta fase. **Decisión: deshabilitar la opción "Producto específico" en el selector de ámbito** para los 10 tipos, con nota "próximamente".
6. **`VOLUME_SCALE` ámbito no-GLOBAL** y **`PRICE_VISIBILITY` inconsistencia grid vs. detalle** — ambos requieren resolver reglas por ítem dentro de listados (loop sobre cada producto/set en el grid), un cambio de mayor superficie y riesgo de rendimiento (N resoluciones por página en vez de 1). **Decisión: no implementar en esta fase — documentar la limitación exacta en `RULE_DOCS` (Fase 1) y dejar los ámbitos seleccionables pero con advertencia ámbar en el panel de documentación** ("en el listado de productos/sets solo se evalúa a nivel Global; el ámbito específico solo aplica dentro de la ficha de detalle").
7. **`MIN_QUANTITY` en ámbito SET/SET_GROUP/BRAND** — no se retira (sigue siendo útil como información al cliente), pero se documenta sin ambigüedad en `RULE_DOCS`: "Este ámbito es solo informativo — se muestra en la ficha del set pero el mínimo que realmente bloquea el envío es siempre el de ámbito Global."

Los puntos 3, 4 y 5 se implementan como **bloqueo/ocultamiento en el formulario**, no como features nuevas — cumplen el "principio de no-opción-muerta" de la Fase 3 sin expandir el alcance del plan a construir un selector de color o un motor de inventario completos.

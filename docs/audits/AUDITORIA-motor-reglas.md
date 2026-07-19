# Auditoría de aplicación efectiva — Motor de Reglas

> Verificado contra el código real (`src/lib/rules-engine/`, páginas del catálogo, `CartContext`/`CorporateCartContext`), no contra la documentación previa. Cada veredicto cita el archivo y la línea exacta que lo sustenta. Última actualización: 2026-07-13 — los 9 tipos de regla tienen efecto real en al menos un ámbito, y el ámbito Producto está activo en 8 de los 9 (ver matriz y resumen ejecutivo). La disponibilidad de variantes (agotado/bajo pedido) se gestiona con el `status` manual de cada variante, un concepto independiente del motor de reglas.

## Cómo leer esta auditoría

- **✅ Funciona** — el tipo/ámbito se resuelve y se consume donde importa; crear la regla produce el efecto esperado.
- **⚠️ Parcial** — funciona en algún subconjunto de ámbitos/catálogos/opciones, pero no en todos los que el panel permite seleccionar.
- **❌ Muerta** — se puede crear la regla desde el panel, se guarda en `business_rules`, pero ningún código de producción la consume. El admin cree que algo pasa y no pasa nada.

---

## Matriz tipo de regla × aplicación

### 1. `MIN_QUANTITY` — ✅ Funciona completo (GLOBAL + contextual simultáneos)

- **Dónde se resuelve:**
  - `validate.ts` — mínimo GLOBAL sobre el total del carrito completo (sin cambios de comportamiento).
  - `validate.ts` (`resolveContextualRule`, `resolve.ts`) — para cada ítem del carrito, la regla `MIN_QUANTITY` contextual (Marca/Grupo de Sets/Set/Producto) más específica que le aplica, si existe alguna. Los ítems se agrupan por la regla que efectivamente les aplica y cada grupo se valida contra su propio mínimo.
  - `corporativo/s/[slug]/page.tsx` — mismo contexto completo (incluye `productIds` de las piezas del set), usado para el texto informativo "Compra mínima: N sets" de esa ficha.
- **Dónde se aplica:** Catálogo corporativo.
- **Comportamiento:** el mínimo GLOBAL y cualquier mínimo contextual se exigen A LA VEZ — uno no reemplaza al otro. Un mínimo de Marca "24 sets" bloquea el envío si esa marca no llega a 24 en el carrito, sin importar que el total del carrito ya supere el mínimo Global. La ficha del set muestra el mínimo de la regla más específica que le aplica, y ese es el mismo número que el servidor exige para ese subconjunto.
- `countUnit: "PIECES"` funciona igual en ámbito GLOBAL y en ámbito contextual, vía `setMeta.piecesPerSet`.

### 2. `MULTIPLES_ONLY` — ✅ Funciona completo

- Se resuelve con contexto completo (`setId`, `setGroupId`, `brandId`, `productIds`) dentro del bucle por ítem de `validate.ts`.
- Se aplica por línea.
- Los 5 ámbitos (`GLOBAL`, `BRAND`, `SET_GROUP`, `SET`, `PRODUCT`) tienen efecto real.

### 3. `QUANTITY_RANGE` — ✅ Funciona completo

- Mismo patrón que `MULTIPLES_ONLY`.
- `max: null` se maneja correctamente — no rompe con rango abierto.
- Los 5 ámbitos funcionan.

### 4. `SIZE_MODE` — ✅ Funciona completo

- Se resuelve con contexto completo (incluye `productIds`) en `corporativo/s/[slug]/page.tsx`.
- Los 3 modos (`MATRIX`, `PER_PIECE`, `NO_SIZES`) están implementados en `SetDetailContent.tsx` y cada uno serializa correctamente su forma de carrito (`size`, `pieceSelections`, o solo `quantity`).
- Los 5 ámbitos funcionan; una regla de ámbito Producto determina el modo de tallas de todo el set que lo contiene.

### 5. `PRICE_VISIBILITY` — ✅ Funciona completo (resolución por ítem en listados y fichas)

- Se resuelve **por ítem** en cada punto donde se muestra un precio, tanto en listados como en fichas de detalle:
  - Catálogo individual: `ProductCard`, `QuickViewModal`, `CrossSellCard`, ficha de producto (`legacy-pages/Product.tsx`) y cada línea del carrito (`CartItem`) resuelven su propia visibilidad con el `brandId`/`productId` de ESE producto — el mismo componente `PriceVisibilityContext` recibe las reglas una sola vez desde el layout y cada consumidor resuelve en memoria, sin consultas adicionales.
  - Catálogo corporativo: el grid (`CorporativoContent`) resuelve por set (`brandId`/`setGroupId`/`productIds` de sus piezas) igual que la ficha de detalle (`corporativo/s/[slug]/page.tsx`) — ambos puntos citan la misma regla y muestran el mismo resultado para un mismo set.
- Los 5 ámbitos (`GLOBAL`, `BRAND`, `SET_GROUP`, `SET`, `PRODUCT`) tienen efecto real en listados y en fichas; ya no existe la inconsistencia "precio visible en la tarjeta, oculto en el detalle" documentada en versiones anteriores de esta auditoría.
- `catalog: INDIVIDUAL | CORPORATE | BOTH` se sigue respetando en cada punto.
- Los componentes de chrome que no representan un único producto (menú, mega-menú, resumen agregado del carrito individual) siguen evaluando solo el ámbito Global — no tiene sentido resolverlos por ítem.

### 6. `VOLUME_SCALE` — ✅ Funciona completo (resolución por ítem, sin acumulación)

- Se resuelve **por ítem** (`setId`/`setGroupId`/`brandId`/`productIds`) dentro de `computeCartPricing`: cada set del carrito cae bajo la escala más específica que le aplica (Producto > Set > Grupo de Sets > Marca > Global). A diferencia de `PROMO`, las escalas NO se acumulan — la más específica reemplaza a la más general para los sets que cubre, no se suman.
- El tramo de cada escala se calcula sobre la cantidad y el subtotal SOLO de los sets que caen bajo esa escala en particular (no sobre el carrito completo cuando la escala no es Global).
- Los 5 ámbitos (`GLOBAL`, `BRAND`, `SET_GROUP`, `SET`, `PRODUCT`) tienen efecto real. `PricingResult.volumeScaleBreakdown` expone qué regla aportó qué monto cuando hay más de una escala activa a la vez sobre distintos subconjuntos del carrito.

### 7. `PROMO` — ✅ Corregido en Fase 3, ampliado a 8 tipos (2026-07-13)

- **Antes de Fase 3:** se resolvía (`resolved.promos`, un arreglo de `PromoConfig`) pero `pricing.ts` no lo leía en ningún punto — no existía código que aplicara un descuento `N_PLUS_ONE`.
- **Fase 3:** `pricing.ts:computeCartPricing` resolvió `PROMO` **por ítem** (contexto `setId`/`setGroupId`/`brandId`), acumulando todas las reglas activas y aplicables por set (multi-instancia), con un único tipo real (`N_PLUS_ONE`).
- **Ampliación (2026-07-13):** `PromoConfig` pasó de `{ kind: string, buy, free }` a una **unión discriminada por `kind`** con 8 tipos: `N_PLUS_ONE`, `PERCENT_OFF`, `FIXED_AMOUNT_OFF`, `FIXED_PRICE`, `NTH_UNIT_PCT` (los 5 por ítem, igual patrón que `MULTIPLES_ONLY`/`QUANTITY_RANGE`), `THRESHOLD_DISCOUNT` (nivel carrito/contexto, una sola vez por regla), `GIFT` (informativa, agrega `PricingResult.promoNotes` sin tocar montos) y `COMBO` (cruzada entre dos sets, solo ámbito GLOBAL). `resolveRules().promos` cambió de `PromoConfig[]` a `ResolvedPromo[]` (incluye `id`/`name` de la regla) para poder armar `PricingResult.promoBreakdown` (qué regla aportó qué monto). Orden de aplicación documentado en `RULE_DOCS.PROMO`: ítem → combo → umbral → regalo. Tope: el descuento de cada set nunca supera su propio `lineSubtotal`, y el total del carrito nunca queda negativo. Las configs `N_PLUS_ONE` ya guardadas en BD siguen validando y calculando exactamente igual (compatibilidad verificada con test dedicado). `RuleForm.tsx` ahora tiene un selector de tipo de promoción con campos dinámicos por tipo; `COMBO` fuerza ámbito GLOBAL y usa selectores de sets reales (no texto libre). El detector de conflictos ganó `PROMO_DOUBLE_DISCOUNT` (Precio fijo + Porcentaje/Monto fijo en el mismo contexto) y la validación de existencia/estado de los sets de un `COMBO` se implementó en la capa de rutas del panel admin (`checkComboSetsExist` en `rule-config-schemas.ts`), no en `conflicts.ts`, porque requiere base de datos. `POST /api/corporate/quotes` registra las notas de `GIFT` en `internalNotes` junto a los avisos de piezas bajo pedido. Ver `docs/reports/REPORTE-promociones-2026-07-13.md` para el detalle completo con ejemplos numéricos por tipo. Tests: `promo-pricing.test.ts` (20 casos), `promo-schema.test.ts` (11 casos de validación Zod), más las 4 pruebas de compatibilidad `N_PLUS_ONE` en `rules-engine.test.ts` y los nuevos casos en `conflicts.test.ts`.
- **Limitación documentada, no implementada:** el detector de conflictos no puede advertir un `THRESHOLD_DISCOUNT.minSubtotal` inalcanzable dado un `QUANTITY_RANGE.max` en el mismo contexto — haría falta conocer el precio de los sets involucrados, y `conflicts.ts` es un módulo puro sin acceso a precios ni a base de datos. Documentado como advertencia honesta en `RULE_DOCS.PROMO.warnings`, no simulado con datos falsos.

### 8. `COLOR_RESTRICTION` — ✅ Funciona completo

- El armador de combinaciones (`SetDetailContent.tsx`) muestra un selector de color POR PIEZA, poblado con los colores que tienen al menos una variante activa de esa pieza. El color elegido se guarda en `pieceSelections[].color` (una entrada por pieza), no a nivel de línea.
- `validate.ts` evalúa `COLOR_RESTRICTION` por fila × pieza: las unidades de una pieza en un color, dentro de una combinación, son `cantidadDeSets × quantityPerSet` de esa pieza — bloquea el envío nombrando pieza, color y mínimo exigido.
- El panel (`RuleForm.tsx`) usa un selector de color poblado desde la tabla `colors` real (vía `/api/admin/colors`), no texto libre.
- Los 5 ámbitos (`GLOBAL`, `BRAND`, `SET_GROUP`, `SET`, `PRODUCT`) tienen efecto real.

### 9. `VOLUME_DISCOUNT_RETAIL` — ✅ Funciona (en el único ámbito para el que se diseñó)

- Se resuelve en GLOBAL (`/api/rules/volume-discount-retail/route.ts:20`), consumido por `CartContext.tsx` (implementado y verificado en la sesión anterior).
- No existe ningún punto que lo resuelva con contexto de marca o producto — pero tampoco el diseño original (Fase 4, Task 2) contemplaba otro ámbito que GLOBAL para el catálogo individual, así que no se cuenta como "parcial": es exactamente el alcance para el que se construyó.

---

## Ámbito `PRODUCT` (transversal a 8 de los 9 tipos) — ✅ Funciona

`RuleContext` acepta `productIds?: string[]` (además del `productId` singular ya existente, usado en retail) — una regla de ámbito Producto aplica si su `scopeId` está entre esos ids. En el flujo corporativo, `productIds` se construye a partir de las piezas del set (`SetMeta.pieces`); en retail, es `[product.id]`. Todos los puntos de resolución por ítem del carrito corporativo, del grid corporativo, de la ficha de set, del catálogo individual y del carrito individual pasan `productIds`/`productId` — una regla de ámbito Producto aplica a cualquier set que incluya ese producto entre sus piezas, o a la ficha/tarjeta de ese producto en el catálogo individual.

`VOLUME_DISCOUNT_RETAIL` es la única excepción, porque es, por diseño, un único descuento sobre todo el carrito retail (ver sección 9). Queda documentado en `RULE_DOCS` y bloqueado en el selector de ámbito del panel — no aparece como opción seleccionable sin efecto.

Cuando dos productos de un mismo set tienen reglas de ámbito Producto del mismo tipo, gana la de mayor `priority` — mismo desempate que cualquier otro empate de ámbito (ver `HIERARCHY_DOC` en `docs.ts`).

---

## Resumen ejecutivo

| Tipo | Veredicto | Ámbitos con efecto real | Nota clave |
|------|-----------|--------------------------|------------|
| `MIN_QUANTITY` | ✅ Completo | Global, Marca, Grupo de Sets, Set, Producto | GLOBAL y un mínimo contextual se exigen a la vez, no se reemplazan — ver sección 1 |
| `MULTIPLES_ONLY` | ✅ Completo | Global, Marca, Grupo de Sets, Set, Producto | — |
| `QUANTITY_RANGE` | ✅ Completo | Global, Marca, Grupo de Sets, Set, Producto | — |
| `SIZE_MODE` | ✅ Completo | Global, Marca, Grupo de Sets, Set, Producto | — |
| `PRICE_VISIBILITY` | ✅ Completo | Global, Marca, Grupo de Sets, Set, Producto | Resolución por ítem en listados y fichas de ambos catálogos — ver sección 5 |
| `VOLUME_SCALE` | ✅ Completo | Global, Marca, Grupo de Sets, Set, Producto | Resolución por ítem sin acumulación entre escalas — ver sección 6 |
| `PROMO` | ✅ Completo | Global, Marca, Grupo de Sets, Set, Producto (Combo: solo Global) | Unión discriminada por `kind`: 5 por ítem, umbral, regalo informativo y combo cruzado — ver sección 7 |
| `COLOR_RESTRICTION` | ✅ Completo | Global, Marca, Grupo de Sets, Set, Producto | Selector de color real en los 3 modos del carrito — ver sección 8 |
| `VOLUME_DISCOUNT_RETAIL` | ✅ Completo | Global (diseño intencional) | Único descuento sobre todo el carrito retail — ver sección 9 |

---

## Lista priorizada de fixes para Fase 3 — resultado

> Registro histórico de una sesión anterior. Los puntos 3, 5, 6 y 7 quedaron superados por la activación de ámbitos descrita en "Activación de ámbitos contextuales" al final de este documento — la matriz y el resumen ejecutivo arriba reflejan el estado actual.

Ordenada por impacto de negocio y costo de implementación. Estado real tras ejecutar la Fase 3:

1. **`PROMO` en `computeCartPricing`** — ✅ **Implementado.** Se resuelve por ítem (SET/SET_GROUP/BRAND/GLOBAL), acumulable, expuesto en `PricingResult.promoDiscountAmount` y visible en el carrito corporativo como "Descuento por promoción". Ver sección 8 arriba.
2. **`MIN_QUANTITY.countUnit: PIECES`** — ✅ **Implementado.** Conteo real de piezas vía `setMeta.piecesPerSet`; `ValidationResult.countUnit` permite que la UI muestre la unidad correcta. Ver sección 1 arriba.
3. **`COLOR_RESTRICTION`** — ✅ **Deshabilitada en el panel** (`RuleForm.tsx`, tipo de regla marcado "sin efecto aún"). No se construyó el selector de color — decisión de alcance confirmada.
4. **Ámbito `PRODUCT`** — ✅ **Deshabilitado en el panel** (`RuleForm.tsx`, ámbito marcado "sin efecto aún") para los 9 tipos.
5. **`VOLUME_SCALE` ámbito no-GLOBAL** y **`PRICE_VISIBILITY` inconsistencia grid vs. detalle** — **No implementado, documentado.** Ambos requieren resolver reglas por ítem dentro de listados completos (N resoluciones por página), cambio de mayor superficie/riesgo de rendimiento fuera de esta fase. `RULE_DOCS` (Fase 1) documenta la limitación exacta y `RuleDocPanel` (Fase 2) la muestra como advertencia ámbar cuando el admin elige un ámbito no soportado.
6. **`MIN_QUANTITY` en ámbito SET/SET_GROUP/BRAND** — **No implementado, documentado.** Se mantiene seleccionable (sigue siendo útil como información al cliente en la ficha del set) pero `RULE_DOCS.MIN_QUANTITY.warnings` explica sin ambigüedad que no bloquea el envío — solo el ámbito Global lo hace.

Los puntos 3 y 4 se implementan como **bloqueo/ocultamiento en el formulario**, no como features nuevas — cumplen el "principio de no-opción-muerta" de la Fase 3 sin expandir el alcance del plan a construir un selector de color completo.

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

## Activación de ámbitos contextuales (2026-07-13)

Cierra los hallazgos pendientes de esta auditoría: `MIN_QUANTITY` contextual, `PRICE_VISIBILITY` por ítem en listados, `VOLUME_SCALE` por ítem, `COLOR_RESTRICTION` completa y el ámbito `PRODUCT` en 8 de los 9 tipos. `PROMO` no se tocó en esta sesión (ver sección 7, ya vigente de una sesión anterior).

**Motor (`src/lib/rules-engine/`):** `RuleContext` gana `productIds?: string[]` (además del `productId` singular ya existente) — una regla de ámbito Producto aplica si su `scopeId` está entre esos ids. `resolve.ts` gana `resolveContextualRule` (la regla no-GLOBAL más específica para un contexto, usada para combinar un mínimo contextual con el Global sin que uno reemplace al otro) y `resolveBestRule` (la regla ganadora completa, con `id`/`name`, incluyendo GLOBAL como candidato — usada para agrupar ítems por la escala de volumen que efectivamente les aplica). `validate.ts` agrega la validación de `MIN_QUANTITY` contextual: agrupa los ítems del carrito por la regla no-GLOBAL más específica que les aplica (si existe alguna) y exige su propio mínimo, ADEMÁS del mínimo Global. `pricing.ts` reescribe `VOLUME_SCALE` para resolverse por ítem (antes: una sola vez con contexto vacío) — agrupa ítems por la escala ganadora y calcula el tramo sobre la cantidad/subtotal de cada grupo, sin acumular escalas entre sí; expone `PricingResult.volumeScaleBreakdown`.

**Capa de datos:** `CorporateSetSummary` gana `brandId`, `setGroupId` (ids, no solo nombres) y `productIds` (piezas del set) — antes el grid corporativo no tenía forma de resolver reglas por ítem porque solo conocía nombres para mostrar, no ids para resolver. `getActiveCorporateSets` se extiende para calcularlos con una sola consulta adicional (no N+1). `Product` (catálogo individual) y `CartItem` ganan `brandId`.

**PRICE_VISIBILITY por ítem:** `PriceVisibilityContext` pasó de recibir un booleano ya resuelto en servidor a recibir las reglas `PRICE_VISIBILITY` completas — cada componente que muestra un precio (`ProductCard`, `QuickViewModal`, `CrossSellCard`, `CartItem`, ficha de producto) resuelve su propia visibilidad en memoria con `resolveRules(rules, { brandId, productId })`. El grid corporativo (`CorporativoContent`) hace lo mismo por set. Los componentes de chrome (`Header`, `MegaMenu`) y el resumen agregado del carrito individual siguen llamando al hook sin argumentos (ámbito Global únicamente) — no representan un único producto.

**COLOR_RESTRICTION:** el armador de combinaciones (`SetDetailContent.tsx`) muestra un selector de color por cada pieza del set, con los colores que tienen variante activa de esa pieza. `RuleForm.tsx` reemplaza el campo de texto libre `colorCode` por un selector poblado desde `/api/admin/colors`.

**Panel admin (`RuleForm.tsx`):** el ámbito "Producto específico" pasa de deshabilitado a un selector de productos reales (`/api/admin/products/lite`, endpoint nuevo y liviano — el existente `/api/admin/products` trae variantes e imágenes completas, demasiado pesado para un dropdown). Queda forzado a Global únicamente para `VOLUME_DISCOUNT_RETAIL` (diseño intencional, igual que `PROMO` `COMBO`).

**Detector de conflictos:** sin cambios de lógica — las comparaciones de ámbito que ya hacía siguen siendo válidas con el ámbito Producto activo, porque `scopesOverlap` ya trataba cualquier ámbito no-Global de forma conservadora.

Ver `docs/reports/REPORTE-reglas-ambitos-2026-07-13.md` para el detalle completo con ejemplos numéricos.

**Verificación:** `npx vitest run --no-file-parallelism src/lib/rules-engine` en verde, `npm run build` y `npm run lint` limpios — ver el reporte para el resultado exacto.

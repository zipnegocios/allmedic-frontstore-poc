# Activación de todas las combinaciones tipo × ámbito del motor de reglas

**Fecha:** 2026-07-13
**Alcance:** activar los ámbitos Marca/Grupo de Sets/Set/Producto donde antes solo funcionaba Global (`MIN_QUANTITY`, `PRICE_VISIBILITY`, `VOLUME_SCALE`), completar `COLOR_RESTRICTION` (selector de color real) y activar el ámbito Producto de forma transversal en 8 de los 10 tipos de regla. `INVENTORY_MODE` y `PROMO` no se tocaron — ya estaban íntegramente implementados por sesiones anteriores.

## Qué existía antes

La auditoría (`docs/audits/AUDITORIA-motor-reglas.md`) documentaba tres promesas rotas y dos tipos sin efecto real:

- **`MIN_QUANTITY`**: solo el ámbito Global bloqueaba el envío del carrito. Un mínimo de Marca/Set se mostraba en la ficha del set ("Compra mínima: N sets") pero el servidor nunca lo validaba — la página prometía un número, el servidor exigía otro.
- **`PRICE_VISIBILITY`**: los grids (`/catalogo`, `/corporativo`) resolvían con contexto vacío (solo Global funcionaba ahí); los ámbitos específicos solo actuaban en la ficha de detalle. Un mismo set podía mostrar precio en la tarjeta del listado y ocultarlo al entrar al detalle.
- **`VOLUME_SCALE`**: se resolvía una sola vez con contexto vacío — cualquier regla de ámbito Marca/Grupo/Set se podía crear y guardar, pero nunca se resolvía con el contexto necesario para aplicar.
- **`COLOR_RESTRICTION`**: estructuralmente inalcanzable — ningún modo del carrito tenía selector de color, así que `line.color` siempre era `undefined`.
- **Ámbito `PRODUCT`**: muerto para los 10 tipos — `productId` nunca se propagaba a `resolveRules` en ningún punto de resolución.

## Qué se implementó

### 1. Ámbito Producto en el motor (transversal)

**`src/lib/rules-engine/types.ts`** — `RuleContext` gana `productIds?: string[]`, manteniendo `productId` singular como compatibilidad (retail, un solo producto). **`resolve.ts`** — `scopeMatchesContext` para `PRODUCT` ahora comprueba si `rule.scopeId` está entre `context.productIds` (con fallback a `[productId]`). Se agregan dos funciones exportadas nuevas:

- `resolveContextualRule(rules, ruleType, context, now)` — la regla NO-Global más específica para un contexto, o `undefined`. Usada por `MIN_QUANTITY` para saber si existe un mínimo contextual que deba exigirse ADEMÁS del Global.
- `resolveBestRule(rules, ruleType, context, now)` — la regla ganadora completa (con `id`/`name`), incluyendo Global como candidato. Usada por `VOLUME_SCALE` para agrupar ítems del carrito por la escala que efectivamente les gana.

En el flujo corporativo, `productIds` se construye a partir de `SetMeta.pieces` (ya existía, usado por `INVENTORY_MODE`) — ningún tipo necesitó una consulta nueva a base de datos para esto. En retail, es `[product.id]`.

**Excepciones documentadas, no implementadas:** `INVENTORY_MODE` no recibe `productIds` — su verificación real en servidor (`checkInventory`) calcula demanda por SET completo, no por una pieza aislada; activar el ámbito Producto solo en la UI sin cambiar esa verificación real habría creado una nueva promesa rota (la ficha mostraría disponibilidad de un ámbito que el servidor no aplicaría al bloquear el envío). `VOLUME_DISCOUNT_RETAIL` sigue Global-only por diseño (ver punto 5).

### 2. `MIN_QUANTITY` contextual bloqueante

**`src/lib/rules-engine/validate.ts`** — además del mínimo Global (sin cambios), se agrupan los ítems del carrito por la regla `MIN_QUANTITY` no-Global más específica que les aplica (vía `resolveContextualRule`), y cada grupo se valida contra su propio mínimo. El mínimo Global y cualquier mínimo contextual se exigen A LA VEZ — uno no reemplaza al otro.

**Ejemplo numérico:** regla Global `min: 10` + regla de Marca "FIGS" `min: 20`. Carrito: 8 sets de FIGS + 5 sets de otra marca = 13 sets totales. El total (13) supera el mínimo Global (10) ✅, pero FIGS por sí sola (8) no alcanza su propio mínimo (20) ❌ → el envío se bloquea con el mensaje `"Mínimo FIGS" requiere un mínimo de 20 sets; llevas 8 — agrega 12 sets más.`

### 3. `PRICE_VISIBILITY` por ítem en listados y fichas

**Retail:** `Product` (tipo) y la consulta en `data-service.ts` ganan `brandId`. `PriceVisibilityContext` pasó de recibir un booleano ya resuelto en servidor a recibir el arreglo de reglas `PRICE_VISIBILITY` completo — cada componente que muestra un precio (`ProductCard`, `QuickViewModal`, `CrossSellCard`, `CartItem`, ficha de producto) llama `usePriceVisibility({ brandId, productId })` y resuelve en memoria con `resolveRules`, sin ninguna consulta adicional. `CartItem` (tipo) y `CartContext.addItem` ganan `brandId` para que el carrito también resuelva por ítem.

**Corporativo:** `CorporateSetSummary` gana `brandId`, `setGroupId` (ids reales, no solo nombres para mostrar) y `productIds` (piezas del set) — `getActiveCorporateSets` los calcula con una consulta adicional, no N+1. El grid (`CorporativoContent`) resuelve la visibilidad por set con esos datos.

**Componentes de chrome** (`Header`, `MegaMenu`) y el resumen agregado del carrito individual siguen llamando al hook sin argumentos (ámbito Global únicamente) — no representan un único producto, así que resolverlos por ítem no tiene sentido; se documentó esta frontera explícitamente en `RULE_DOCS.PRICE_VISIBILITY.warnings`.

### 4. `VOLUME_SCALE` por ítem, sin acumulación

**`src/lib/rules-engine/pricing.ts`** — se agrupan los ítems del carrito por la regla `VOLUME_SCALE` ganadora (`resolveBestRule`, incluye Global como fallback). El tramo de cada grupo se calcula sobre la cantidad y el subtotal SOLO de los ítems de ese grupo. A diferencia de `PROMO`, las escalas NO se acumulan: la más específica reemplaza a la más general para los ítems que cubre.

**Ejemplo numérico:** escala Global `{minQty: 1, discountPct: 5}` + escala de Set "set-a" `{minQty: 1, discountPct: 15}`. Carrito: 5 unidades de set-a a $10 c/u = $50. Si se acumularan, sería 5%+15%=20% ($10). Como no se acumulan, gana solo la más específica (Set): 15% = **$7.50** de descuento.

`PricingResult.volumeScaleBreakdown` expone qué regla aportó qué monto cuando hay más de un grupo activo a la vez.

### 5. `COLOR_RESTRICTION` completa

**`SetDetailContent.tsx`** — calcula los colores comunes a todas las piezas del set que además tienen al menos una variante activa (`hasActiveVariant`), y muestra un selector de color (swatches con nombre) visible en los 3 modos de talla. **Decisión de diseño:** el color se elige UNA vez por línea del carrito, no por pieza individual — extender la selección a nivel de pieza habría requerido cambiar la forma de `pieceSelections` (usada también por `INVENTORY_MODE` para calcular demanda), fuera del alcance de esta activación. Con `line.color` poblado, la validación ya existente en `validate.ts` (`if (line.color)` contra `resolved.colorRestrictions`) cobra vida sin cambios de lógica.

**`RuleForm.tsx`** — `colorCode` deja de ser texto libre: selector poblado desde `/api/admin/colors` (ya existía, reutilizado con `limit=1000`).

### 6. Panel de administración

**`RuleForm.tsx`** — el ámbito "Producto específico" pasa de deshabilitado a un selector de productos reales. Se creó un endpoint liviano nuevo, **`GET /api/admin/products/lite`** (`getAdminProductsLite` en `admin-data-service.ts`), porque el endpoint existente `/api/admin/products` trae variantes e imágenes completas — demasiado pesado para un simple dropdown. El ámbito queda deshabilitado únicamente para `INVENTORY_MODE` (no tocado esta sesión) y forzado a Global para `VOLUME_DISCOUNT_RETAIL` (diseño intencional — es un único descuento sobre todo el carrito retail, igual criterio que `PROMO` `COMBO` ya aplicaba).

### 7. Documentación

**`src/lib/rules-engine/docs.ts`** — `RULE_DOCS` actualizado para los 10 tipos: `supportedScopes` incluye `PRODUCT` en los 8 tipos donde ahora tiene efecto, `detail`/`examples`/`warnings` reescritos para describir el comportamiento actual (mínimos contextuales, resolución por ítem, no-acumulación de escalas, selector de color real). `HIERARCHY_DOC.detail` explica la semántica de ámbito Producto (aplica a cualquier set que contenga el producto) y el desempate por prioridad entre dos reglas Producto del mismo set. Se purgó toda referencia a "Fase N", "próximamente" o "aún no implementado" del contenido que queda vigente.

**`docs/audits/AUDITORIA-motor-reglas.md`** — la matriz tipo × ámbito y el resumen ejecutivo se reescribieron para reflejar el estado actual (los 10 tipos son ✅ Completo en su alcance de diseño), con fecha. Las secciones históricas de sesiones anteriores ("Lista priorizada de fixes para Fase 3", "Fase 5") se mantuvieron como registro, con una nota que señala que quedaron superadas por la nueva sección "Activación de ámbitos contextuales (2026-07-13)" agregada al final.

## Decisiones de diseño no explícitamente pedidas (documentadas aquí por transparencia)

1. **`INVENTORY_MODE` excluido del ámbito Producto** — ver punto 1. Es la única exclusión real entre los 10 tipos; sin ella, la ficha del set podría mostrar disponibilidad de un ámbito que el servidor jamás aplicaría al bloquear el envío.
2. **Color por línea, no por pieza** — ver punto 5. Elegido explícitamente en vez de extender `pieceSelections`, para no tocar la forma de datos que usa `INVENTORY_MODE`.
3. **Chrome (Header/MegaMenu) y resumen del carrito individual siguen en ámbito Global únicamente** — no representan un único producto/marca; resolverlos por ítem no tiene un "ítem" al cual atarse.
4. **Detector de conflictos sin cambios** — las comparaciones de ámbito que ya existían (`scopesOverlap`) siguen siendo válidas con el ámbito Producto activo, porque ya trataban cualquier ámbito no-Global de forma conservadora (solo compara igualdad exacta de scope+scopeId, o Global contra cualquiera). No hizo falta ninguna detección nueva específica de Producto.
5. **`/api/admin/products/lite` nuevo en vez de reutilizar `/api/admin/products`** — el existente trae variantes e imágenes completas (pensado para el listado del panel), demasiado pesado para un dropdown de selección simple.

## Verificación

- **`npx vitest run --no-file-parallelism src/lib/rules-engine`** → **138/138 tests en verde** (121 preexistentes + 17 nuevos en `scope-activation.test.ts`, cubriendo resolución PRODUCT, jerarquía PRODUCT > SET, desempate por prioridad, `MIN_QUANTITY` contextual + Global simultáneos, `countUnit: PIECES` contextual, `PRICE_VISIBILITY` por ítem, `VOLUME_SCALE` por ítem sin acumulación, y `COLOR_RESTRICTION` en sus 4 variantes incluida ámbito Producto). Ningún test preexistente cambió su expectativa — la compatibilidad con el comportamiento Global-only anterior se mantiene intacta cuando no hay reglas contextuales.
- **`npm run build`** → limpio. Se detectó y corrigió en el camino un error de tipos real: `CorporateSetDetail` (que extiende `CorporateSetSummary`) necesitaba el nuevo campo `productIds`, agregado en `getCorporateSetBySlug`.
- **`npm run lint`** → **83 problemas (80 errores, 3 warnings)**, idéntico al baseline de sesiones anteriores. El único archivo tocado que aparece en el lint (`ProductCard.tsx`) tiene un hallazgo preexistente en un `useEffect` no relacionado (líneas 28-31); la línea que modifiqué (47, la llamada a `usePriceVisibility`) no genera ningún hallazgo nuevo.

## Archivos creados/modificados

| Archivo | Propósito |
|---|---|
| `src/lib/rules-engine/types.ts` | `RuleContext.productIds`; `VolumeScaleBreakdownEntry`, `PricingResult.volumeScaleBreakdown` |
| `src/lib/rules-engine/resolve.ts` | Resolución PRODUCT vía `productIds`; `resolveContextualRule`, `resolveBestRule` |
| `src/lib/rules-engine/validate.ts` | `MIN_QUANTITY` contextual (Marca/Grupo/Set/Producto) además del Global; `productIds` en el contexto por ítem |
| `src/lib/rules-engine/pricing.ts` | `VOLUME_SCALE` por ítem sin acumulación; `productIds` en el contexto de `PROMO`/`itemInRuleScope` |
| `src/lib/rules-engine/index.ts` | Exporta `resolveContextualRule`, `resolveBestRule` |
| `src/lib/rules-engine/docs.ts` | `RULE_DOCS` de los 10 tipos actualizado; `HIERARCHY_DOC` explica el ámbito Producto |
| `src/lib/corporate-types.ts` | `CorporateSetSummary`/`CorporateSetDetail` ganan `brandId`, `setGroupId`, `productIds` |
| `src/lib/corporate-data-service.ts` | `getActiveCorporateSets`/`getCorporateSetBySlug` calculan `productIds`/ids de marca y grupo |
| `src/lib/types.ts` | `Product.brandId`, `CartItem.brandId` |
| `src/lib/data-service.ts` | Consulta y mapeo de productos incluyen `brandId` |
| `src/lib/admin-data-service.ts` | `getAdminProductsLite` (listado liviano para el selector de ámbito Producto) |
| `src/context/PriceVisibilityContext.tsx` | Reescrito: recibe reglas, resuelve por ítem en memoria |
| `src/context/CartContext.tsx` | `addItem` guarda `brandId` en el ítem del carrito |
| `src/app/(store)/layout.tsx` | Pasa las reglas `PRICE_VISIBILITY` al provider en vez de un booleano ya resuelto |
| `src/app/(store)/corporativo/page.tsx` | Pasa las reglas `PRICE_VISIBILITY` al grid en vez de un booleano |
| `src/app/(store)/corporativo/CorporativoContent.tsx` | Resuelve visibilidad de precio por set en el grid |
| `src/app/(store)/corporativo/s/[slug]/page.tsx` | Incluye `productIds` en la resolución (excepto para `INVENTORY_MODE`, resuelto aparte) |
| `src/app/(store)/corporativo/s/[slug]/SetDetailContent.tsx` | Selector de color; `pieces` en el ítem del carrito para resolución por ítem en el cliente |
| `src/context/CorporateCartContext.tsx` | `pieces` en `CorporateCartItem`/`setMeta` para que la previsualización cliente resuelva ámbito Producto igual que el servidor |
| `src/components/catalog/ProductCard.tsx`, `QuickViewModal.tsx`, `src/components/product/CrossSellCard.tsx`, `src/components/cart/CartItem.tsx`, `src/legacy-pages/Product.tsx` | Pasan `{ brandId, productId }` a `usePriceVisibility` |
| `src/components/admin/RuleForm.tsx` | Selector de productos y colores reales; ámbito Producto habilitado por tipo; `VOLUME_DISCOUNT_RETAIL` forzado a Global |
| `src/app/api/admin/products/lite/route.ts` | Endpoint nuevo — listado liviano de productos activos |
| `docs/audits/AUDITORIA-motor-reglas.md` | Matriz y resumen ejecutivo actualizados; nueva sección final con fecha |
| `src/lib/rules-engine/__tests__/scope-activation.test.ts` | 17 tests nuevos (PRODUCT, `MIN_QUANTITY` contextual, `PRICE_VISIBILITY` por ítem, `VOLUME_SCALE` por ítem, `COLOR_RESTRICTION`) |
| `src/lib/rules-engine/__tests__/docs.test.ts` | Aserciones actualizadas: los 10 tipos tienen `appliesTo`/`supportedScopes` no vacíos; verificación de qué tipos declaran `PRODUCT` |

## Commit recomendado (no ejecutado)

```
git commit -m "feat: activar ambitos contextuales en todo el motor de reglas (MIN_QUANTITY, PRICE_VISIBILITY, VOLUME_SCALE, COLOR_RESTRICTION, ambito PRODUCT)"
```

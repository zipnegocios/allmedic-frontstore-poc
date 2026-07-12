# Auditoría — Ensamblador de sets pro

Fecha: 2026-07-12. Auditoría de lectura previa a la refactorización del ensamblador de sets del panel admin.

## 1. `ProductForm.tsx`

Ya soporta creación/edición con un solo componente: `interface ProductFormProps { productId?: string; initialData?: ProductFormData }` — `productId` ausente ⇒ POST `/api/admin/products`; presente ⇒ PATCH `/api/admin/products/{id}`. Tras guardar: `toast.success(...)` + `router.push('/admin/products')` + `router.refresh()` (líneas ~234-236) — ignora el body de la respuesta.

Puntos que el modo embebido debe neutralizar:
- Redirección fija a `/admin/products` tras guardar (líneas 234-236).
- `<h1>` propio + botón "Volver" + `<div className="p-8 max-w-5xl">` — el componente es dueño de layout de página completo (líneas ~286-307), a diferencia de `RuleForm`.
- `useEffect` de auto-slug solo actúa en creación (`!productId`) — ya compatible con embebido, no requiere cambios.
- Carga `brands`/`colors` vía fetch propio al montar — sin caché compartida; si se monta junto a `SetForm` (que pide `brands` también) hay fetches duplicados, aceptado como ineficiencia menor, no bloqueante.

## 2. `RuleForm.tsx`

Props: `{ mode: 'create'|'edit'; ruleId?: string; initial?: {...} }`. **Sin chrome de página propio** — es un `<Card>` puro; el título/breadcrumb vive en la página contenedora (`rules/new/page.tsx`). Redirección post-guardado sí la hace el propio componente (`router.push('/admin/rules')`).

Patrón de "ámbito bloqueado" YA EXISTE y es la plantilla a reutilizar: `scopeForcedGlobal = comboLocked || ruleType === 'VOLUME_DISCOUNT_RETAIL'`, un `useEffect` que fuerza `scope`/`scopeId`, y `disabled={scopeForcedGlobal}` en el `<Select>`. Para "scope prefijado a SET del set actual" se replica el mismo patrón con el set en vez de forzar GLOBAL.

`SCOPE_UNAVAILABLE_BY_TYPE` ya existe para deshabilitar ámbitos por tipo de regla — no hace falta un mecanismo nuevo, solo usar el mismo si algún tipo necesita excluir SET (no es el caso aquí).

Detector de conflictos: `POST /api/admin/rules/check-conflicts`, debounce 600ms, dry-run con la regla completa (id vacío en creación) — no bloquea si el fetch falla.

`scopeOptions` viene de 5 fetches propios (`brands`, `set-groups`, `sets`, `products/lite`, `colors`) — el ensamblador embebido puede pasar el set actual sin necesidad de tocar esto, ya que el set ya estará en la lista de `sets`.

## 3. Schema `sets`

`corporateSets` (`src/db/schema/corporate.ts`) **no tiene ningún campo de precio propio hoy**. Convención a espejar de `products` (`src/db/schema/products.ts`): `priceWholesale: decimal(..., {precision:10, scale:2})`, `priceWholesaleSale: decimal(...)`, `wholesaleDiscountEnd: timestamp(..., {withTimezone:true})`, todos nullable. La migración nueva añade a `corporate_sets`: `price_manual`, `price_manual_sale`, `manual_discount_end` con la misma convención (decimal 10,2 nullable / timestamp con timezone nullable). `null` en `price_manual` = automático (comportamiento actual).

## 4. Cálculo del precio del set — 4 implementaciones a actualizar

Todas comparten la fórmula `wholesalePriceOf(priceWholesale, priceWholesaleSale) × quantityPerSet`, sumada por pieza:
1. `getActiveCorporateSets` (`corporate-data-service.ts`) — grid.
2. `getCorporateSetBySlug` (`corporate-data-service.ts`) — ficha.
3. `getSetPricesByIds` (`corporate-data-service.ts`) — alimenta `computeCartPricing` (servidor, fuente de verdad para el carrito).
4. `SetForm.tsx` (admin) — **reimplementación duplicada en cliente** (`productPrice`/`pricePreview`), no reutiliza `wholesalePriceOf`. Riesgo señalado por la auditoría: es fácil actualizar las 3 del servidor y olvidar esta.

El override de precio del set se aplica en los 4 puntos: si `priceManual` (vigente según `manualDiscountEnd`) existe, se usa en vez de la suma.

## 5. Precedencia precio × reglas

Confirmado: `computeCartPricing` recibe `setPrices: Record<string, SetPriceInfo>` **ya resuelto desde afuera** — no calcula desde piezas internamente. `VOLUME_SCALE` y `PROMO` consumen `unitPrice`/`lineSubtotal` derivados de `setPrices[setId].pricePerSet` en un único punto de entrada (`pricing.ts:69-70` y `:155`). **Un precio override del set solo requiere cambiar qué valor entra en `pricePerSet`** en las 3 funciones de servidor de la sección 4 — `pricing.ts` no necesita ningún cambio de lógica, solo su doc si el texto menciona "suma de piezas" explícitamente.

## 6. `/api/admin/products/eligible-for-sets`

Criterio: `isActive = true` AND (`visibility = 'GROUPS'` OR `visibility = 'BOTH'`). Campos: `id, name, slug, priceWholesale, priceWholesaleSale, priceNormal, visibility, brandName` — sin `sku`/`category`/variantes. Ampliar el `SELECT` si el nuevo selector de piezas necesita más metadata (thumbnail, colores, tallas) — sí lo necesita para la Fase 2 (resumen de variantes), así que se amplía.

## Riesgos y ajustes adoptados

1. **Asimetría de chrome entre `ProductForm` y `RuleForm`**: `ProductForm` es dueño de layout de página completo (título, volver, `<div className="p-8">`); `RuleForm` es un componente desnudo. Ajuste: `ProductForm` gana `embedded?: boolean` que, cuando es `true`, omite el `<h1>`/botón volver/padding de página y expone `onSaved`/`onCancel` en vez de redirigir — igual que se hará con `RuleForm` (que ya solo necesita agregar `embedded` para omitir su propio `router.push`, ya que no tiene chrome de página que quitar).
2. **Fetches duplicados de brands/colors** entre `SetForm`, `ProductForm` y `RuleForm` sin caché compartida: aceptado como ineficiencia conocida, no se introduce una capa de caché nueva (fuera de alcance de este plan, no lo pide ninguna decisión).
3. **`SetForm.tsx` reimplementa el cálculo de precio en cliente**: se corrige haciendo que la vista previa del set use la MISMA fórmula (incluyendo el nuevo override) de forma explícita en el propio `SetForm`, documentando que es intencionalmente un cálculo de cliente (vista previa antes de guardar, sin ida y vuelta al servidor) — se mantiene la duplicación pero ahora con paridad de fórmula (incluye override), no se introduce una quinta implementación.
4. Confirmado (b) y (c) del enunciado — sin contradicciones, se continúa según el plan.

No se encontraron contradicciones que obliguen a detener la ejecución del plan.

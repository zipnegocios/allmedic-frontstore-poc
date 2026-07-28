# Atributos EAV como eje de variante seleccionable en compra

## Contexto

Hoy los atributos EAV (`attributes`/`attributeValues`, gestionados en `/admin/atributos`, ej.
"Modelo de corte", "Modelo de terminado") se asocian a un tipo de producto vía
`productTypeAttributes` y se eligen **una sola vez por producto** en la ficha General
(`AttributeStyleSection`, campo `styleAttributes`). Ese único valor se copia idénticamente a
todas las variantes (`ProductForm.tsx`, `withSyncedStyleAttributes`) justo antes de guardar, y el
generador de matriz (`AttributeMatrixSection.generateMatrix`) solo cruza color × talla — nunca
atributos EAV.

Esto significa que, aunque `variant_attribute_values` y `attributes_payload.styles` ya son
genéricos y por-variante (y ya alimentan los filtros del catálogo y la columna "Atributos" de
`/admin/productos` sin cambios), en la práctica un atributo EAV nunca puede distinguir dos
variantes del mismo producto: todas comparten el mismo valor.

El pedido: para ciertos tipos de producto (ej. Pantalón, donde "Modelo de corte" varía
realmente por SKU) el comprador debe poder **elegir** el valor al armar el pedido — igual que
hoy elige color y talla — mientras que para otros (ej. Camisa, donde "Modelo de terminado" es
fijo) el atributo debe seguir comportándose como hoy: un dato informativo de ficha, sin
selector.

La flag que determina el comportamiento vive en la relación **Tipo de Producto ↔ Atributo**
(`productTypeAttributes`), no en el atributo global ni por producto individual — así "Camisa +
Modelo de terminado" puede ser informativo mientras "Pantalón + Modelo de corte" es
seleccionable, reutilizando el mismo atributo global en ambos casos.

## Terminología

- **Modo Informativo** (`usageMode = 'INFORMATIVE'`, default): comportamiento actual sin
  cambios. Un solo valor por producto, mismo para todas las variantes, mostrado como dato de
  ficha.
- **Modo Variante** (`usageMode = 'VARIANT'`): el atributo se convierte en un eje más de la
  matriz de generación de variantes (junto a color y talla). Cada valor activo genera su propia
  fila de `product_variants` con SKU/stock/estado independiente. El comprador elige un valor al
  armar el pedido, exactamente como hoy elige talla.

El `displayType` (`'buttons' | 'select'`) que ya existe en `attributes` no cambia de
significado y se respeta en ambos modos: determina si el selector (cuando aplica) se renderiza
como botones o como desplegable.

## Modelo de datos

Nueva columna en `product_type_attributes` (`src/db/schema/products.ts`, tabla en líneas
115-123):

```ts
usageMode: text("usage_mode").notNull().default("INFORMATIVE"), // 'INFORMATIVE' | 'VARIANT'
```

Sin migración de datos: el default `'INFORMATIVE'` preserva el comportamiento actual para
todas las asociaciones tipo-de-producto↔atributo existentes. Nada se rompe hasta que un admin
cambie explícitamente el modo de una asociación puntual.

No se toca `attributes` (el catálogo global), `attributeValues`, `variantAttributeValues`, ni
`attributes_payload` — su forma y pipeline (`src/lib/attributes-payload/`) ya son correctos y
genéricos; el cambio es exclusivamente sobre *cuántas* filas de variante se generan y *dónde* se
captura el valor en el formulario admin.

## Admin — Tipos de Producto

En la UI donde se gestiona `productTypeAttributes` (asociación atributo ↔ tipo de producto,
junto al `isRequired`/`sortOrder` existentes), se agrega un control (radio o select) con dos
opciones: "Informativo" / "Variante". Cambia `usageMode` para esa asociación puntual.

API: el endpoint que crea/actualiza `productTypeAttributes` (`/api/admin/product-types/[id]/attributes`
o equivalente) acepta y persiste `usageMode` en el payload existente.

## Admin — Ficha de Producto (`ProductForm.tsx`)

Los atributos aplicables a un producto (derivados de su `productTypeId` vía
`useProductTypeAttributes`) se dividen en dos grupos según `usageMode`:

**Atributos `INFORMATIVE`** — sin cambios de comportamiento:
- Se editan en `AttributeStyleSection` (ficha General), un valor único por producto
  (`styleAttributes: Record<attributeId, attributeValueId>`).
- `withSyncedStyleAttributes` sigue copiando ese valor a todas las variantes al guardar — pero
  ahora **filtra** para copiar solo los `attributeValueIds` correspondientes a atributos
  `INFORMATIVE`; los `VARIANT` se excluyen de esta copia porque se manejan aparte.

**Atributos `VARIANT`** — nuevo comportamiento:
- Desaparecen de `AttributeStyleSection` (no se piden como valor único global).
- Se incorporan a `AttributeMatrixSection` como un eje más del generador. `generateMatrix()`
  pasa de cruzar `selectedColorIds × selectedSizes` a cruzar
  `selectedColorIds × selectedSizes × valoresActivosDeAtributo1 × valoresActivosDeAtributo2 × ...`
  (uno por cada atributo `VARIANT` aplicable al tipo de producto; si hay más de uno, se cruzan
  todos entre sí — confirmado explícitamente, no se intenta limitar a un solo eje extra).
- El admin, igual que hoy con color×talla, puede eliminar/desactivar de la matriz generada las
  filas que no correspondan a su catálogo real (ej. si "Petite" no existe en color Wine, se
  borra esa fila).
- Cada fila resultante lleva sus `attributeValueIds` propios (ya no copiados desde
  `styleAttributes`), persistidos vía `variant_attribute_values` como hoy.

**Retrocompatibilidad de carga:** la derivación actual en `ProductForm.tsx` (que reconstruye
`styleAttributes` leyendo la primera variante con `attributeValueIds`) se ajusta para leer
`usageMode` de cada atributo y solo poblar `styleAttributes` con los `INFORMATIVE`; los `VARIANT`
se derivan por variante individual hacia la matriz en vez de colapsarse a un único valor.

**Dedup de matriz:** la clave de deduplicación de filas generadas
(hoy `` `${colorId}|${size}` ``) se extiende a incluir los valores de atributos `VARIANT`
seleccionados, para no perder combinaciones legítimas que difieran solo en ese eje.

## PDP retail (`src/legacy-pages/Product.tsx`)

Generalización del caso especial existente de `selectedFit`:

- Estado: `selectedFit: Fit | undefined` → `selectedStyles: Record<string, string>` (slug de
  atributo → valor elegido), poblado dinámicamente según qué atributos `VARIANT` tenga el
  producto (vía `availableStyles`/`variants[].styles`, ya agregados por `data-service.ts`).
- Resolución de variante (`Product.tsx:131-141`): el `find()` que hoy hace
  `colorId === X && size === Y && (!selectedFit || fit === selectedFit)` pasa a validar además
  que la variante cumpla `selectedStyles` completo — todo atributo `VARIANT` con valores
  disponibles debe estar elegido y coincidir.
- Render: se reutiliza el patrón visual de `FitSelector` (`src/components/product/VariantSelector.tsx`)
  generalizado para iterar sobre todos los atributos `VARIANT` presentes, no solo "Corte";
  respeta `displayType` (botones/select) de cada atributo.
- Carrito (`CartContext.tsx`): `addItem` generaliza el parámetro `fit` a `styles`. La clave de
  deduplicación de líneas (`CartContext.tsx:112`, hoy `variantId + color.id + size`, sin `fit`)
  se corrige para incluir `JSON.stringify(styles)` — corrige de paso un bug latente donde dos
  líneas que solo difieren en `fit` se fusionaban incorrectamente.
- `CartItem` (`src/lib/types.ts`): campo `fit?: Fit` se generaliza a `styles?: Record<string, string>`.

## PDP corporativo — armador de sets (`SetDetailContent.tsx`)

Este es el "PDP corporativo" real: la pantalla que renderiza el detalle de un set
(`/corporativo/s/[slug]`) donde el usuario arma su pedido eligiendo, por cada pieza del set,
color y talla.

- Estado de selección por pieza: se agrega `styles?: Record<string, string>` junto a
  `size`/`color` existentes.
- Render: debajo del selector de talla de cada pieza, un bloque por cada atributo `VARIANT`
  aplicable al tipo de producto de esa pieza específica (una pieza "Camisa" no muestra nada si
  su único atributo asociado es `INFORMATIVE`; una pieza "Pantalón" con "Modelo de corte" en
  modo `VARIANT` sí muestra el selector). Respeta `displayType` igual que en retail.
- Obligatoriedad: si la pieza tiene algún atributo `VARIANT` con valores activos, debe elegirse
  un valor antes de poder confirmar/agregar esa pieza al pedido — mismo nivel de exigencia que
  talla hoy.
- Resolución de variante/disponibilidad: el lookup de estado de variante
  (`SetDetailContent.tsx`, hoy por `colorId+size`) se extiende a considerar también `styles`.
- Las reglas de restricción de color existentes (intersección de colores entre piezas,
  `:283-292`) no se tocan — el nuevo eje es ortogonal a esa lógica.

## Carrito y cotización corporativa

`CorporateCartLine.pieceSelections[]` (`CorporateCartContext.tsx:17-22`) se extiende:

```ts
pieceSelections: Array<{ productId: string; size?: string; color?: string; styles?: Record<string, string> }>;
```

Se extiende el patrón de texto ya existente (igual que `color` guarda `colors.code` como texto,
no FK) — no se migra a `variantId`. La identidad de línea
(`JSON.stringify(pieceSelections)`, `CorporateCartContext.tsx:69-71`) recoge el campo nuevo
automáticamente sin cambios adicionales.

Persistencia (`corporateCarts.items` JSONB) no requiere migración de esquema — es JSONB de
forma libre; se documenta la nueva forma en el comentario existente que describe el shape.

Puntos a propagar `styles` (identificados en la investigación de arquitectura):

- Zod schemas de `POST /api/corporate/cart` y `POST /api/corporate/quotes` — agregar `styles`
  opcional al schema de `pieceSelections`.
- `resolveAvailability()` y el chequeo `FOREIGN_PRODUCT` (`api/corporate/quotes/route.ts:93-175`)
  — el matching de variante/disponibilidad por pieza considera también `styles`.
- Constructor de descripción de línea (`api/corporate/quotes/route.ts:243-246`) — para que la
  cotización (pantalla y PDF) muestre el valor elegido, ej. "Wine · S · Petite".
- `pricingBreakdown.composition` en `quoteItems` (ya es JSON de auditoría) — incluye `styles`
  por pieza.
- `CorporateCartDrawer.tsx:139-141` — mostrar el valor elegido en el resumen del carrito.
- `src/app/(store)/corporativo/solicitud/page.tsx:64` — donde se lee/muestra la composición del
  pedido.

`quoteItems.variantId` (`corporate.ts:328`) permanece sin poblar por el flujo corporativo, igual
que hoy — no forma parte de este cambio.

## Filtros de catálogo público

Sin cambios. `FilterSidebar` y `filterProducts`/`data-service.ts` ya son genéricos sobre
`attributesPayload.styles` por slug (confirmado: no hardcodean "corte", soportan cualquier
atributo presente en `availableStyles`). Un atributo en modo `VARIANT` con múltiples valores
por variante aparecerá automáticamente como filtro adicional, sin trabajo extra — mismo
mecanismo que ya usa "Corte" hoy.

## Fuera de alcance

- No se migra `pieceSelections`/`quoteItems` a referenciar `variantId` real — se mantiene el
  patrón de texto existente, decisión explícita para minimizar riesgo/alcance de este cambio.
- No se agrega soporte de atributos `VARIANT` a un PDP de producto individual corporativo,
  porque esa pantalla no existe — el "PDP corporativo" del pedido es el armador de sets
  (`SetDetailContent.tsx`).
- No se toca la lógica de restricción/combos de color existente.
- No se agrega una constraint de unicidad `(productId, colorId, size, ...valoresVariant)` a
  nivel de base de datos — se mantiene, como hoy con color+talla, como responsabilidad del admin
  al curar la matriz generada (no hay tal constraint hoy tampoco para color+talla).

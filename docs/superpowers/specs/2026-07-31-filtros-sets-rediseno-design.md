# Diseño — Rediseño del sidebar de filtros de sets corporativos (home + /corporativo)

## Contexto

`SetFilterSidebar.tsx` es el único componente de filtros usado por `SetCatalogGrid`, que a su vez se renderiza tanto en `/corporativo` como embebido en la home (`/`) desde el cambio anterior de esta sesión. Cualquier rediseño de este componente aplica automáticamente a ambas rutas — no hay que tocar dos lugares.

Hoy el sidebar es una lista plana sin acordeones (`Género`, `Tipo de Producto`, `Marca`, `Color`, `Talla`, estilos EAV), sin iconos, con marca mostrada solo como texto, y sin ningún filtro de colección. El usuario pidió tres mejoras — iconos en Género, logos limpios en Marca, agregar Colección — más hacerlos colapsables, y que cada filtro sea single-select.

Skills de diseño aplicados: **frontend-design** (dirección visual, tipografía/estructura ya establecidas por el sistema de diseño de Allmedic — no se reinventa paleta ni tipografía, se ejecuta con precisión dentro de lo ya definido) y **design-motion-principles** en modo Create, ponderación **Primary Jakub Krehel · Secondary Emil Kowalski** (catálogo B2B de uso repetido diario — pulido sutil + velocidad en interacciones frecuentes como abrir/cerrar acordeones; Jhey no aplica, no hay lugar para "playful" en un catálogo médico B2B).

## Decisiones cerradas

1. **Estructura: acordeones colapsables.** Se reemplaza la lista plana por `Accordion` de Radix (`src/components/ui/accordion.tsx`, ya existe y ya tiene la animación `accordion-down`/`accordion-up` cableada en `tailwind.config.js` — no se crea infraestructura nueva). Cada grupo de filtro es un `AccordionItem`. Expandidos por defecto: **Género** y **Marca**. Colapsados por defecto: Colección, Tipo de Producto, Color, Talla, estilos EAV.
2. **Género con iconos:** `Venus` (Mujer) / `Mars` (Hombre) / `VenusAndMars` (Unisex) / `Users` (Todos), de `lucide-react` (ya es la librería de iconos del proyecto). Sigue siendo single-select (ya lo era).
3. **Marca con logos:**
   - Dato: `getActiveCorporateSets()` amplía su query para traer `logoUrl` de marca, mismo patrón ya usado en `getBrandsForNav()` (`src/lib/data-service.ts:457-469` — join `media_links` con `entityType: 'BRAND'`, `role: 'LOGO'`, contra `media_assets`).
   - `SetFilterOptions.brands` pasa de `string[]` a `{ id: string; name: string; logoUrl: string | null }[]`.
   - UI: grid de cards compactas (~64px alto) con logo, análogas a `BrandCarousel.tsx` (líneas 212-236) pero a menor escala. **Fallback a texto** (nombre de marca) si `logoUrl` es `null` o la imagen falla en `onError` — mismo patrón que `BrandCarousel`, nunca se oculta una marca por falta de asset.
   - **Pasa a single-select** (antes multi-select).
4. **Colección (filtro nuevo, no existía):**
   - Dato: el query de sets agrega un join adicional — piezas del set (`setBlockOptionsTable.productId`) → `products.collectionId` → `collections` (`id`, `name`) — agregado en memoria igual que ya se hace con colores/tallas/estilos de las piezas. Solo colecciones `isActive = true`.
   - `CorporateSetSummary` gana `collections: { id: string; name: string }[]`.
   - **Regla de matching:** el set aparece en los resultados si **cualquiera** de sus piezas pertenece a la colección filtrada (unión, no intersección) — mismo criterio que ya usan Color/Talla/Tipo de Producto hoy sobre las piezas del set. No hay lógica especial nueva de "todas las piezas deben coincidir".
   - UI: chips de texto (sin logo — los logos de colección solo existen en admin hoy, exponerlos en frontstore queda fuera de alcance). **Single-select.**
5. **Marca y Colección pasan a single-select.** Esto es un cambio de comportamiento respecto al `brands: string[]` actual (multi-select real, ya en uso). Confirmado explícitamente por el usuario: se acepta perder la posibilidad de combinar 2+ marcas a la vez a cambio de una UI más simple y consistente con Género/Color (que ya son single-select).
6. **Sin filtro de precio.** No se pidió, no se agrega.
7. **`/catalogo` (retail individual) no se toca.** Usa un componente de filtro completamente distinto (`HierarchicalFilter.tsx`), no compartido con `SetFilterSidebar`.

## Cambios de datos

### `src/lib/corporate-data-service.ts` — `getActiveCorporateSets()`

Dos ampliaciones a la query existente (sin crear una función nueva):

**a) Logo de marca.** Tras resolver `rows` (que ya trae `brandId`), traer los logos de las marcas presentes vía el mismo patrón que `getBrandsForNav()`:
```ts
const brandIds = Array.from(new Set(rows.map((r) => r.brandId).filter((id): id is string => !!id)));
const brandLogoLinks = brandIds.length > 0
  ? await db.select({ brandId: mediaLinksTable.entityId, storageKey: mediaAssetsTable.storageKey })
      .from(mediaLinksTable)
      .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
      .where(and(eq(mediaLinksTable.entityType, 'BRAND'), eq(mediaLinksTable.role, 'LOGO'), inArray(mediaLinksTable.entityId, brandIds)))
  : [];
const brandLogoMap = new Map(brandLogoLinks.map((l) => [l.brandId, resolveStorageUrl(l.storageKey)]));
```
(la función de resolución de URL exacta —`resolveStorageUrl` o equivalente— se confirma en implementación mirando cómo `getBrandsForNav` convierte `storageKey` a URL pública).

**b) Colección por pieza.** En el mismo bloque donde hoy se traen `productTypeName`/`gender` de las piezas (`setBlockOptionsTable` join `productsTable`), agregar `collectionId`/`collectionName` vía join adicional a `collections`:
```ts
.leftJoin(collectionsTable, eq(productsTable.collectionId, collectionsTable.id))
```
agregando `collectionId: collectionsTable.id, collectionName: collectionsTable.name, collectionIsActive: collectionsTable.isActive` al `select`. En la agregación por set (donde hoy se arma `productTypes`/`genders`/`pieceNames` a partir de `setItems`), agregar de forma análoga:
```ts
const collectionsMap = new Map<string, string>();
for (const i of setItems) {
  if (i.collectionId && i.collectionName && i.collectionIsActive) collectionsMap.set(i.collectionId, i.collectionName);
}
const setCollections = Array.from(collectionsMap, ([id, name]) => ({ id, name }));
```

### `src/lib/corporate-types.ts` — `CorporateSetSummary`

Agrega:
```ts
collections: { id: string; name: string }[];
brandLogoUrl: string | null;
```

### `src/lib/set-filter-logic.ts`

`SetFilterState`:
```ts
export interface SetFilterState {
  search: string;
  gender: Gender | null;
  productTypes: string[];
  brandId: string | null;        // antes: brands: string[]
  collectionId: string | null;   // nuevo
  colorId: string | null;
  sizes: string[];
  selectedStyles: Record<string, string[]>;
}
```
`EMPTY_SET_FILTERS` agrega `brandId: null, collectionId: null` (quita `brands: []`).

`matchesSetFilters`: el bloque de marca pasa de `.includes` sobre array a comparación directa de `set.brandId === filters.brandId`; se agrega bloque de colección:
```ts
if (filters.collectionId && !set.collections.some((c) => c.id === filters.collectionId)) {
  return false;
}
```

`countActiveSetFilters`: `filters.brands.length` → `(filters.brandId ? 1 : 0)`; suma `(filters.collectionId ? 1 : 0)`.

### `src/hooks/useSetFilter.ts` — `SetFilterOptions`

```ts
export interface SetFilterOptions {
  productTypes: string[];
  brands: { id: string; name: string; logoUrl: string | null }[];  // antes: string[]
  collections: { id: string; name: string }[];                     // nuevo
  colors: ProductColor[];
  sizes: string[];
  styleOptions: SetStyleFilterOption[];
}
```
Derivación: `brands` se arma con un `Map<string, {id,name,logoUrl}>` keyed por `brandId` (en vez de `Set<string>` de nombres) iterando `s.brandId`/`s.brandName`/`s.brandLogoUrl`. `collections` se arma agregando `s.collections` de cada set en un `Map` por `id`.

## Cambios de UI (`SetFilterSidebar.tsx`)

- Envolver todo el bloque de secciones en `<Accordion type="multiple" defaultValue={['gender', 'brand']}>`, un `<AccordionItem value="...">` por filtro, reemplazando cada `<div><h3>...</h3>...</div>` actual por `<AccordionItem><AccordionTrigger>Label</AccordionTrigger><AccordionContent>...</AccordionContent></AccordionItem>`.
- **Género:** `AccordionContent` con 4 botones en grid (icono `lucide-react` 16px + label), single-select vía `radio`-like (mismo mecanismo `onFilterChange({ gender })` que ya existe, solo cambia el markup visual).
- **Marca:** `AccordionContent` con grid de cards (logo `<img>` con `onError` → fallback texto, mismo patrón que `BrandCarousel.tsx:214-230`), click selecciona (`onFilterChange({ brandId: filters.brandId === brand.id ? null : brand.id })` — togglea si ya estaba seleccionada, igual criterio que hoy tiene `colorId`).
- **Colección:** `AccordionContent` con chips de texto, mismo patrón de toggle single-select que Marca.
- El resto de los filtros (Tipo de Producto, Color, Talla, estilos EAV) se envuelven en `AccordionItem` pero **mantienen su control interno actual** (checkboxes multi-select para Tipo de Producto/Talla/estilos, `ColorSwatch` para Color) — el usuario no pidió cambiar su tipo de selección, solo colapsarlos.
- `clearFilters()` se actualiza a los nuevos nombres de campo (`brandId: null, collectionId: null` en vez de `brands: []`).
- `hasActiveFilters` se actualiza igual.

## Motion (Create mode — Jakub primario, Emil secundario)

- **Acordeones:** usan la animación ya cableada de Radix (`accordion-down`/`accordion-up`, definida en `tailwind.config.js`) — no se escribe CSS nuevo de motion, se hereda la que ya existe en el design system. Duración ya fijada por esa keyframe (verificar en implementación que esté bajo 250ms; si no, ajustar solo la duración, no la curva).
- **Selección de marca/colección/género:** transición de estado activo (`border`, `bg`) en 150-200ms, `transition-colors`/`transition-all` — igual que el resto del catálogo, sin introducir una librería de motion nueva (Framer Motion no está en uso en este árbol de componentes, no se agrega solo para esto).
- **Frequency gate (Emil):** abrir/cerrar un acordeón de filtro es una interacción de uso diario y repetido — se prioriza velocidad sobre expresividad. No se añade bounce, spring ni easing elaborado; se respeta el default sutil de Radix.
- **Accesibilidad:** `Accordion` de Radix maneja `prefers-reduced-motion` de forma nativa a través de las animaciones CSS existentes del proyecto (si `tailwind.config.js` no tiene ya una media query de `prefers-reduced-motion` para `accordion-down/up`, se agrega en implementación — confirmar en Fase 0 de la implementación).

## Fuera de alcance

- Filtro de precio.
- Logos de colección en frontstore.
- Cambios en `/catalogo` (retail individual) o `HierarchicalFilter.tsx`.
- Cambios en el modelo de datos de `/admin` más allá de las nuevas columnas leídas (no se escriben, solo se leen).

## Verificación

- `npm run build`, `npm run lint`, typecheck, `npm run test`.
- Manual en `/` y `/corporativo`: acordeones abren/cierran con animación sutil; Género con iconos; Marca muestra logos (o fallback texto si falta asset) y es single-select; Colección aparece como filtro nuevo, single-select, un set con piezas de 2 colecciones aparece al filtrar por cualquiera de las dos; contador de filtros activos correcto; "Limpiar filtros" resetea todo incluyendo marca/colección; comportamiento idéntico en ambas rutas (mismo componente compartido).

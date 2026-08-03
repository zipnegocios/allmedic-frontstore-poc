# Filtros de /corporativo: facetado, tooltips y fixes — Spec

## Contexto

El usuario reportó 4 pedidos sobre el sidebar de filtros de `/corporativo`
(`SetFilterSidebar.tsx` + `useSetFilter.ts`):

1. Tooltips con el nombre en las imágenes de Colección (y, por consistencia, también Marca).
2. Los filtros deben reaccionar entre sí (facetado): seleccionar Marca=Barco debe reducir las
   opciones de Color/Colección/etc. a solo las presentes en sets de esa marca, y viceversa.
3. No se listan todos los colores en existencia asociados a algún set.
4. El filtro de Atributos/Estilos muestra el slug del atributo (ej. "corte-tops") en vez de su
   nombre legible (ej. "Modelo de Corte").

## Diagnóstico

**Punto 3 (colores faltantes) — causa raíz confirmada por lectura de código:**
`SetFilterSidebar.tsx` línea 255: `filterOptions.colors.slice(0, 20)` — corta la lista de
colores del filtro a los primeros 20 en orden de inserción (no alfabético), sin ningún control
de "ver más". Cualquier color más allá del corte 20 desaparece silenciosamente del filtro,
aunque esté correctamente asociado a un set activo. Confirmado NO relacionado con el estado
`AVAILABLE`/`BACKORDER` de las variantes (el usuario decidió mantener ese criterio como está).

**Punto 4 (labels de atributos) — causa raíz confirmada:**
`useSetFilter.ts` líneas 81-85 arma `styleOptions` con
`label: slug.charAt(0).toUpperCase() + slug.slice(1)` — siempre capitaliza el slug crudo, nunca
usa el nombre real del atributo. El comentario en la interfaz (línea 15-16) documenta esto como
limitación conocida: "no tenemos el `name` del atributo en el payload público, solo su slug
estable". La PDP (`getCorporateSetBySlug`) SÍ trae `attributesTable.name` y arma `styleLabels`
por pieza (`SetPiece.styleLabels`), pero `CorporateSetSummary` (usado por el listado/filtro)
nunca agregó el equivalente a nivel de set.

**Punto 2 (facetado) — no es un bug, es arquitectura no implementada:**
`useSetFilter.ts` líneas 59-94: `filterOptions` es un `useMemo` con dependencia `[sets]`
únicamente — se calcula una sola vez sobre TODOS los sets recibidos, nunca considera `filters`.
Por diseño actual, todas las categorías de filtro siempre muestran el catálogo completo de
opciones, sin importar qué esté seleccionado.

## Decisiones de diseño (confirmadas con el usuario)

- **Selecciones que dejan de tener match:** se mantienen seleccionadas aunque den 0 resultados
  — nunca se deseleccionan solas. Patrón estándar de e-commerce facetado.
- **Auto-exclusión por categoría:** al recalcular las opciones disponibles de una categoría
  (ej. Color), se aplican todos los filtros activos EXCEPTO el de esa misma categoría — así el
  usuario siempre puede cambiar de opción dentro de la categoría que ya tiene seleccionada.
- **Fix de colores:** se mantiene el límite visual de 20 por defecto (evita un sidebar
  gigante), pero se agrega un link "Ver todos (N)" que expande el resto — y la lista se ordena
  alfabéticamente (antes era orden de inserción, arbitrario).
- **Fix de labels EAV:** se trae `attributesTable.name` en `getActiveCorporateSets` (mismo
  patrón que ya usa la PDP) y se agrega `styleLabels: Record<string, string>` a
  `CorporateSetSummary`, a nivel de set (análogo al que ya existe por pieza).
- **Tooltips:** aplican a Marca Y Colección (mismo patrón visual — logo sin nombre visible).
  Se usa el componente `Tooltip` ya presente en `src/components/ui/tooltip.tsx` (wrapper de
  `@radix-ui/react-tooltip`, ya instalado y usado en el proyecto) — no se escribe CSS custom
  desde cero ni se agregan dependencias nuevas.

## Alcance técnico

### 1. Tooltips (Marca + Colección)

`SetFilterSidebar.tsx` — envolver cada card de logo (bloque Marca y bloque Colección) con
`<Tooltip><TooltipTrigger asChild>{card}</TooltipTrigger><TooltipContent>{name}</TooltipContent></Tooltip>`
del componente ya existente (`src/components/ui/tooltip.tsx`, wrapper de
`@radix-ui/react-tooltip`). Confirmado: no existe ningún `TooltipProvider` montado en el árbol
público del sitio (el único uso previo de `TooltipProvider` está en `ui/sidebar.tsx`, exclusivo
del admin) — se envuelve el contenido de `SetFilterSidebar` (el `sidebarContent` interno) en un
`TooltipProvider` local, autocontenido en el componente, sin tocar layouts compartidos.

### 2. Filtros facetados

Nueva función en `set-filter-logic.ts`:
```ts
export function matchesSetFiltersExcept(
  set: CorporateSetSummary,
  filters: SetFilterState,
  exclude: keyof SetFilterState
): boolean
```
Reutiliza la lógica de `matchesSetFilters` pero omite la condición correspondiente a `exclude`.
Refactor: `matchesSetFilters` pasa a ser `matchesSetFiltersExcept(set, filters, undefined)` (o
se extrae un core común parametrizado) para no duplicar las 7 condiciones.

En `useSetFilter.ts`, `filterOptions` pasa a depender de `[sets, filters]` y calcula, para cada
categoría, el subconjunto de `sets` que matchea todo excepto esa categoría, y agrega las
opciones solo de ese subconjunto:
- `productTypes` ← sets que matchean todo excepto `productTypes`
- `brands` ← sets que matchean todo excepto `brandId`
- `collections` ← sets que matchean todo excepto `collectionId`
- `colors` ← sets que matchean todo excepto `colorId`
- `sizes` ← sets que matchean todo excepto `sizes`
- `styleOptions` (por cada slug) ← sets que matchean todo excepto ese slug en `selectedStyles`
- Género no tiene una lista de "opciones disponibles" dinámica (son 4 valores fijos: Mujer/
  Hombre/Unisex/Todos) — no se toca, sigue siempre visible completo.

### 3. Fix colores faltantes

`SetFilterSidebar.tsx`:
- `filterOptions.colors` ya viene del hook — se ordena alfabéticamente por `name` dentro de
  `useSetFilter.ts` (mismo lugar donde ya se ordenan brands/collections).
- Nuevo estado local `isColorsExpanded` en `SetFilterSidebar`. Se muestran los primeros 20;
  si `filterOptions.colors.length > 20` y no está expandido, aparece un link "Ver todos (N)"
  (mismo estilo que "Limpiar todos los filtros": texto con underline, sin fondo).

### 4. Fix labels EAV

`corporate-data-service.ts`, dentro de `getActiveCorporateSets()`:
- Traer `attributesTable` (name, slug) — mismo patrón que `getCorporateSetBySlug` líneas
  ~711-712 (`allAttributes`, `attributeNameBySlug`).
- Al construir `stylesMap` (líneas 359 y siguientes, dentro del `rows.map`), construir en
  paralelo `styleLabels: Record<string, string>` usando `attributeNameBySlug.get(slug) ?? slug`.
- Agregar `styleLabels: Record<string, string>` a `CorporateSetSummary` (`corporate-types.ts`).

`useSetFilter.ts`:
- Al construir `styleOptions`, usar `set.styleLabels[slug]` en vez de capitalizar el slug —
  tomar el label del primer set que tenga ese slug con un name definido, fallback a slug
  capitalizado solo si ningún set lo provee (dato inconsistente/atributo eliminado).

## Fuera de alcance

- No se toca el criterio `status = 'AVAILABLE'` de la query de variantes (decisión explícita
  del usuario) — el fix de colores es puramente de presentación (orden + límite), no de datos.
- No se agregan filtros nuevos ni se cambia la UX general del sidebar (accordion, mobile
  drawer) — solo el comportamiento de recálculo de opciones y los 2 fixes puntuales.
- No se toca el buscador de texto (`search`) — el facetado aplica a los filtros de categoría
  (marca/color/colección/tipo/talla/estilo/género), no al texto libre.

## Componentes modificados

- `src/lib/set-filter-logic.ts` — nueva `matchesSetFiltersExcept`, refactor de
  `matchesSetFilters` sobre esa base.
- `src/hooks/useSetFilter.ts` — `filterOptions` recalculado por categoría sobre `[sets, filters]`;
  ordenamiento alfabético de colores; `styleOptions` usa `styleLabels` real.
- `src/lib/corporate-types.ts` — `CorporateSetSummary.styleLabels: Record<string, string>` nuevo.
- `src/lib/corporate-data-service.ts` — `getActiveCorporateSets()` trae `attributesTable` y
  puebla `styleLabels` por set.
- `src/components/catalog/SetFilterSidebar.tsx` — tooltips en Marca/Colección; estado
  "ver todos" en Color.

## Riesgos

- El recálculo de `filterOptions` pasa de 1 pasada sobre `sets` a hasta 7 pasadas (una por
  categoría) en cada cambio de filtro — con el volumen actual de sets (decenas/pocos cientos,
  todo client-side) es despreciable; no se agrega memoización granular adicional salvo que se
  observe degradación real.
- El fix de labels EAV depende de que `attributesTable.name` esté poblado correctamente en la
  base — si algún atributo tiene `name` vacío, cae al fallback de slug capitalizado (mismo
  comportamiento que hoy, no empeora nada).

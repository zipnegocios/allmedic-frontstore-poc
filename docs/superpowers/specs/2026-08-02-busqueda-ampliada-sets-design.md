# Búsqueda ampliada de sets corporativos — Spec

## Contexto

Hoy la búsqueda de sets (tanto el buscador interno de `/corporativo` como el dropdown del
Header) solo matchea por nombre del set, marca y nombre de las piezas (`pieceNames`). El
usuario pidió poder buscar también por: código/nombre de color, colección, tipo de producto y
valores de atributos EAV (ej. "Regular", "Slim"). Además, el Header debe seguir autocompletando
en vivo mientras se escribe (como hoy), pero ahora sobre todos esos campos — y cuando la
búsqueda no encuentra nada, debe sugerir la coincidencia más cercana por aproximación
("¿Usted quizás quiso decir: Cherokee?"), útil para errores de tipeo.

## Alcance

1. **Matching ampliado** — nuevo conjunto de campos buscables, compartido por el filtro interno
   de `/corporativo` y el autocompletado del Header.
2. **Header con autocompletado completo** — hoy el Header filtra sobre `CorporateSetNavItem`
   (tipo liviano: nombre/marca/portada/precio). Se amplía ese tipo con los campos necesarios
   para buscar (colores, colección, tipo de producto, atributos), sin llegar al peso de
   `CorporateSetSummary` (sin variantes, sin coversByColor, sin precios granulares).
3. **Fuente de datos separada para búsqueda vs. mega-menu** — `getLatestCorporateSets(8)`
   sigue liviana y acotada a los 8 sets más recientes (uso: mega-menu). Nueva función
   `getSearchableCorporateSets()` sin límite, con los campos ampliados, alimenta el buscador del
   Header — se ejecuta en el layout raíz de `(store)`, por lo que corre en cada página del sitio.
4. **Sugerencia por aproximación ("quizás quiso decir")** — cuando el texto buscado no matchea
   ningún set por substring exacto, se calcula la palabra más cercana (distancia de Levenshtein)
   entre la query y todas las palabras relevantes de TODOS los campos de búsqueda ampliados
   (nombre, marca, colección, tipo, color, atributos) de todos los sets. Si la distancia está
   dentro de un umbral razonable, se muestra la sugerencia. Aparece en el dropdown del Header y
   en la página `/corporativo` cuando el filtro no encuentra resultados. Clickear la sugerencia
   reemplaza la query y re-ejecuta la búsqueda.

## Fuera de alcance

- No se toca el algorithm de matching existente (substring `includes()`, case-insensitive) para
  los filtros con resultados — solo se enriquece el haystack.
- No se agregan dependencias nuevas (Levenshtein se implementa a mano, sin librería).
- El filtro lateral de colores (`SetFilterSidebar`) sigue usando `set.colors` (amplio) — sin
  cambios, no forma parte de este pedido.

## Diseño técnico

### 1. Campos de búsqueda ampliados

Función compartida `buildSearchHaystack(set)` en `src/lib/set-filter-logic.ts` (o archivo nuevo
si crece), consumida por:
- `matchesSetFilters()` (ya existe, se reemplaza el bloque de haystack manual).
- El filtro del Header (nuevo, sobre `CorporateSetNavItem` ampliado — incluye un subconjunto
  compatible de campos).

Campos incluidos: `name`, `brandName`, `pieceNames` (ya existentes) + `colors[].code`,
`colors[].name`, `collections[].name`, `productTypes[]`, `Object.values(availableStyles).flat()`.

### 2. Tipo `CorporateSetNavItem` ampliado

`src/lib/corporate-types.ts`:
```ts
export interface CorporateSetNavItem {
  id: string;
  slug: string;
  name: string;
  cover: MediaItem | null;
  brandName: string | null;
  referencePrice: number | null;
  // Nuevo — solo para matching de búsqueda, no se renderiza directamente:
  colors: { code: string; name: string }[];
  collections: string[];
  productTypes: string[];
  availableStyles: Record<string, string[]>;
}
```

### 3. `getSearchableCorporateSets()` — nueva función en `corporate-data-service.ts`

Mismo patrón de joins/agregación que `getActiveCorporateSets`, pero:
- Sin `.limit()` — trae todos los sets activos (`isActive = true`, `deletedAt IS NULL`).
- Solo selecciona los campos que `CorporateSetNavItem` ampliado necesita — evita imágenes por
  color, variantes completas, precios de venta/manual detallados por bloque más allá del
  `referencePrice` ya resuelto.
- Reutiliza la lógica de agregación de colores/colección/tipo/estilos ya existente en
  `getActiveCorporateSets` (misma fuente: `variants` con `status = 'AVAILABLE'`).

`getLatestCorporateSets(limit=8)` no se modifica — sigue sirviendo al mega-menu tal cual.

### 4. Layout raíz — `src/app/(store)/layout.tsx`

Reemplaza la llamada a `getLatestCorporateSets()` que alimenta el Header por
`getSearchableCorporateSets()`. Confirmado: ese resultado (`corporateSets`) solo se pasa a
`AppShell` → `Header` — `MegaMenu.tsx` no lo consume (recibe sus propios datos por otra vía), así
que el cambio no afecta al mega-menu.

### 5. Header — autocompletado en vivo

`Header.tsx`, bloque de búsqueda debounced (línea ~132-161):
- El filtro `corporateSets.filter(s => ...)` pasa a usar `buildSearchHaystack` sobre los campos
  ampliados de `CorporateSetNavItem`.
- Sin cambios en UX del dropdown (debounce 200ms, mínimo 2 caracteres, máximo 6 resultados,
  botón "Ver todos los resultados" al final).
- Cuando `searchResults.length === 0` y `searchQuery.length >= 2`: calcular sugerencia fuzzy
  (ver punto 6) y renderizarla en vez del actual "No encontramos resultados para...".

### 6. Sugerencia fuzzy — "¿Usted quizás quiso decir: X?"

Nuevo archivo `src/lib/fuzzy-match.ts`:
```ts
export function levenshteinDistance(a: string, b: string): number { ... }

export function suggestClosestMatch(
  query: string,
  candidates: string[],
  maxDistance = 2
): string | null {
  // normaliza (lowercase, sin acentos), calcula distancia contra cada candidato,
  // devuelve el de menor distancia si está dentro del umbral, null si no hay ninguno cerca.
}
```

- `candidates` se arma a partir de todas las palabras "buscables" (nombre completo del set +
  cada palabra individual de marca/colección/tipo/color/atributos) de todos los sets — para que
  "cheroquee" matchee contra la palabra "Cherokee" aunque sea parte de un nombre más largo.
- Umbral: distancia ≤ 2 para palabras de 4+ caracteres; distancia ≤ 1 para palabras más cortas
  (evita sugerencias absurdas en campos cortos como códigos de color de 3 letras).
- Se consume desde:
  - `Header.tsx` — dropdown, cuando `searchResults.length === 0`.
  - `SetCatalogGrid.tsx` — bloque de "No hay sets corporativos disponibles con estos filtros",
    solo cuando el filtro activo incluye texto de búsqueda (no aplica si el vacío es por
    combinación de filtros de sidebar sin texto).
- Click en la sugerencia: reemplaza el input de búsqueda con la palabra sugerida y dispara el
  mismo flujo de búsqueda (debounce en Header; `applyFilters({ search })` en
  `SetCatalogGrid`).

### Componentes modificados

- `src/lib/set-filter-logic.ts` — haystack ampliado (`matchesSetFilters`).
- `src/lib/fuzzy-match.ts` — nuevo, Levenshtein + sugerencia.
- `src/lib/corporate-types.ts` — `CorporateSetNavItem` ampliado.
- `src/lib/corporate-data-service.ts` — nueva `getSearchableCorporateSets()`.
- `src/app/(store)/layout.tsx` — usa la nueva función para alimentar el Header.
- `src/components/layout/Header.tsx` — matching ampliado + sugerencia fuzzy en el dropdown.
- `src/components/catalog/SetCatalogGrid.tsx` — sugerencia fuzzy en el estado vacío.

## Riesgos

- Payload sitewide del Header aumenta (de 8 sets livianos a todos los sets activos con más
  campos) — aceptado explícitamente por el usuario como consecuencia de tener autocompletado
  completo en vivo.
- El umbral de distancia de Levenshtein es una heurística — puede necesitar ajuste fino tras
  probar con nombres reales del catálogo (marcas, colecciones) para evitar falsos positivos o
  negativos.

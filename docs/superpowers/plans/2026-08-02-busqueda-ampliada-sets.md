# Búsqueda ampliada de sets corporativos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar la búsqueda de sets corporativos (Header + `/corporativo`) para matchear por
color (code+nombre), colección, tipo de producto y valores de atributos EAV, con autocompletado
en vivo en el Header sobre todo el catálogo y sugerencia "¿quizás quiso decir...?" cuando no hay
resultados.

**Architecture:** Se reutiliza `getActiveCorporateSets()` (ya trae todos los campos necesarios)
para alimentar una nueva función liviana `getSearchableCorporateSets()` que mapea al tipo
`CorporateSetNavItem` ampliado — sin duplicar queries SQL. El matching de texto se centraliza en
una función compartida (`buildSearchHaystack`) consumida tanto por `matchesSetFilters` (filtro
interno de `/corporativo`) como por el Header. La sugerencia fuzzy usa una función pura de
distancia de Levenshtein sin dependencias externas.

**Tech Stack:** Next.js App Router, Drizzle ORM, TypeScript, Vitest.

## Global Constraints

- No agregar dependencias npm nuevas — Levenshtein se implementa a mano.
- No modificar el algoritmo de matching existente (substring `includes()`, case-insensitive) —
  solo ampliar qué campos entran al haystack.
- No tocar el filtro lateral de colores (`SetFilterSidebar`) — sigue usando `set.colors` (amplio).
- `getLatestCorporateSets(8)` no se modifica — sigue sirviendo al mega-menu tal cual.
- Suggested commit format: `git commit -m "ACTIVITY: <resumen>"` (no Conventional Commits).
- Nunca ejecutar `git commit`/`git push` — solo sugerir el mensaje al final.

---

### Task 1: Haystack de búsqueda compartido + ampliación de `matchesSetFilters`

**Files:**
- Modify: `src/lib/set-filter-logic.ts`
- Test: `src/lib/__tests__/set-filter-logic.test.ts`

**Interfaces:**
- Produces: `buildSetSearchWords(set: CorporateSetSummary): string[]` — exportada, devuelve
  todas las palabras/frases buscables de un set (nombre, marca, piezas, colores, colecciones,
  tipos, valores de atributos). Consumida por Task 4 (fuzzy en `SetCatalogGrid`).

- [ ] **Step 1: Escribir los tests que fallan para el haystack ampliado**

Agregar al final de `src/lib/__tests__/set-filter-logic.test.ts` (después del último `describe`
existente, reusando `makeSet` ya definido en el archivo):

```ts
describe('matchesSetFilters — búsqueda ampliada', () => {
  const set = makeSet({
    colors: [
      { id: 'c-wine', name: 'Wine', code: 'WNE', hex: '#7B1E3A', kind: 'SOLID', swatchUrl: null },
      { id: 'c-hunter', name: 'Hunter', code: 'HNT', hex: '#2F4F2F', kind: 'SOLID', swatchUrl: null },
    ],
    collections: [{ id: 'col-1', name: 'Temporada Clínica' }],
    productTypes: ['Camisas', 'Pantalones'],
    availableStyles: { corte: ['Slim', 'Regular'] },
  });

  it('matchea por código de color', () => {
    expect(matchesSetFilters(set, { ...EMPTY_SET_FILTERS, search: 'WNE' })).toBe(true);
  });

  it('matchea por nombre de color (case-insensitive)', () => {
    expect(matchesSetFilters(set, { ...EMPTY_SET_FILTERS, search: 'hunter' })).toBe(true);
  });

  it('matchea por nombre de colección', () => {
    expect(matchesSetFilters(set, { ...EMPTY_SET_FILTERS, search: 'Temporada Clínica' })).toBe(true);
  });

  it('matchea por tipo de producto', () => {
    expect(matchesSetFilters(set, { ...EMPTY_SET_FILTERS, search: 'Pantalones' })).toBe(true);
  });

  it('matchea por valor de atributo EAV', () => {
    expect(matchesSetFilters(set, { ...EMPTY_SET_FILTERS, search: 'Slim' })).toBe(true);
  });

  it('no matchea texto ausente en ningún campo', () => {
    expect(matchesSetFilters(set, { ...EMPTY_SET_FILTERS, search: 'Turquesa' })).toBe(false);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/__tests__/set-filter-logic.test.ts`
Expected: FAIL en los 5 casos nuevos de "búsqueda ampliada" (código de color, nombre de color,
colección, tipo de producto, atributo) — el `haystack` actual no incluye esos campos.

- [ ] **Step 3: Implementar `buildSetSearchWords` y usarla en `matchesSetFilters`**

En `src/lib/set-filter-logic.ts`, agregar la función exportada antes de `matchesSetFilters` y
reemplazar el bloque de búsqueda existente (líneas 60-66 actuales):

```ts
/** Todas las palabras/frases buscables de un set — nombre, marca, piezas, color (code+nombre),
 * colección, tipo de producto y valores de atributos EAV. Fuente única para el matching de
 * texto (`matchesSetFilters`) y para el pool de sugerencias por aproximación
 * (`suggestClosestMatch` en `SetCatalogGrid`). */
export function buildSetSearchWords(set: CorporateSetSummary): string[] {
  return [
    set.name,
    set.brandName ?? '',
    ...set.pieceNames,
    ...set.colors.map((c) => c.code),
    ...set.colors.map((c) => c.name),
    ...set.collections.map((c) => c.name),
    ...set.productTypes,
    ...Object.values(set.availableStyles).flat(),
  ].filter((w) => w.trim().length > 0);
}
```

Reemplazar dentro de `matchesSetFilters`:

```ts
  const query = filters.search.trim().toLowerCase();
  if (query) {
    const haystack = [set.name, set.brandName ?? '', ...set.pieceNames]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }
```

por:

```ts
  const query = filters.search.trim().toLowerCase();
  if (query) {
    const haystack = buildSetSearchWords(set).join(' ').toLowerCase();
    if (!haystack.includes(query)) return false;
  }
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/__tests__/set-filter-logic.test.ts`
Expected: PASS — todos los tests, incluyendo los 48 preexistentes y los 6 nuevos.

- [ ] **Step 5: Typecheck y lint**

Run: `npx tsc --noEmit` y `npx eslint src/lib/set-filter-logic.ts src/lib/__tests__/set-filter-logic.test.ts`
Expected: sin errores nuevos (los 2 preexistentes no relacionados — `schema.test.ts` y
`docs.test.ts` COLOR_PAIRING — pueden seguir apareciendo).

- [ ] **Step 6: Commit**

```bash
git add src/lib/set-filter-logic.ts src/lib/__tests__/set-filter-logic.test.ts
git commit -m "ACTIVITY: ampliar busqueda de sets para matchear color, coleccion, tipo de producto y atributos EAV"
```

---

### Task 2: Utilidad de fuzzy matching (Levenshtein)

**Files:**
- Create: `src/lib/fuzzy-match.ts`
- Test: `src/lib/__tests__/fuzzy-match.test.ts`

**Interfaces:**
- Produces:
  - `levenshteinDistance(a: string, b: string): number`
  - `suggestClosestMatch(query: string, candidates: string[], maxDistance?: number): string | null`
  - Ambas exportadas, sin dependencias de DB/React — consumidas por Task 3 (Header) y Task 4
    (`SetCatalogGrid`).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/__tests__/fuzzy-match.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { levenshteinDistance, suggestClosestMatch } from '../fuzzy-match';

describe('levenshteinDistance', () => {
  it('devuelve 0 para strings idénticos', () => {
    expect(levenshteinDistance('cherokee', 'cherokee')).toBe(0);
  });

  it('cuenta la distancia de edición correcta', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });

  it('es simétrica', () => {
    expect(levenshteinDistance('cheroquee', 'cherokee')).toBe(levenshteinDistance('cherokee', 'cheroquee'));
  });
});

describe('suggestClosestMatch', () => {
  const candidates = ['Cherokee', 'Wine', 'Hunter', 'Landau', 'Temporada Clínica Verano'];

  it('sugiere la palabra más cercana dentro del umbral (typo de marca)', () => {
    expect(suggestClosestMatch('cheroquee', candidates)).toBe('Cherokee');
  });

  it('no sugiere nada si no hay ningún candidato razonablemente cercano', () => {
    expect(suggestClosestMatch('xilofonzzz', candidates)).toBeNull();
  });

  it('no sugiere nada si la query ya matchea exacto (case-insensitive)', () => {
    expect(suggestClosestMatch('wine', candidates)).toBeNull();
  });

  it('usa un umbral más estricto para palabras cortas (evita falsos positivos en códigos de color)', () => {
    // "WNE" (3 letras) vs "WNT" (3 letras) — distancia 1, pero palabras de 3 letras
    // deben requerir distancia <= 1 estricta, no relativa. Con umbral por longitud,
    // "abc" contra ["xyz"] (distancia 3) no debe sugerir nada.
    expect(suggestClosestMatch('abc', ['xyz'])).toBeNull();
  });

  it('matchea contra una palabra dentro de una frase más larga', () => {
    expect(suggestClosestMatch('climatica', candidates)).toBeNull(); // muy lejos de "Clínica", no debe forzar
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/__tests__/fuzzy-match.test.ts`
Expected: FAIL con "Cannot find module '../fuzzy-match'" (el archivo no existe todavía).

- [ ] **Step 3: Implementar `src/lib/fuzzy-match.ts`**

```ts
/** Distancia de edición (Levenshtein) entre dos strings — número mínimo de
 * inserciones/eliminaciones/sustituciones para transformar `a` en `b`. */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);
  let currRow = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // eliminación
        currRow[j - 1] + 1, // inserción
        prevRow[j - 1] + cost // sustitución
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }
  return prevRow[n];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // quita acentos
}

/** Umbral de distancia aceptable según longitud de la query — evita sugerencias absurdas en
 * palabras cortas (ej. códigos de color de 3 letras) mientras tolera 2 ediciones en palabras
 * largas (typos reales como "cheroquee" → "cherokee"). */
function maxDistanceFor(length: number): number {
  if (length <= 3) return 1;
  if (length <= 7) return 1;
  return 2;
}

/** Busca, entre `candidates`, la palabra más cercana a `query` por distancia de Levenshtein.
 * Devuelve `null` si `query` ya matchea exacto (substring) contra algún candidato, o si el
 * candidato más cercano supera el umbral. Usado para sugerencias "¿quizás quiso decir...?". */
export function suggestClosestMatch(
  query: string,
  candidates: string[],
  maxDistance?: number
): string | null {
  const normQuery = normalize(query.trim());
  if (!normQuery) return null;

  const uniqueCandidates = Array.from(new Set(candidates.map((c) => c.trim()).filter(Boolean)));

  // Si ya hay un match exacto por substring, no hace falta sugerir nada.
  if (uniqueCandidates.some((c) => normalize(c).includes(normQuery))) return null;

  let best: { candidate: string; distance: number } | null = null;
  for (const candidate of uniqueCandidates) {
    const distance = levenshteinDistance(normQuery, normalize(candidate));
    if (best === null || distance < best.distance) {
      best = { candidate, distance };
    }
  }
  if (!best) return null;

  const threshold = maxDistance ?? maxDistanceFor(normQuery.length);
  return best.distance <= threshold ? best.candidate : null;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/__tests__/fuzzy-match.test.ts`
Expected: PASS — los 8 casos.

- [ ] **Step 5: Typecheck y lint**

Run: `npx tsc --noEmit` y `npx eslint src/lib/fuzzy-match.ts src/lib/__tests__/fuzzy-match.test.ts`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fuzzy-match.ts src/lib/__tests__/fuzzy-match.test.ts
git commit -m "ACTIVITY: agregar utilidad de fuzzy matching (Levenshtein) para sugerencias de busqueda"
```

---

### Task 3: `CorporateSetNavItem` ampliado + `getSearchableCorporateSets()`

**Files:**
- Modify: `src/lib/corporate-types.ts`
- Modify: `src/lib/corporate-data-service.ts`

**Interfaces:**
- Consumes: `getActiveCorporateSets()` (ya existe, sin cambios de firma) — ver
  `src/lib/corporate-data-service.ts:158`.
- Produces: `getSearchableCorporateSets(): Promise<CorporateSetNavItem[]>` — exportada desde
  `corporate-data-service.ts`. Consumida por Task 5 (layout raíz).

- [ ] **Step 1: Ampliar `CorporateSetNavItem` en `corporate-types.ts`**

Ubicar la interfaz actual (líneas 98-105 de `src/lib/corporate-types.ts`):

```ts
/** Item liviano de set para navegación (mega-menu) — solo lo necesario para una card
 * chica: sin colores/tallas/estilos/variantes agregados (eso es exclusivo de `/corporativo`). */
export interface CorporateSetNavItem {
  id: string;
  slug: string;
  name: string;
  cover: MediaItem | null;
  brandName: string | null;
  referencePrice: number | null;
}
```

Reemplazar por:

```ts
/** Item liviano de set para navegación (mega-menu, uso con `getLatestCorporateSets`) y para el
 * autocompletado del Header (uso con `getSearchableCorporateSets`) — este segundo caso agrega
 * los campos mínimos necesarios para buscar por color/colección/tipo/atributo sin llegar al
 * peso de `CorporateSetSummary` (sin variantes, sin coversByColor, sin precios por bloque). */
export interface CorporateSetNavItem {
  id: string;
  slug: string;
  name: string;
  cover: MediaItem | null;
  brandName: string | null;
  referencePrice: number | null;
  /** Vacío cuando el item viene de `getLatestCorporateSets` (mega-menu, no necesita buscar). */
  colors: { code: string; name: string }[];
  collections: string[];
  productTypes: string[];
  availableStyles: Record<string, string[]>;
}
```

- [ ] **Step 2: Actualizar `getLatestCorporateSets` para satisfacer el tipo ampliado**

En `src/lib/corporate-data-service.ts`, dentro del `return rows.map((set) => {...})` de
`getLatestCorporateSets` (alrededor de la línea 520-528), agregar los campos vacíos (ese uso —
mega-menu — no necesita buscar, así que no vale la pena traer más joins ahí):

```ts
    return {
      id: set.id,
      slug: set.slug,
      name: set.name,
      cover: colorCoverMediaLatest.get(set.id)?.[0]?.cover ?? null,
      brandName: set.brandName,
      referencePrice,
      colors: [],
      collections: [],
      productTypes: [],
      availableStyles: {},
    };
```

- [ ] **Step 3: Implementar `getSearchableCorporateSets()` reutilizando `getActiveCorporateSets`**

Agregar en `src/lib/corporate-data-service.ts`, inmediatamente después del cierre de
`getActiveCorporateSets` (después de la línea `}` que cierra esa función, antes del comentario
`// ── Últimos sets creados...`):

```ts
// ── Sets para el autocompletado del Header (sin límite, campos mínimos para buscar) ──
// Reusa `getActiveCorporateSets` (ya trae colores/colecciones/tipos/estilos agregados por set)
// en vez de duplicar sus ~10 queries — solo remapea al tipo liviano `CorporateSetNavItem`.
// Se ejecuta en el layout raíz de `(store)`, en cada página del sitio.
export async function getSearchableCorporateSets(): Promise<CorporateSetNavItem[]> {
  const sets = await getActiveCorporateSets();
  return sets.map((set) => ({
    id: set.id,
    slug: set.slug,
    name: set.name,
    cover: set.cover,
    brandName: set.brandName,
    referencePrice: set.referencePrice,
    colors: set.colors.map((c) => ({ code: c.code, name: c.name })),
    collections: set.collections.map((c) => c.name),
    productTypes: set.productTypes,
    availableStyles: set.availableStyles,
  }));
}
```

- [ ] **Step 4: Typecheck y lint**

Run: `npx tsc --noEmit` y `npx eslint src/lib/corporate-types.ts src/lib/corporate-data-service.ts`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/corporate-types.ts src/lib/corporate-data-service.ts
git commit -m "ACTIVITY: agregar getSearchableCorporateSets y ampliar CorporateSetNavItem con campos buscables"
```

---

### Task 4: Header — matching ampliado + sugerencia fuzzy en el dropdown

**Files:**
- Modify: `src/app/(store)/layout.tsx`
- Modify: `src/components/layout/Header.tsx`

**Interfaces:**
- Consumes: `getSearchableCorporateSets()` (Task 3), `buildSetSearchWords` no aplica aquí
  directamente (opera sobre `CorporateSetSummary`, no `CorporateSetNavItem`) — el Header arma su
  propio haystack ampliado sobre los campos ya presentes en `CorporateSetNavItem`.
  `suggestClosestMatch` (Task 2).

- [ ] **Step 1: Cambiar la fuente de datos en el layout raíz**

En `src/app/(store)/layout.tsx`, reemplazar el import y la llamada:

```ts
import { getAllBusinessRules, getLatestCorporateSets } from '@/lib/corporate-data-service';
```

por:

```ts
import { getAllBusinessRules, getSearchableCorporateSets } from '@/lib/corporate-data-service';
```

y:

```ts
    getLatestCorporateSets(),
```

por:

```ts
    getSearchableCorporateSets(),
```

(la variable desestructurada sigue llamándose `corporateSets` — no hace falta renombrar nada
más en ese archivo).

- [ ] **Step 2: Ampliar el filtro de búsqueda del Header**

En `src/components/layout/Header.tsx`, ubicar el efecto de búsqueda debounced (líneas 132-161
actuales) y reemplazar el bloque de filtrado:

```ts
        let results: CorporateSetNavItem[];
        if (corporateSets) {
          const q = searchQuery.toLowerCase();
          results = corporateSets.filter(s =>
            s.name.toLowerCase().includes(q) ||
            (s.brandName?.toLowerCase().includes(q) ?? false)
          );
        } else {
          results = [];
        }
        setSearchResults(results.slice(0, 6));
```

por:

```ts
        let results: CorporateSetNavItem[];
        if (corporateSets) {
          const q = searchQuery.toLowerCase();
          results = corporateSets.filter(s => {
            const haystack = [
              s.name,
              s.brandName ?? '',
              ...s.colors.map((c) => c.code),
              ...s.colors.map((c) => c.name),
              ...s.collections,
              ...s.productTypes,
              ...Object.values(s.availableStyles).flat(),
            ]
              .join(' ')
              .toLowerCase();
            return haystack.includes(q);
          });
        } else {
          results = [];
        }
        setSearchResults(results.slice(0, 6));
```

- [ ] **Step 3: Calcular la sugerencia fuzzy cuando no hay resultados**

En el mismo efecto debounced, después de `setSearchResults(results.slice(0, 6));`, agregar el
cálculo de sugerencia. Primero, agregar el import al inicio del archivo:

```ts
import { suggestClosestMatch } from '@/lib/fuzzy-match';
```

Agregar el nuevo estado junto a `searchResults` (línea 112 actual):

```ts
  const [searchResults, setSearchResults] = useState<CorporateSetNavItem[]>([]);
  const [searchSuggestion, setSearchSuggestion] = useState<string | null>(null);
```

Dentro del efecto debounced, reemplazar:

```ts
        setSearchResults(results.slice(0, 6));
      }, 200);
    } else {
      setSearchResults([]);
    }
```

por:

```ts
        setSearchResults(results.slice(0, 6));
        if (results.length === 0 && corporateSets) {
          const allWords = corporateSets.flatMap((s) => [
            s.name,
            s.brandName ?? '',
            ...s.colors.map((c) => c.code),
            ...s.colors.map((c) => c.name),
            ...s.collections,
            ...s.productTypes,
            ...Object.values(s.availableStyles).flat(),
          ]);
          setSearchSuggestion(suggestClosestMatch(searchQuery, allWords));
        } else {
          setSearchSuggestion(null);
        }
      }, 200);
    } else {
      setSearchResults([]);
      setSearchSuggestion(null);
    }
```

- [ ] **Step 4: Renderizar la sugerencia en el dropdown**

Ubicar el bloque de "sin resultados" (líneas 492-495 actuales):

```tsx
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No encontramos resultados para "{searchQuery}"</p>
                  </div>
                )
```

Reemplazar por:

```tsx
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No encontramos resultados para &quot;{searchQuery}&quot;</p>
                    {searchSuggestion && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery(searchSuggestion)}
                        className="mt-2 text-sm text-[#111111] font-medium hover:underline"
                      >
                        ¿Usted quizás quiso decir: <span className="underline">{searchSuggestion}</span>?
                      </button>
                    )}
                  </div>
                )
```

- [ ] **Step 5: Typecheck y lint**

Run: `npx tsc --noEmit` y `npx eslint src/components/layout/Header.tsx src/app/(store)/layout.tsx`
Expected: sin errores nuevos.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build exitoso, todas las rutas compilan (en particular las que usan `AppShell`/`Header`).

- [ ] **Step 7: Commit**

```bash
git add src/app/(store)/layout.tsx src/components/layout/Header.tsx
git commit -m "ACTIVITY: ampliar autocompletado del Header con color/coleccion/tipo/atributos y sugerencia por aproximacion"
```

---

### Task 5: Sugerencia fuzzy en el estado vacío de `/corporativo`

**Files:**
- Modify: `src/components/catalog/SetCatalogGrid.tsx`

**Interfaces:**
- Consumes: `buildSetSearchWords` (Task 1, sobre `CorporateSetSummary`), `suggestClosestMatch`
  (Task 2).

- [ ] **Step 1: Calcular la sugerencia cuando el filtro no encuentra nada por texto**

En `src/components/catalog/SetCatalogGrid.tsx`, agregar los imports:

```ts
import { useMemo } from 'react';
```

(si `useState` ya está importado desde `react` en la línea 3 actual, extender el import
existente: `import { useState, useMemo } from 'react';`)

```ts
import { suggestClosestMatch } from '@/lib/fuzzy-match';
import { buildSetSearchWords } from '@/lib/set-filter-logic';
```

Dentro del componente `SetCatalogGrid`, después de la desestructuración de `useSetFilter`
(después del bloque `const { filters, ... } = useSetFilter(...)` actual, antes del `return`),
agregar:

```ts
  const searchSuggestion = useMemo(() => {
    if (paginatedSets.length > 0 || totalSets > 0) return null;
    const query = filters.search.trim();
    if (!query) return null;
    const allWords = sets.flatMap(buildSetSearchWords);
    return suggestClosestMatch(query, allWords);
  }, [paginatedSets.length, totalSets, filters.search, sets]);
```

- [ ] **Step 2: Renderizar la sugerencia en el estado vacío**

Ubicar el bloque vacío actual (líneas 154-167 aproximadas):

```tsx
          {paginatedSets.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              No hay sets corporativos disponibles con estos filtros.
              {hasActiveFilters && (
                <div className="mt-4">
                  <button
                    onClick={resetFilters}
                    className="px-6 py-2 bg-[#111111] text-white text-sm font-medium rounded-full hover:opacity-80 transition-opacity"
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          ) : (
```

Reemplazar por:

```tsx
          {paginatedSets.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              No hay sets corporativos disponibles con estos filtros.
              {searchSuggestion && (
                <p className="mt-2">
                  <button
                    type="button"
                    onClick={() => applyFilters({ search: searchSuggestion })}
                    className="text-[#111111] font-medium hover:underline"
                  >
                    ¿Usted quizás quiso decir: <span className="underline">{searchSuggestion}</span>?
                  </button>
                </p>
              )}
              {hasActiveFilters && (
                <div className="mt-4">
                  <button
                    onClick={resetFilters}
                    className="px-6 py-2 bg-[#111111] text-white text-sm font-medium rounded-full hover:opacity-80 transition-opacity"
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          ) : (
```

- [ ] **Step 3: Typecheck y lint**

Run: `npx tsc --noEmit` y `npx eslint src/components/catalog/SetCatalogGrid.tsx`
Expected: sin errores nuevos.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 5: Commit**

```bash
git add src/components/catalog/SetCatalogGrid.tsx
git commit -m "ACTIVITY: agregar sugerencia por aproximacion al estado vacio del listado /corporativo"
```

---

### Task 6: Verificación final end-to-end

**Files:** ninguno (solo validación).

- [ ] **Step 1: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: mismos 2 errores preexistentes no relacionados (schema.test.ts, docs.test.ts) — cero
errores nuevos.

- [ ] **Step 2: Lint completo del proyecto**

Run: `npx eslint src`
Expected: sin errores nuevos respecto al estado antes de este plan.

- [ ] **Step 3: Suite de tests completa**

Run: `npx vitest run`
Expected: todos los tests pasan, incluyendo los nuevos de Task 1 y Task 2.

- [ ] **Step 4: Build de producción**

Run: `npm run build`
Expected: build exitoso, todas las rutas compilan.

- [ ] **Step 5: Reportar en el chat**

Seguir el formato obligatorio de CLAUDE.md: Resumen Ejecutivo, Verificación Manual en
Producción (checklist probando: buscar "WNE" en Header y en `/corporativo`, buscar "cheroquee"
y verificar la sugerencia "Cherokee", buscar por nombre de colección/tipo/atributo), Migraciones
Ejecutadas (N/A), Builds y Validaciones, y el commit sugerido consolidado de todas las tasks.

## Self-Review Notes

- **Cobertura de spec:** los 6 puntos de la spec (matching ampliado, Header con autocompletado
  completo, fuente de datos separada, sugerencia fuzzy en Header, sugerencia fuzzy en
  `/corporativo`, click-to-apply en ambos) están cubiertos por las Tasks 1-5.
- **Sin placeholders:** todos los steps incluyen código completo, no descripciones.
- **Consistencia de tipos:** `CorporateSetNavItem.colors` es `{code, name}[]` en todas partes
  (Task 3 lo define, Task 4 lo consume igual). `buildSetSearchWords` devuelve `string[]` en
  todas partes (Task 1 lo define, Task 5 lo consume igual).
- **MegaMenu:** confirmado en la spec que no consume el prop `corporateSets` del layout raíz —
  el cambio de Task 4 Step 1 no lo afecta.

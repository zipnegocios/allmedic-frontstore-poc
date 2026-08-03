# Filtros de /corporativo: facetado, tooltips y fixes — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los filtros de `/corporativo` (marca, colección, color, tipo, talla, atributos EAV)
reaccionan entre sí (facetado), muestran tooltips con nombre en las cards de logo (marca y
colección), listan todos los colores disponibles (no solo los primeros 20) y muestran el nombre
real de cada atributo de estilo en vez de su slug.

**Architecture:** La lógica de facetado se extrae como función pura `computeSetFilterOptions(sets, filters)`
en `set-filter-logic.ts` (testeable sin renderizar React — el proyecto no tiene
`@testing-library/react`/jsdom instalado y esta spec no agrega dependencias nuevas). El hook
`useSetFilter.ts` solo la invoca dentro de su `useMemo`, ahora dependiente de `[sets, filters]`
en vez de `[sets]`. Cada categoría se recalcula excluyendo su propio filtro (patrón facetado
estándar) usando una nueva `matchesSetFiltersExcept`. El label real de atributos EAV se resuelve
en el servidor (`getActiveCorporateSets`, mismo patrón ya usado en la PDP) y se propaga como
campo nuevo `styleLabels` en `CorporateSetSummary`. Los tooltips reusan el componente `Tooltip`
ya instalado (`@radix-ui/react-tooltip`, sin dependencias nuevas).

**Tech Stack:** Next.js App Router, Drizzle ORM, TypeScript, React, Vitest.

## Global Constraints

- No se toca el criterio `status = 'AVAILABLE'` de la query de variantes (decisión explícita del
  usuario) — el fix de colores es de presentación (orden + límite expandible), no de datos.
- Selecciones de filtro ya activas nunca se autodeseleccionan, aunque terminen dando 0 resultados.
- Cada categoría de filtro se recalcula excluyendo su propio filtro activo (el usuario siempre
  puede cambiar de opción dentro de la misma categoría).
- No se agregan dependencias npm nuevas — `Tooltip` ya existe en `src/components/ui/tooltip.tsx`;
  el proyecto no tiene `@testing-library/react`, así que la lógica de facetado se testea como
  función pura, no vía `renderHook`.
- Suggested commit format: `git commit -m "ACTIVITY: <resumen>"`.
- Nunca ejecutar `git commit`/`git push` — solo sugerir el mensaje al final.

---

### Task 1: Labels reales de atributos EAV (fix "corte-tops" → nombre real)

**Files:**
- Modify: `src/lib/corporate-types.ts`
- Modify: `src/lib/corporate-data-service.ts`
- Test: `src/lib/__tests__/set-filter-logic.test.ts` (fixture `makeSet` — agregar `styleLabels`)

**Interfaces:**
- Produces: `CorporateSetSummary.styleLabels: Record<string, string>` — consumido por Task 2
  (`computeSetFilterOptions`).

- [ ] **Step 1: Agregar `styleLabels` a `CorporateSetSummary`**

En `src/lib/corporate-types.ts`, ubicar el campo `availableStyles` dentro de
`CorporateSetSummary`:

```ts
  /** Agregado EAV de `variants[].styles` a través de todas las piezas del set: slug de atributo → valores únicos presentes. */
  availableStyles: Record<string, string[]>;
```

Agregar inmediatamente después:

```ts
  /** Nombre legible de cada slug presente en `availableStyles` (ej. `corte-tops` → `Modelo de
   * Corte`) — mismo patrón que `SetPiece.styleLabels` en la PDP, ahora también a nivel de set
   * agregado para el filtro de `/corporativo`. Fallback al slug capitalizado si el atributo no
   * tiene `name` (dato inconsistente). */
  styleLabels: Record<string, string>;
```

- [ ] **Step 2: Traer `attributesTable.name` en `getActiveCorporateSets` y poblar `styleLabels`**

En `src/lib/corporate-data-service.ts`, ubicar la línea donde se calcula `colorSwatchMap` dentro
de `getActiveCorporateSets`:

```ts
  const colorSwatchMap = await getColorSwatchMap(variants.map((v) => v.colorId).filter((id): id is string => !!id));
```

Agregar inmediatamente después (mismo patrón que `getCorporateSetBySlug`, que ya hace esta misma
consulta para la PDP):

```ts
  // Nombre legible de cada atributo EAV (slug → nombre) — mismo patrón que `getCorporateSetBySlug`
  // (PDP), ahora también para el agregado de set que alimenta el filtro de `/corporativo`.
  const allAttributes = await db.select({ name: attributesTable.name, slug: attributesTable.slug }).from(attributesTable);
  const attributeNameBySlug = new Map(allAttributes.map((a) => [a.slug, a.name]));
```

Ubicar el bloque donde se arma `availableStyles` dentro del `rows.map((set) => {...})`:

```ts
    const availableStyles: Record<string, string[]> = Object.fromEntries(
      Array.from(stylesMap.entries(), ([slug, values]) => [slug, Array.from(values)])
    );
```

Agregar inmediatamente después:

```ts
    const styleLabels: Record<string, string> = Object.fromEntries(
      Array.from(stylesMap.keys(), (slug) => [
        slug,
        attributeNameBySlug.get(slug) ?? slug.charAt(0).toUpperCase() + slug.slice(1),
      ])
    );
```

- [ ] **Step 3: Agregar `styleLabels` al objeto retornado por `getActiveCorporateSets`**

Ubicar el `return { ... }` dentro del `rows.map`, bloque que incluye `availableStyles,`:

```ts
      collections: setCollections,
      availableStyles,
      pieceNames,
```

Reemplazar por:

```ts
      collections: setCollections,
      availableStyles,
      styleLabels,
      pieceNames,
```

- [ ] **Step 4: Agregar `styleLabels` al retorno de `getCorporateSetBySlug`**

`CorporateSetDetail extends CorporateSetSummary`, así que también debe devolver `styleLabels`.
Dentro de `getCorporateSetBySlug`, ubicar (en su `return { ... }` final):

```ts
    availableStyles: Object.fromEntries(
      Array.from(stylesMapAgg.entries(), ([slug, values]) => [slug, Array.from(values)])
    ),
```

Agregar inmediatamente después (esta función ya define `attributeNameBySlug` más arriba, para
`SetPiece.styleLabels` por pieza — se reutiliza el mismo mapa):

```ts
    styleLabels: Object.fromEntries(
      Array.from(stylesMapAgg.keys(), (slug) => [
        slug,
        attributeNameBySlug.get(slug) ?? slug.charAt(0).toUpperCase() + slug.slice(1),
      ])
    ),
```

`getSearchableCorporateSets` NO extiende `CorporateSetSummary` como tipo de retorno (devuelve
`CorporateSetNavItem`, que no tiene `styleLabels`) — no requiere cambios.

- [ ] **Step 5: Actualizar fixtures de test existentes**

En `src/lib/__tests__/set-filter-logic.test.ts`, la función `makeSet` (helper compartido del
archivo) construye un objeto `CorporateSetSummary` completo — ubicar la línea:

```ts
    availableStyles: { corte: ['Regular'] },
```

Agregar inmediatamente después:

```ts
    styleLabels: { corte: 'Corte' },
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos (2 preexistentes no relacionados: `schema.test.ts`,
`docs.test.ts` COLOR_PAIRING). Si aparece algún otro fixture de test con `CorporateSetSummary`
incompleto fuera de `set-filter-logic.test.ts`, agregar `styleLabels` ahí también siguiendo el
mismo patrón del Step 5.

- [ ] **Step 7: Lint**

Run: `npx eslint src/lib/corporate-types.ts src/lib/corporate-data-service.ts src/lib/__tests__/set-filter-logic.test.ts`
Expected: sin errores nuevos.

- [ ] **Step 8: Commit**

```bash
git add src/lib/corporate-types.ts src/lib/corporate-data-service.ts src/lib/__tests__/set-filter-logic.test.ts
git commit -m "ACTIVITY: propagar nombre real de atributos EAV a nivel de set (fix futuro label de filtro)"
```

---

### Task 2: Filtros facetados (interdependientes) + labels reales en el filtro

**Files:**
- Modify: `src/lib/set-filter-logic.ts`
- Modify: `src/hooks/useSetFilter.ts`
- Test: `src/lib/__tests__/set-filter-logic.test.ts`

**Interfaces:**
- Consumes: `CorporateSetSummary.styleLabels` (Task 1).
- Produces:
  - `matchesSetFiltersExcept(set: CorporateSetSummary, filters: SetFilterState, exclude?: keyof SetFilterState): boolean`
  - `computeSetFilterOptions(sets: CorporateSetSummary[], filters: SetFilterState): SetFilterOptions`
  — ambas exportadas desde `set-filter-logic.ts`. `SetFilterOptions` y `SetStyleFilterOption` se
  mueven de `useSetFilter.ts` a `set-filter-logic.ts` (son el tipo de retorno de la nueva función
  pura); `useSetFilter.ts` las re-exporta o las importa según corresponda para no romper a
  `SetFilterSidebar.tsx`, que las importa hoy desde `@/hooks/useSetFilter`.

- [ ] **Step 1: Escribir los tests que fallan para `matchesSetFiltersExcept`**

Agregar en `src/lib/__tests__/set-filter-logic.test.ts`, después del
`describe('matchesSetFilters — búsqueda ampliada', ...)` existente (usa los helpers `makeSet` y
`filters` ya definidos en el archivo):

```ts
describe('matchesSetFiltersExcept', () => {
  it('ignora el filtro de color al evaluar, pero respeta el resto', () => {
    const set = makeSet({
      brandId: 'b1',
      colors: [{ id: 'c-red', name: 'Red', code: 'RED', hex: '#FF0000', kind: 'SOLID', swatchUrl: null }],
    });
    // brandId coincide, colorId NO coincide (set no tiene c-navy) — pero como excluimos 'colorId',
    // el mismatch de color no debe importar.
    const result = matchesSetFiltersExcept(
      set,
      filters({ brandId: 'b1', colorId: 'c-navy' }),
      'colorId'
    );
    expect(result).toBe(true);
  });

  it('sigue rechazando por otros filtros activos aunque se excluya uno', () => {
    const set = makeSet({ brandId: 'b1' });
    const result = matchesSetFiltersExcept(
      set,
      filters({ brandId: 'b2', colorId: 'c-navy' }),
      'colorId'
    );
    expect(result).toBe(false);
  });

  it('sin exclusión, se comporta igual que matchesSetFilters', () => {
    const set = makeSet({ brandId: 'b1' });
    const withExclude = matchesSetFiltersExcept(set, filters({ brandId: 'b2' }), 'colorId');
    const direct = matchesSetFilters(set, filters({ brandId: 'b2' }));
    expect(withExclude).toBe(direct);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run --root . --config vitest.config.ts --exclude '**/.claude/**' src/lib/__tests__/set-filter-logic.test.ts`
Expected: FAIL — `matchesSetFiltersExcept` no existe todavía (error de import/`is not a
function`).

- [ ] **Step 3: Implementar `matchesSetFiltersExcept` refactorizando `matchesSetFilters`**

En `src/lib/set-filter-logic.ts`, reemplazar la función `matchesSetFilters` completa:

```ts
export function matchesSetFilters(set: CorporateSetSummary, filters: SetFilterState): boolean {
  if (filters.gender && !set.genders.includes(filters.gender)) {
    return false;
  }
  if (filters.productTypes.length > 0 && !set.productTypes.some((t) => filters.productTypes.includes(t))) {
    return false;
  }
  if (filters.brandId && set.brandId !== filters.brandId) {
    return false;
  }
  if (filters.collectionId && !set.collections.some((c) => c.id === filters.collectionId)) {
    return false;
  }
  if (filters.colorId && !set.colors.some((c) => c.id === filters.colorId)) {
    return false;
  }
  if (filters.sizes.length > 0 && !set.sizes.some((s) => filters.sizes.includes(s))) {
    return false;
  }
  for (const [slug, values] of Object.entries(filters.selectedStyles)) {
    if (values.length === 0) continue;
    const setValues = set.availableStyles[slug] ?? [];
    if (!setValues.some((v) => values.includes(v))) return false;
  }

  const query = filters.search.trim().toLowerCase();
  if (query) {
    const haystack = buildSetSearchWords(set).join(' ').toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  return true;
}
```

por:

```ts
/** Evalúa si `set` matchea `filters`, opcionalmente ignorando UNA categoría (`exclude`) — usado
 * por el facetado (`computeSetFilterOptions`) para calcular qué opciones mostrar dentro de una
 * categoría sin que esa misma categoría se autolimite a lo ya seleccionado. `matchesSetFilters`
 * es el caso sin exclusión. */
export function matchesSetFiltersExcept(
  set: CorporateSetSummary,
  filters: SetFilterState,
  exclude?: keyof SetFilterState
): boolean {
  if (exclude !== 'gender' && filters.gender && !set.genders.includes(filters.gender)) {
    return false;
  }
  if (
    exclude !== 'productTypes' &&
    filters.productTypes.length > 0 &&
    !set.productTypes.some((t) => filters.productTypes.includes(t))
  ) {
    return false;
  }
  if (exclude !== 'brandId' && filters.brandId && set.brandId !== filters.brandId) {
    return false;
  }
  if (
    exclude !== 'collectionId' &&
    filters.collectionId &&
    !set.collections.some((c) => c.id === filters.collectionId)
  ) {
    return false;
  }
  if (exclude !== 'colorId' && filters.colorId && !set.colors.some((c) => c.id === filters.colorId)) {
    return false;
  }
  if (
    exclude !== 'sizes' &&
    filters.sizes.length > 0 &&
    !set.sizes.some((s) => filters.sizes.includes(s))
  ) {
    return false;
  }
  if (exclude !== 'selectedStyles') {
    for (const [slug, values] of Object.entries(filters.selectedStyles)) {
      if (values.length === 0) continue;
      const setValues = set.availableStyles[slug] ?? [];
      if (!setValues.some((v) => values.includes(v))) return false;
    }
  }

  const query = filters.search.trim().toLowerCase();
  if (query) {
    const haystack = buildSetSearchWords(set).join(' ').toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  return true;
}

export function matchesSetFilters(set: CorporateSetSummary, filters: SetFilterState): boolean {
  return matchesSetFiltersExcept(set, filters, undefined);
}
```

Nota: `selectedStyles` es `Record<string, string[]>`, no una categoría única por slug — excluir
`'selectedStyles'` completo desactiva el chequeo para TODOS los slugs EAV a la vez. Es
intencional: un usuario cambiando el valor de "Corte" debe poder ver también todos los valores
de "Talle" disponibles sin que su propia selección de "Talle" lo autolimite, y viceversa —
excluir `selectedStyles` completo logra esto para ambos ejes a la vez.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run --root . --config vitest.config.ts --exclude '**/.claude/**' src/lib/__tests__/set-filter-logic.test.ts`
Expected: PASS — los 3 casos nuevos más los preexistentes.

- [ ] **Step 5: Mover `SetFilterOptions`/`SetStyleFilterOption` a `set-filter-logic.ts` e implementar `computeSetFilterOptions`**

En `src/lib/set-filter-logic.ts`, agregar el import de `ProductColor` al inicio del archivo:

```ts
import type { CorporateSetSummary } from './corporate-types';
import type { Gender } from './types';
```

por:

```ts
import type { CorporateSetSummary } from './corporate-types';
import type { Gender, ProductColor } from './types';
```

Agregar, después de la definición de `matchesSetFilters` (y antes de `sortSets`), los tipos y la
función pura (moviendo la documentación ya existente en `useSetFilter.ts` para `SetStyleFilterOption`):

```ts
/** Opción de estilo EAV (ej. "Corte") derivada de `set.availableStyles` — soporta cualquier
 * atributo de estilo presente en los datos, no solo "corte". `label` es el nombre real del
 * atributo (`set.styleLabels`), con fallback al slug capitalizado si ningún set lo provee. */
export interface SetStyleFilterOption {
  slug: string;
  label: string;
  values: string[];
}

export interface SetFilterOptions {
  /** Nombres de `productTypes` (EAV) presentes entre los sets recibidos — dinámico, sin opción muerta. */
  productTypes: string[];
  brands: { id: string; name: string; logoUrl: string | null }[];
  collections: { id: string; name: string; logoUrl: string | null }[];
  colors: ProductColor[];
  sizes: string[];
  styleOptions: SetStyleFilterOption[];
}

/** Calcula las opciones disponibles por categoría de filtro (facetado): cada categoría se
 * agrega SOLO desde los sets que matchean todos los filtros activos EXCEPTO el de esa misma
 * categoría (`matchesSetFiltersExcept`) — así elegir Marca reduce las opciones de Color/
 * Colección/etc., y viceversa, pero el usuario siempre puede seguir cambiando de opción dentro
 * de la categoría que ya tiene seleccionada. Género no se incluye (son 4 valores fijos, siempre
 * visibles completos). */
export function computeSetFilterOptions(
  sets: CorporateSetSummary[],
  filters: SetFilterState
): SetFilterOptions {
  const setsForProductTypes = sets.filter((s) => matchesSetFiltersExcept(s, filters, 'productTypes'));
  const setsForBrands = sets.filter((s) => matchesSetFiltersExcept(s, filters, 'brandId'));
  const setsForCollections = sets.filter((s) => matchesSetFiltersExcept(s, filters, 'collectionId'));
  const setsForColors = sets.filter((s) => matchesSetFiltersExcept(s, filters, 'colorId'));
  const setsForSizes = sets.filter((s) => matchesSetFiltersExcept(s, filters, 'sizes'));
  const setsForStyles = sets.filter((s) => matchesSetFiltersExcept(s, filters, 'selectedStyles'));

  const productTypes = new Set<string>();
  for (const s of setsForProductTypes) for (const t of s.productTypes) productTypes.add(t);

  const brandsMap = new Map<string, { id: string; name: string; logoUrl: string | null }>();
  for (const s of setsForBrands) {
    if (s.brandId && s.brandName && !brandsMap.has(s.brandId)) {
      brandsMap.set(s.brandId, { id: s.brandId, name: s.brandName, logoUrl: s.brandLogoUrl });
    }
  }

  const collectionsMap = new Map<string, { id: string; name: string; logoUrl: string | null }>();
  for (const s of setsForCollections) {
    for (const c of s.collections) {
      if (!collectionsMap.has(c.id)) collectionsMap.set(c.id, c);
    }
  }

  const colorMap = new Map<string, ProductColor>();
  for (const s of setsForColors) {
    for (const c of s.colors) if (!colorMap.has(c.id)) colorMap.set(c.id, c);
  }

  const sizes = new Set<string>();
  for (const s of setsForSizes) for (const sz of s.sizes) sizes.add(sz);

  const stylesMap = new Map<string, Set<string>>();
  const styleLabelsMap = new Map<string, string>();
  for (const s of setsForStyles) {
    for (const [slug, values] of Object.entries(s.availableStyles)) {
      if (!stylesMap.has(slug)) stylesMap.set(slug, new Set());
      for (const v of values) stylesMap.get(slug)!.add(v);
      if (!styleLabelsMap.has(slug) && s.styleLabels[slug]) {
        styleLabelsMap.set(slug, s.styleLabels[slug]);
      }
    }
  }
  const styleOptions: SetStyleFilterOption[] = Array.from(stylesMap.entries()).map(([slug, values]) => ({
    slug,
    label: styleLabelsMap.get(slug) ?? slug.charAt(0).toUpperCase() + slug.slice(1),
    values: Array.from(values).sort(),
  }));

  return {
    productTypes: Array.from(productTypes).sort(),
    brands: Array.from(brandsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    collections: Array.from(collectionsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    colors: Array.from(colorMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    sizes: Array.from(sizes),
    styleOptions,
  };
}
```

- [ ] **Step 6: Escribir los tests que fallan para `computeSetFilterOptions`**

Agregar en `src/lib/__tests__/set-filter-logic.test.ts`, después del nuevo
`describe('matchesSetFiltersExcept', ...)`:

```ts
describe('computeSetFilterOptions — facetado', () => {
  const setBarcoRojo = makeSet({
    id: 'barco-rojo',
    brandId: 'barco',
    brandName: 'Barco',
    genders: ['Hombre'],
    colors: [{ id: 'c-red', name: 'Red', code: 'RED', hex: '#FF0000', kind: 'SOLID', swatchUrl: null }],
  });
  const setBarcoAzul = makeSet({
    id: 'barco-azul',
    brandId: 'barco',
    brandName: 'Barco',
    genders: ['Mujer'],
    colors: [{ id: 'c-blue', name: 'Blue', code: 'BLU', hex: '#0000FF', kind: 'SOLID', swatchUrl: null }],
  });
  const setLandauVerde = makeSet({
    id: 'landau-verde',
    brandId: 'landau',
    brandName: 'Landau',
    genders: ['Hombre'],
    colors: [{ id: 'c-green', name: 'Green', code: 'GRN', hex: '#00FF00', kind: 'SOLID', swatchUrl: null }],
  });
  const allSets = [setBarcoRojo, setBarcoAzul, setLandauVerde];

  it('sin filtros activos, muestra todas las opciones', () => {
    const options = computeSetFilterOptions(allSets, EMPTY_SET_FILTERS);
    expect(options.brands.map((b) => b.id).sort()).toEqual(['barco', 'landau']);
    expect(options.colors.map((c) => c.id).sort()).toEqual(['c-blue', 'c-green', 'c-red']);
  });

  it('al elegir marca Barco, el filtro de color se reduce a los colores de Barco', () => {
    const options = computeSetFilterOptions(allSets, filters({ brandId: 'barco' }));
    expect(options.colors.map((c) => c.id).sort()).toEqual(['c-blue', 'c-red']);
  });

  it('al elegir marca Barco + género Hombre, el color se reduce aún más (solo Red)', () => {
    const options = computeSetFilterOptions(allSets, filters({ brandId: 'barco', gender: 'Hombre' }));
    expect(options.colors.map((c) => c.id)).toEqual(['c-red']);
  });

  it('al elegir un color, el propio filtro de color sigue mostrando todas sus opciones (auto-exclusión)', () => {
    const options = computeSetFilterOptions(allSets, filters({ brandId: 'barco', colorId: 'c-red' }));
    // El filtro de color se excluye a sí mismo: debe seguir mostrando Red Y Blue (ambos de Barco).
    expect(options.colors.map((c) => c.id).sort()).toEqual(['c-blue', 'c-red']);
  });

  it('colecciones se acotan por marca igual que colores', () => {
    const setBarcoConColeccion = makeSet({
      id: 'barco-col',
      brandId: 'barco',
      brandName: 'Barco',
      collections: [{ id: 'col-verano', name: 'Verano', logoUrl: null }],
    });
    const setLandauConColeccion = makeSet({
      id: 'landau-col',
      brandId: 'landau',
      brandName: 'Landau',
      collections: [{ id: 'col-invierno', name: 'Invierno', logoUrl: null }],
    });
    const options = computeSetFilterOptions(
      [setBarcoConColeccion, setLandauConColeccion],
      filters({ brandId: 'barco' })
    );
    expect(options.collections.map((c) => c.id)).toEqual(['col-verano']);
  });

  it('usa el label real de styleLabels en vez del slug capitalizado', () => {
    const set = makeSet({ availableStyles: { 'corte-tops': ['Regular'] }, styleLabels: { 'corte-tops': 'Modelo de Corte' } });
    const options = computeSetFilterOptions([set], EMPTY_SET_FILTERS);
    const styleOption = options.styleOptions.find((o) => o.slug === 'corte-tops');
    expect(styleOption?.label).toBe('Modelo de Corte');
  });

  it('cae al slug capitalizado si ningún set provee styleLabels para ese slug', () => {
    const set = makeSet({ availableStyles: { talle: ['M'] }, styleLabels: {} });
    const options = computeSetFilterOptions([set], EMPTY_SET_FILTERS);
    const styleOption = options.styleOptions.find((o) => o.slug === 'talle');
    expect(styleOption?.label).toBe('Talle');
  });
});
```

Actualizar el import del archivo de test para incluir `computeSetFilterOptions` y
`matchesSetFiltersExcept`:

```ts
import {
  matchesSetFilters,
  sortSets,
  countActiveSetFilters,
  paginate,
  EMPTY_SET_FILTERS,
  type SetFilterState,
} from '../set-filter-logic';
```

por:

```ts
import {
  matchesSetFilters,
  matchesSetFiltersExcept,
  computeSetFilterOptions,
  sortSets,
  countActiveSetFilters,
  paginate,
  EMPTY_SET_FILTERS,
  type SetFilterState,
} from '../set-filter-logic';
```

- [ ] **Step 7: Correr los tests y verificar que pasan**

Run: `npx vitest run --root . --config vitest.config.ts --exclude '**/.claude/**' src/lib/__tests__/set-filter-logic.test.ts`
Expected: PASS — todos, incluyendo los 7 casos nuevos de `computeSetFilterOptions`.

- [ ] **Step 8: Simplificar `useSetFilter.ts` para usar `computeSetFilterOptions`**

En `src/hooks/useSetFilter.ts`, reemplazar el archivo completo por:

```ts
import { useState, useMemo, useCallback } from 'react';
import type { CorporateSetSummary } from '@/lib/corporate-types';
import {
  EMPTY_SET_FILTERS,
  matchesSetFilters,
  computeSetFilterOptions,
  sortSets,
  countActiveSetFilters,
  paginate,
  type SetFilterState,
  type SetSortOption,
  type SetFilterOptions,
} from '@/lib/set-filter-logic';

export type { SetFilterOptions, SetStyleFilterOption } from '@/lib/set-filter-logic';

const ITEMS_PER_PAGE_DEFAULT = 20;

export function useSetFilter(
  sets: CorporateSetSummary[],
  initial?: { search?: string; brandName?: string }
) {
  const [filters, setFilters] = useState<SetFilterState>(() => {
    if (!initial) return EMPTY_SET_FILTERS;
    let brandId: string | null = null;
    if (initial.brandName) {
      const match = sets.find(
        (s) => s.brandName?.toLowerCase() === initial.brandName!.toLowerCase()
      );
      brandId = match?.brandId ?? null;
    }
    return {
      ...EMPTY_SET_FILTERS,
      search: initial.search ?? EMPTY_SET_FILTERS.search,
      brandId,
    };
  });
  const [sortBy, setSortBy] = useState<SetSortOption>('relevance');
  const [itemsPerPage, setItemsPerPageState] = useState<number>(ITEMS_PER_PAGE_DEFAULT);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filterOptions: SetFilterOptions = useMemo(
    () => computeSetFilterOptions(sets, filters),
    [sets, filters]
  );

  const filteredSets = useMemo(() => {
    const matched = sets.filter((s) => matchesSetFilters(s, filters));
    return sortSets(matched, sortBy);
  }, [sets, filters, sortBy]);

  const totalSets = filteredSets.length;
  const totalPages = Math.max(1, Math.ceil(totalSets / itemsPerPage));

  const paginatedSets = useMemo(
    () => paginate(filteredSets, currentPage, itemsPerPage),
    [filteredSets, currentPage, itemsPerPage]
  );

  const activeFilterCount = countActiveSetFilters(filters);
  const hasActiveFilters = activeFilterCount > 0 || filters.search.trim().length > 0;

  const applyFilters = useCallback((newFilters: Partial<SetFilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_SET_FILTERS);
    setCurrentPage(1);
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [totalPages]
  );

  const setItemsPerPage = useCallback((count: number) => {
    setItemsPerPageState(count);
    setCurrentPage(1);
  }, []);

  return {
    filters,
    filterOptions,
    paginatedSets,
    currentPage,
    totalPages,
    totalSets,
    hasActiveFilters,
    activeFilterCount,
    applyFilters,
    resetFilters,
    goToPage,
    sortBy,
    setSortBy,
    itemsPerPage,
    setItemsPerPage,
  };
}
```

Nota: `SetFilterSidebar.tsx` importa `type { SetFilterOptions } from '@/hooks/useSetFilter'` —
el `export type { SetFilterOptions, SetStyleFilterOption } from '@/lib/set-filter-logic';`
mantiene esa ruta de import funcionando sin tocar `SetFilterSidebar.tsx` en esta task.

- [ ] **Step 9: Correr toda la suite, typecheck y lint**

Run: `npx vitest run --root . --config vitest.config.ts --exclude '**/.claude/**' src`
Expected: todos pasan (mismo único fallo preexistente conocido: `docs.test.ts` COLOR_PAIRING).

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

Run: `npx eslint src/lib/set-filter-logic.ts src/hooks/useSetFilter.ts src/lib/__tests__/set-filter-logic.test.ts`
Expected: sin errores nuevos.

- [ ] **Step 10: Commit**

```bash
git add src/lib/set-filter-logic.ts src/hooks/useSetFilter.ts src/lib/__tests__/set-filter-logic.test.ts
git commit -m "ACTIVITY: hacer que los filtros de /corporativo reaccionen entre si (facetado) y usar nombre real de atributos"
```

---

### Task 3: Fix colores faltantes — "Ver todos (N)" expandible

**Files:**
- Modify: `src/components/catalog/SetFilterSidebar.tsx`

Nota: el ordenamiento alfabético de `filterOptions.colors` ya quedó resuelto en Task 2 Step 5
(`computeSetFilterOptions` ordena por `name`). Esta task solo agrega el control de expansión en
la UI para no cortar la lista en 20 sin aviso.

- [ ] **Step 1: Agregar estado local `isColorsExpanded` y el link "Ver todos (N)"**

En `src/components/catalog/SetFilterSidebar.tsx`, agregar el import de `useState`:

```ts
'use client';

import { X, SlidersHorizontal, Venus, Mars, VenusAndMars, Users } from 'lucide-react';
```

por:

```ts
'use client';

import { useState } from 'react';
import { X, SlidersHorizontal, Venus, Mars, VenusAndMars, Users } from 'lucide-react';
```

Dentro del componente `SetFilterSidebar`, después de la línea `const hasActiveFilters = ...`,
agregar:

```ts
  const [isColorsExpanded, setIsColorsExpanded] = useState(false);
```

Ubicar el bloque del `AccordionItem value="color"`:

```tsx
          {filterOptions.colors.length > 0 && (
            <AccordionItem value="color">
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                Color
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.colors.slice(0, 20).map((color) => (
                    <ColorSwatch
                      key={color.id}
                      color={color}
                      isSelected={filters.colorId === color.id}
                      onClick={() => toggleColor(color.id)}
                      size="md"
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
```

Reemplazar por:

```tsx
          {filterOptions.colors.length > 0 && (
            <AccordionItem value="color">
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                Color
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {(isColorsExpanded ? filterOptions.colors : filterOptions.colors.slice(0, 20)).map((color) => (
                    <ColorSwatch
                      key={color.id}
                      color={color}
                      isSelected={filters.colorId === color.id}
                      onClick={() => toggleColor(color.id)}
                      size="md"
                    />
                  ))}
                </div>
                {!isColorsExpanded && filterOptions.colors.length > 20 && (
                  <button
                    type="button"
                    onClick={() => setIsColorsExpanded(true)}
                    className="mt-2 text-xs text-gray-500 hover:text-[#111111] underline transition-colors"
                  >
                    Ver todos ({filterOptions.colors.length})
                  </button>
                )}
              </AccordionContent>
            </AccordionItem>
          )}
```

- [ ] **Step 2: Typecheck y lint**

Run: `npx tsc --noEmit`
Run: `npx eslint src/components/catalog/SetFilterSidebar.tsx`
Expected: sin errores nuevos.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 4: Commit**

```bash
git add src/components/catalog/SetFilterSidebar.tsx
git commit -m "ACTIVITY: mostrar todos los colores disponibles en el filtro con boton ver todos, antes se cortaban en 20"
```

---

### Task 4: Tooltips en Marca y Colección

**Files:**
- Modify: `src/components/catalog/SetFilterSidebar.tsx`

- [ ] **Step 1: Importar el componente Tooltip**

Agregar el import:

```ts
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
```

por:

```ts
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
```

- [ ] **Step 2: Envolver la card de Marca en Tooltip**

Ubicar el bloque del `AccordionItem value="brand"`:

```tsx
          {filterOptions.brands.length > 0 && (
            <AccordionItem value="brand">
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                Marca
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-2">
                  {filterOptions.brands.map((brand) => {
                    const isSelected = filters.brandId === brand.id;
                    return (
                      <button
                        key={brand.id}
                        onClick={() => toggleBrand(brand.id)}
                        className={cn(
                          'flex items-center justify-center h-16 px-3 rounded border transition-colors duration-150',
                          isSelected
                            ? 'border-[#111111] bg-[#F5F5F7]'
                            : 'border-gray-200 hover:border-gray-400'
                        )}
                      >
                        {brand.logoUrl ? (
                          <img
                            src={brand.logoUrl}
                            alt={brand.name}
                            className="max-h-10 max-w-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <span
                          className={cn(
                            'text-xs font-medium text-center',
                            brand.logoUrl ? 'hidden' : 'block',
                            isSelected ? 'text-[#111111]' : 'text-gray-500'
                          )}
                        >
                          {brand.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
```

Reemplazar por (envuelve cada botón en `Tooltip`, manteniendo el fallback de texto sin logo
intacto):

```tsx
          {filterOptions.brands.length > 0 && (
            <AccordionItem value="brand">
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                Marca
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-2">
                  {filterOptions.brands.map((brand) => {
                    const isSelected = filters.brandId === brand.id;
                    return (
                      <Tooltip key={brand.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => toggleBrand(brand.id)}
                            className={cn(
                              'flex items-center justify-center h-16 px-3 rounded border transition-colors duration-150',
                              isSelected
                                ? 'border-[#111111] bg-[#F5F5F7]'
                                : 'border-gray-200 hover:border-gray-400'
                            )}
                          >
                            {brand.logoUrl ? (
                              <img
                                src={brand.logoUrl}
                                alt={brand.name}
                                className="max-h-10 max-w-full object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <span
                              className={cn(
                                'text-xs font-medium text-center',
                                brand.logoUrl ? 'hidden' : 'block',
                                isSelected ? 'text-[#111111]' : 'text-gray-500'
                              )}
                            >
                              {brand.name}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{brand.name}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
```

- [ ] **Step 3: Aplicar el mismo patrón al bloque de Colección**

Ubicar el bloque del `AccordionItem value="collection"` (mismo patrón visual que el de Marca,
con `collection.logoUrl`/`collection.name`/`toggleCollection`):

```tsx
          {filterOptions.collections.length > 0 && (
            <AccordionItem value="collection">
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                Colección
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-2">
                  {filterOptions.collections.map((collection) => {
                    const isSelected = filters.collectionId === collection.id;
                    return (
                      <button
                        key={collection.id}
                        onClick={() => toggleCollection(collection.id)}
                        className={cn(
                          'flex items-center justify-center h-16 px-3 rounded border transition-colors duration-150',
                          isSelected
                            ? 'border-[#111111] bg-[#F5F5F7]'
                            : 'border-gray-200 hover:border-gray-400'
                        )}
                      >
                        {collection.logoUrl ? (
                          <img
                            src={collection.logoUrl}
                            alt={collection.name}
                            className="max-h-10 max-w-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <span
                          className={cn(
                            'text-xs font-medium text-center',
                            collection.logoUrl ? 'hidden' : 'block',
                            isSelected ? 'text-[#111111]' : 'text-gray-500'
                          )}
                        >
                          {collection.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
```

Reemplazar por:

```tsx
          {filterOptions.collections.length > 0 && (
            <AccordionItem value="collection">
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                Colección
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-2">
                  {filterOptions.collections.map((collection) => {
                    const isSelected = filters.collectionId === collection.id;
                    return (
                      <Tooltip key={collection.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => toggleCollection(collection.id)}
                            className={cn(
                              'flex items-center justify-center h-16 px-3 rounded border transition-colors duration-150',
                              isSelected
                                ? 'border-[#111111] bg-[#F5F5F7]'
                                : 'border-gray-200 hover:border-gray-400'
                            )}
                          >
                            {collection.logoUrl ? (
                              <img
                                src={collection.logoUrl}
                                alt={collection.name}
                                className="max-h-10 max-w-full object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <span
                              className={cn(
                                'text-xs font-medium text-center',
                                collection.logoUrl ? 'hidden' : 'block',
                                isSelected ? 'text-[#111111]' : 'text-gray-500'
                              )}
                            >
                              {collection.name}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{collection.name}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
```

- [ ] **Step 4: Envolver `sidebarContent` en `TooltipProvider`**

Ubicar la declaración de `sidebarContent`:

```tsx
  const sidebarContent = (
    <>
      <div className="flex items-center justify-between p-4 border-b border-[#E5E5E5] lg:hidden">
```

Reemplazar el `<>` de apertura por `<TooltipProvider delayDuration={200}>`:

```tsx
  const sidebarContent = (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center justify-between p-4 border-b border-[#E5E5E5] lg:hidden">
```

Y ubicar el cierre correspondiente al final de `sidebarContent`:

```tsx
      </div>
    </>
  );
```

Reemplazar el `</>` de cierre por `</TooltipProvider>`:

```tsx
      </div>
    </TooltipProvider>
  );
```

- [ ] **Step 5: Typecheck y lint**

Run: `npx tsc --noEmit`
Run: `npx eslint src/components/catalog/SetFilterSidebar.tsx`
Expected: sin errores nuevos.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 7: Commit**

```bash
git add src/components/catalog/SetFilterSidebar.tsx
git commit -m "ACTIVITY: agregar tooltip con nombre a las imagenes de marca y coleccion en el filtro"
```

---

### Task 5: Verificación final end-to-end

**Files:** ninguno (solo validación).

- [ ] **Step 1: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: mismos 2 errores preexistentes no relacionados (`schema.test.ts`, `docs.test.ts`) —
cero errores nuevos.

- [ ] **Step 2: Lint completo del proyecto**

Run: `npx eslint src`
Expected: sin errores nuevos respecto al estado antes de este plan (deuda preexistente ya
identificada en sesiones anteriores puede seguir apareciendo en archivos no tocados por este
plan).

- [ ] **Step 3: Suite de tests completa**

Run: `npx vitest run --root . --config vitest.config.ts --exclude '**/.claude/**' src`
Expected: todos los tests pasan (incluyendo los nuevos de Task 1 y Task 2), mismo único fallo
preexistente conocido (`docs.test.ts` COLOR_PAIRING).

- [ ] **Step 4: Build de producción**

Run: `npm run build`
Expected: build exitoso, todas las rutas compilan.

- [ ] **Step 5: Reportar en el chat**

Seguir el formato obligatorio de CLAUDE.md: Resumen Ejecutivo, Verificación Manual en
Producción (checklist probando: hover sobre logos de marca/colección para ver el tooltip,
seleccionar marca y verificar que colección/color/tipo/talla se acotan, seleccionar color y
verificar que el resto se acota, seleccionar una combinación sin resultados y confirmar que la
selección no se borra sola, expandir "Ver todos" en colores y contar que aparecen más de 20 si
corresponde, revisar que el filtro de Atributos muestra nombres legibles en vez de slugs),
Migraciones Ejecutadas (N/A), Builds y Validaciones, y el commit sugerido consolidado.

## Self-Review Notes

- **Cobertura de spec:** los 4 puntos (tooltips, facetado, fix colores, fix labels EAV) están
  cubiertos por las Tasks 1-4.
- **Sin placeholders:** todos los steps incluyen código completo o instrucciones de reemplazo
  exactas, salvo Task 4 Step 3 que explícitamente delega un cambio mecánico idéntico al de Step 2
  (mismo patrón, distinto campo) — no es ambigüedad de "cómo hacerlo", da el bloque completo
  antes/después igual que el resto del plan.
- **Sin dependencias de testing nuevas:** el problema original (¿cómo testear un hook de React
  sin `@testing-library/react`?) se resolvió extrayendo la lógica de facetado a
  `computeSetFilterOptions`, función pura 100% testeable con Vitest solo, consistente con cómo ya
  se testea el resto de `set-filter-logic.ts`.
- **Consistencia de tipos:** `styleLabels: Record<string, string>` se define una vez en
  `corporate-types.ts` (Task 1) y se consume igual en `set-filter-logic.ts` (Task 2, dentro de
  `computeSetFilterOptions`) y en `corporate-data-service.ts` (Task 1, en ambas funciones que
  devuelven `CorporateSetSummary`/`CorporateSetDetail`). `matchesSetFiltersExcept` y
  `computeSetFilterOptions` se definen una vez en `set-filter-logic.ts` (Task 2) y
  `useSetFilter.ts` solo las invoca, sin reimplementar lógica.
- **Compatibilidad de imports:** `SetFilterOptions`/`SetStyleFilterOption` se mueven de
  `useSetFilter.ts` a `set-filter-logic.ts`, pero se re-exportan desde `useSetFilter.ts` (Task 2
  Step 8) para que `SetFilterSidebar.tsx` (que las importa desde `@/hooks/useSetFilter`) no
  necesite ningún cambio en esta pasada.
- **Orden de tasks:** Task 1 (labels) se hace antes de Task 2 (facetado) porque
  `computeSetFilterOptions` (Task 2) ya consume `styleLabels` directamente al construirse —
  evita tocar ese bloque dos veces.

# Rediseño del sidebar de filtros de sets corporativos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar `SetFilterSidebar.tsx` (compartido por `/corporativo` y la home `/`, vía `SetCatalogGrid`) con acordeones colapsables, iconos en Género, logos de marca, y un nuevo filtro de Colección — todo single-select salvo Tipo de Producto/Talla/estilos EAV, que mantienen su multi-select actual.

**Architecture:** Ampliar la query `getActiveCorporateSets()` para traer logo de marca y colección agregada por set (mismos patrones ya usados para colores/tallas/estilos de piezas). Propagar los tipos nuevos por la cadena `corporate-types.ts` → `set-filter-logic.ts` → `useSetFilter.ts` → `SetFilterSidebar.tsx`. Reescribir el sidebar usando `Accordion` de Radix (ya existe en `src/components/ui/accordion.tsx`, animación ya cableada en Tailwind).

**Tech Stack:** Next.js, Drizzle ORM, TypeScript, Tailwind, Radix UI (`@radix-ui/react-accordion` ya instalado vía `src/components/ui/accordion.tsx`), `lucide-react`. Sin librería de testing de componentes en este repo (la suite `vitest` cubre solo lógica pura en `.test.ts`) — `set-filter-logic.ts` SÍ tiene test existente: `src/lib/__tests__/set-filter-logic.test.ts`. Verificado: ningún test actual usa `filters.brands`, así que ninguno se rompe por el cambio de comportamiento a `brandId`. Pero el helper `makeSet()` de ese archivo (líneas 12-38) construye un `CorporateSetSummary` completo por objeto literal — al agregar `collections`/`brandLogoUrl` a la interfaz (Task 2), ese helper dejará de compilar hasta agregarle los dos campos nuevos (Task 3 Step 4 lo corrige).

## Global Constraints

- Marca y Colección pasan a **single-select** (`brandId: string | null`, `collectionId: string | null`) — cambio de comportamiento respecto al `brands: string[]` multi-select actual, confirmado explícitamente por el usuario (spec, "Decisiones cerradas" punto 5).
- Tipo de Producto, Talla y estilos EAV **mantienen su multi-select actual** — solo se envuelven en `AccordionItem`, sin cambiar su lógica de selección (spec, "Cambios de UI").
- Colección: un set aparece si **cualquiera** de sus piezas pertenece a la colección filtrada — unión, no intersección, mismo criterio que ya usan Color/Talla hoy (spec, "Decisiones cerradas" punto 4).
- Fallback de logo de marca: texto (nombre) si `logoUrl` es `null` o falla la carga — mismo patrón que `BrandCarousel.tsx:214-230` (spec, "Decisiones cerradas" punto 3).
- No se toca `/catalogo` (retail individual) ni `HierarchicalFilter.tsx` — filtro completamente distinto, no compartido (spec, "Decisiones cerradas" punto 7).
- No se agrega filtro de precio ni logos de colección en frontstore (spec, "Fuera de alcance").
- Motion: se reutiliza la animación `accordion-down`/`accordion-up` ya existente en `tailwind.config.js` — no se escribe CSS de motion nuevo, no se agrega Framer Motion (spec, sección "Motion").
- Prohibido: `git commit`, `git push`, creación de PRs (CLAUDE.md del repo) — el trabajo queda en el working tree; al final se sugiere el mensaje de commit.
- No usar Chrome DevTools MCP para ninguna verificación (CLAUDE.md del repo).

---

## Contexto de archivos relevantes (verificado antes de escribir este plan)

**`src/lib/data-service.ts:457-469`** — patrón exacto de resolución de logo de marca a reutilizar (función real: `resolveMediaUrl` de `./media`, no un nombre inventado):
```ts
const brandIds = brands.map((b) => b.id);
const logoLinks = brandIds.length > 0
  ? await db
      .select({ brandId: mediaLinksTable.entityId, storageKey: mediaAssetsTable.storageKey })
      .from(mediaLinksTable)
      .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
      .where(and(
        eq(mediaLinksTable.entityType, 'BRAND'),
        eq(mediaLinksTable.role, 'LOGO'),
        inArray(mediaLinksTable.entityId, brandIds)
      ))
  : [];
const logoMap = new Map(logoLinks.map((l) => [l.brandId, resolveMediaUrl(l.storageKey)]));
```

**`src/lib/corporate-data-service.ts`** — ya importa `mediaLinksTable`, `mediaAssetsTable`, `resolveMediaUrl` (líneas 19-20, 28) — no hace falta agregar esos imports, solo `collections as collectionsTable` desde `@/db/schema`.

**`src/db/schema/products.ts:27-40`** — `collections`: `id, name, slug, brandId, isActive, sortOrder`. `products.collectionId` (línea 192) referencia `collections.id`.

**`src/lib/corporate-data-service.ts:198-226`** — bloque exacto donde se traen las piezas del set (`options`) y se arma `items`; aquí se agrega el join a `collections`.

**`src/lib/corporate-data-service.ts:288-292`** — bloque exacto donde se agregan `productTypes`/`genders` por set a partir de `setItems`; aquí se agrega la agregación de `collections`.

**`src/lib/corporate-types.ts:39-83`** — `CorporateSetSummary` ya tiene `brandId: string | null` (línea 61) y `brandName: string | null` (línea 59) — no se duplican, solo se agrega `brandLogoUrl` y `collections`.

**`src/components/ui/accordion.tsx`** — ya existe, exporta `Accordion, AccordionItem, AccordionTrigger, AccordionContent`. `AccordionContent` ya usa `data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down`.

---

### Task 1: Ampliar `getActiveCorporateSets()` — logo de marca y colección por set

**Files:**
- Modify: `src/lib/corporate-data-service.ts`

**Interfaces:**
- Consumes: `collections` (nuevo import desde `@/db/schema`), `mediaLinksTable`/`mediaAssetsTable`/`resolveMediaUrl` (ya importados).
- Produces: cada elemento del array retornado por `getActiveCorporateSets()` gana `brandLogoUrl: string | null` y `collections: { id: string; name: string }[]` — consumido por Task 2 (`CorporateSetSummary`).

- [ ] **Step 1: Agregar el import de `collections`**

En `src/lib/corporate-data-service.ts`, en el bloque de import desde `@/db/schema` (líneas 2-23), agregar `collections as collectionsTable,` (por ejemplo después de `brands as brandsTable,` en la línea 11):

```ts
  brands as brandsTable,
  collections as collectionsTable,
```

- [ ] **Step 2: Traer `collectionId`/`collectionName`/`collectionIsActive` en la query de piezas**

En `src/lib/corporate-data-service.ts`, reemplazar el bloque de `options` (líneas 198-214):

```ts
  const options = blockIds.length > 0
    ? await db
        .select({
          blockId: setBlockOptionsTable.blockId,
          productId: setBlockOptionsTable.productId,
          priceWholesale: productsTable.priceWholesale,
          priceWholesaleSale: productsTable.priceWholesaleSale,
          productName: productsTable.name,
          productTypeId: productsTable.productTypeId,
          productTypeName: productTypesTable.name,
          gender: productsTable.gender,
        })
        .from(setBlockOptionsTable)
        .leftJoin(productsTable, eq(setBlockOptionsTable.productId, productsTable.id))
        .leftJoin(productTypesTable, eq(productsTable.productTypeId, productTypesTable.id))
        .where(inArray(setBlockOptionsTable.blockId, blockIds))
    : [];
```

por:

```ts
  const options = blockIds.length > 0
    ? await db
        .select({
          blockId: setBlockOptionsTable.blockId,
          productId: setBlockOptionsTable.productId,
          priceWholesale: productsTable.priceWholesale,
          priceWholesaleSale: productsTable.priceWholesaleSale,
          productName: productsTable.name,
          productTypeId: productsTable.productTypeId,
          productTypeName: productTypesTable.name,
          gender: productsTable.gender,
          collectionId: collectionsTable.id,
          collectionName: collectionsTable.name,
          collectionIsActive: collectionsTable.isActive,
        })
        .from(setBlockOptionsTable)
        .leftJoin(productsTable, eq(setBlockOptionsTable.productId, productsTable.id))
        .leftJoin(productTypesTable, eq(productsTable.productTypeId, productTypesTable.id))
        .leftJoin(collectionsTable, eq(productsTable.collectionId, collectionsTable.id))
        .where(inArray(setBlockOptionsTable.blockId, blockIds))
    : [];
```

- [ ] **Step 3: Propagar los tres campos nuevos a `items`**

Reemplazar el bloque `items` (líneas 216-226):

```ts
  const items = options.map((o) => ({
    setId: setIdByBlockId.get(o.blockId)!,
    productId: o.productId,
    quantityPerSet: quantityPerBlock.get(o.blockId) ?? 1,
    priceWholesale: o.priceWholesale,
    priceWholesaleSale: o.priceWholesaleSale,
    productName: o.productName,
    productTypeId: o.productTypeId,
    productTypeName: o.productTypeName,
    gender: o.gender,
  }));
```

por:

```ts
  const items = options.map((o) => ({
    setId: setIdByBlockId.get(o.blockId)!,
    productId: o.productId,
    quantityPerSet: quantityPerBlock.get(o.blockId) ?? 1,
    priceWholesale: o.priceWholesale,
    priceWholesaleSale: o.priceWholesaleSale,
    productName: o.productName,
    productTypeId: o.productTypeId,
    productTypeName: o.productTypeName,
    gender: o.gender,
    collectionId: o.collectionId,
    collectionName: o.collectionName,
    collectionIsActive: o.collectionIsActive,
  }));
```

- [ ] **Step 4: Resolver logos de marca (una sola query, antes del `return rows.map(...)`)**

En `src/lib/corporate-data-service.ts`, inmediatamente antes de la línea `return rows.map((set) => {` (línea 267 actual), insertar:

```ts
  const brandIds = Array.from(new Set(rows.map((r) => r.brandId).filter((id): id is string => !!id)));
  const brandLogoLinks = brandIds.length > 0
    ? await db
        .select({ brandId: mediaLinksTable.entityId, storageKey: mediaAssetsTable.storageKey })
        .from(mediaLinksTable)
        .innerJoin(mediaAssetsTable, eq(mediaLinksTable.assetId, mediaAssetsTable.id))
        .where(and(
          eq(mediaLinksTable.entityType, 'BRAND'),
          eq(mediaLinksTable.role, 'LOGO'),
          inArray(mediaLinksTable.entityId, brandIds)
        ))
    : [];
  const brandLogoMap = new Map(brandLogoLinks.map((l) => [l.brandId, resolveMediaUrl(l.storageKey)]));

```

- [ ] **Step 5: Agregar `collections` por set dentro del `.map()` final, y exponer `brandLogoUrl`**

Dentro del `return rows.map((set) => { ... })`, ubicar el bloque (líneas 288-292 actuales):

```ts
    const setProductIds = Array.from(new Set(setItems.map((i) => i.productId).filter((id): id is string => !!id)));
    const productTypes = Array.from(new Set(setItems.map((i) => i.productTypeName).filter((n): n is string => !!n)));
    const genders = Array.from(
      new Set(setItems.map((i) => (i.gender ? genderFromDb[i.gender] : undefined)).filter((g): g is Gender => !!g))
    );
```

y agregar inmediatamente después (antes de la línea `const pieceNames = ...` que le sigue):

```ts
    const collectionsMap = new Map<string, string>();
    for (const i of setItems) {
      if (i.collectionId && i.collectionName && i.collectionIsActive) {
        collectionsMap.set(i.collectionId, i.collectionName);
      }
    }
    const setCollections = Array.from(collectionsMap, ([id, name]) => ({ id, name }));
```

Luego, en el objeto retornado al final del `.map()` (donde hoy están `colors: Array.from(colorMap.values()),` etc.), agregar dos campos:

```ts
      collections: setCollections,
      brandLogoUrl: set.brandId ? (brandLogoMap.get(set.brandId) ?? null) : null,
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: errores esperados en este punto ÚNICAMENTE por `CorporateSetSummary` (Task 2 todavía no la actualiza) marcando `collections`/`brandLogoUrl` como propiedades no declaradas en el tipo de retorno. Si aparecen errores en otras líneas de `corporate-data-service.ts` (ej. de sintaxis o de los joins), detenerse y reportar.

- [ ] **Step 7: Commit (sugerido, no ejecutar)**

```
feat(corporate): agregar logo de marca y coleccion agregada a getActiveCorporateSets
```

---

### Task 2: Extender `CorporateSetSummary`

**Files:**
- Modify: `src/lib/corporate-types.ts`

**Interfaces:**
- Produces: `CorporateSetSummary` con `collections: { id: string; name: string }[]` y `brandLogoUrl: string | null` — consumido por Task 3 (`useSetFilter`/`set-filter-logic`) y Task 5 (`SetFilterSidebar`).

- [ ] **Step 1: Agregar los dos campos a la interfaz**

En `src/lib/corporate-types.ts`, dentro de `CorporateSetSummary` (líneas 39-83), agregar después de `brandId: string | null;` (línea 61):

```ts
  brandId: string | null;
  /** URL del logo de marca (media_links role LOGO) — null si la marca no tiene logo cargado. */
  brandLogoUrl: string | null;
```

y agregar después de `productTypes: string[];` (línea 78):

```ts
  productTypes: string[];
  /** Colecciones presentes entre las piezas activas del set — unión, no intersección (una pieza
   * de cualquier colección basta para que el set matchee ese filtro). */
  collections: { id: string; name: string }[];
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: los errores de Task 1 (propiedades no declaradas) desaparecen. `corporate-data-service.ts` debe typechequear limpio ahora.

- [ ] **Step 3: Commit (sugerido, no ejecutar)**

```
feat(corporate): extender CorporateSetSummary con brandLogoUrl y collections
```

---

### Task 3: `set-filter-logic.ts` — `brandId`/`collectionId` single-select

**Files:**
- Modify: `src/lib/set-filter-logic.ts`

**Interfaces:**
- Consumes: `CorporateSetSummary` (Task 2, con `collections`/`brandId` ya presentes).
- Produces: `SetFilterState` con `brandId: string | null` (reemplaza `brands: string[]`) y `collectionId: string | null` (nuevo) — consumido por Task 4 (`useSetFilter`) y Task 5 (`SetFilterSidebar`).

- [ ] **Step 1: Actualizar `SetFilterState` y `EMPTY_SET_FILTERS`**

Reemplazar:

```ts
export interface SetFilterState {
  search: string;
  gender: Gender | null;
  /** Nombres de `productTypes` (EAV) seleccionados — fuente de verdad para el filtro "Tipo de Producto". */
  productTypes: string[];
  brands: string[];
  /** Selección única (no array) — un color activo a la vez determina tanto el filtrado de
   * cards como qué portada por color se muestra (`resolveCardCover` en `CorporativoContent`). */
  colorId: string | null;
  sizes: string[];
  /** Estilos EAV seleccionados: slug de atributo → valores seleccionados. Ej: `{ corte: ['Regular'] }`. */
  selectedStyles: Record<string, string[]>;
}

export const EMPTY_SET_FILTERS: SetFilterState = {
  search: '',
  gender: null,
  productTypes: [],
  brands: [],
  colorId: null,
  sizes: [],
  selectedStyles: {},
};
```

por:

```ts
export interface SetFilterState {
  search: string;
  gender: Gender | null;
  /** Nombres de `productTypes` (EAV) seleccionados — fuente de verdad para el filtro "Tipo de Producto". */
  productTypes: string[];
  /** Selección única — id de marca activo, o null. */
  brandId: string | null;
  /** Selección única — id de colección activa, o null. Matchea si CUALQUIER pieza del set
   * pertenece a esta colección (unión, no intersección). */
  collectionId: string | null;
  /** Selección única (no array) — un color activo a la vez determina tanto el filtrado de
   * cards como qué portada por color se muestra (`resolveCardCover` en `CorporativoContent`). */
  colorId: string | null;
  sizes: string[];
  /** Estilos EAV seleccionados: slug de atributo → valores seleccionados. Ej: `{ corte: ['Regular'] }`. */
  selectedStyles: Record<string, string[]>;
}

export const EMPTY_SET_FILTERS: SetFilterState = {
  search: '',
  gender: null,
  productTypes: [],
  brandId: null,
  collectionId: null,
  colorId: null,
  sizes: [],
  selectedStyles: {},
};
```

- [ ] **Step 2: Actualizar `matchesSetFilters`**

Reemplazar el bloque de marca:

```ts
  if (filters.brands.length > 0 && (!set.brandName || !filters.brands.includes(set.brandName))) {
    return false;
  }
```

por:

```ts
  if (filters.brandId && set.brandId !== filters.brandId) {
    return false;
  }
  if (filters.collectionId && !set.collections.some((c) => c.id === filters.collectionId)) {
    return false;
  }
```

(mantener el resto de la función — `gender`, `productTypes`, `colorId`, `sizes`, `selectedStyles`, `search` — sin cambios).

- [ ] **Step 3: Actualizar `countActiveSetFilters`**

Reemplazar:

```ts
export function countActiveSetFilters(filters: SetFilterState): number {
  return (
    (filters.gender ? 1 : 0) +
    filters.productTypes.length +
    filters.brands.length +
    (filters.colorId ? 1 : 0) +
    filters.sizes.length +
    Object.values(filters.selectedStyles).reduce((sum, values) => sum + values.length, 0)
  );
}
```

por:

```ts
export function countActiveSetFilters(filters: SetFilterState): number {
  return (
    (filters.gender ? 1 : 0) +
    filters.productTypes.length +
    (filters.brandId ? 1 : 0) +
    (filters.collectionId ? 1 : 0) +
    (filters.colorId ? 1 : 0) +
    filters.sizes.length +
    Object.values(filters.selectedStyles).reduce((sum, values) => sum + values.length, 0)
  );
}
```

- [ ] **Step 4: Actualizar el helper `makeSet()` de `src/lib/__tests__/set-filter-logic.test.ts`**

Ese archivo ya existe y su helper `makeSet()` (líneas 12-38) construye un `CorporateSetSummary` completo por objeto literal — tras la Task 2, dejará de compilar porque le faltan `collections` y `brandLogoUrl`. Ningún test existente usa `filters.brands` (verificado — no hace falta migrar ningún caso de test a `brandId`/`collectionId`, aunque se puede considerar agregar cobertura nueva para `collectionId`/`brandId` como mejora, no es obligatorio para este plan). Editar el `return` de `makeSet()`:

```ts
    brandName: 'AllMedic',
    brandId: 'b1',
    productIds: ['p1', 'p2'],
```

agregando `brandLogoUrl: null,` justo después de `brandId: 'b1',`, y en el bloque donde está `productTypes: ['Camisas'],` agregar `collections: [],` inmediatamente después:

```ts
    brandName: 'AllMedic',
    brandId: 'b1',
    brandLogoUrl: null,
    productIds: ['p1', 'p2'],
    ...
    productTypes: ['Camisas'],
    collections: [],
```

Run: `npm run test -- src/lib/__tests__/set-filter-logic.test.ts`
Expected: los 12 tests existentes siguen pasando sin cambios en sus aserciones (el helper solo gana dos campos nuevos con valores neutros, ninguna lógica de test se modifica).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: nuevos errores esperados en `useSetFilter.ts` y `SetFilterSidebar.tsx` (Tasks 4 y 5 todavía no actualizados) por usar `filters.brands`. Ningún error debería quedar en `set-filter-logic.ts` mismo.

- [ ] **Step 6: Commit (sugerido, no ejecutar)**

```
feat(corporate): brandId y collectionId single-select en SetFilterState
```

---

### Task 4: `useSetFilter.ts` — derivar `brands` (con logo) y `collections`

**Files:**
- Modify: `src/hooks/useSetFilter.ts`

**Interfaces:**
- Consumes: `CorporateSetSummary.collections`/`brandLogoUrl`/`brandId` (Task 2), `SetFilterState` (Task 3).
- Produces: `SetFilterOptions` con `brands: { id: string; name: string; logoUrl: string | null }[]` y `collections: { id: string; name: string }[]` — consumido por Task 5 (`SetFilterSidebar`).

- [ ] **Step 1: Actualizar la interfaz `SetFilterOptions`**

Reemplazar:

```ts
export interface SetFilterOptions {
  /** Nombres de `productTypes` (EAV) presentes entre los sets recibidos — dinámico, sin opción muerta. */
  productTypes: string[];
  brands: string[];
  colors: ProductColor[];
  sizes: string[];
  styleOptions: SetStyleFilterOption[];
}
```

por:

```ts
export interface SetFilterOptions {
  /** Nombres de `productTypes` (EAV) presentes entre los sets recibidos — dinámico, sin opción muerta. */
  productTypes: string[];
  brands: { id: string; name: string; logoUrl: string | null }[];
  collections: { id: string; name: string }[];
  colors: ProductColor[];
  sizes: string[];
  styleOptions: SetStyleFilterOption[];
}
```

- [ ] **Step 2: Actualizar la derivación dentro de `useMemo`**

Reemplazar el bloque completo del `useMemo` de `filterOptions` (líneas 41-69 actuales):

```ts
  const filterOptions: SetFilterOptions = useMemo(() => {
    const productTypes = new Set<string>();
    const brands = new Set<string>();
    const colorMap = new Map<string, ProductColor>();
    const sizes = new Set<string>();
    const stylesMap = new Map<string, Set<string>>();
    for (const s of sets) {
      for (const t of s.productTypes) productTypes.add(t);
      if (s.brandName) brands.add(s.brandName);
      for (const c of s.colors) if (!colorMap.has(c.id)) colorMap.set(c.id, c);
      for (const sz of s.sizes) sizes.add(sz);
      for (const [slug, values] of Object.entries(s.availableStyles)) {
        if (!stylesMap.has(slug)) stylesMap.set(slug, new Set());
        for (const v of values) stylesMap.get(slug)!.add(v);
      }
    }
    const styleOptions: SetStyleFilterOption[] = Array.from(stylesMap.entries()).map(([slug, values]) => ({
      slug,
      label: slug.charAt(0).toUpperCase() + slug.slice(1),
      values: Array.from(values).sort(),
    }));
    return {
      productTypes: Array.from(productTypes).sort(),
      brands: Array.from(brands).sort(),
      colors: Array.from(colorMap.values()),
      sizes: Array.from(sizes),
      styleOptions,
    };
  }, [sets]);
```

por:

```ts
  const filterOptions: SetFilterOptions = useMemo(() => {
    const productTypes = new Set<string>();
    const brandsMap = new Map<string, { id: string; name: string; logoUrl: string | null }>();
    const collectionsMap = new Map<string, { id: string; name: string }>();
    const colorMap = new Map<string, ProductColor>();
    const sizes = new Set<string>();
    const stylesMap = new Map<string, Set<string>>();
    for (const s of sets) {
      for (const t of s.productTypes) productTypes.add(t);
      if (s.brandId && s.brandName && !brandsMap.has(s.brandId)) {
        brandsMap.set(s.brandId, { id: s.brandId, name: s.brandName, logoUrl: s.brandLogoUrl });
      }
      for (const c of s.collections) {
        if (!collectionsMap.has(c.id)) collectionsMap.set(c.id, c);
      }
      for (const c of s.colors) if (!colorMap.has(c.id)) colorMap.set(c.id, c);
      for (const sz of s.sizes) sizes.add(sz);
      for (const [slug, values] of Object.entries(s.availableStyles)) {
        if (!stylesMap.has(slug)) stylesMap.set(slug, new Set());
        for (const v of values) stylesMap.get(slug)!.add(v);
      }
    }
    const styleOptions: SetStyleFilterOption[] = Array.from(stylesMap.entries()).map(([slug, values]) => ({
      slug,
      label: slug.charAt(0).toUpperCase() + slug.slice(1),
      values: Array.from(values).sort(),
    }));
    return {
      productTypes: Array.from(productTypes).sort(),
      brands: Array.from(brandsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      collections: Array.from(collectionsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      colors: Array.from(colorMap.values()),
      sizes: Array.from(sizes),
      styleOptions,
    };
  }, [sets]);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores en `useSetFilter.ts`. Los errores restantes deberían estar únicamente en `SetFilterSidebar.tsx` (Task 5, todavía pendiente) y `SetCatalogGrid.tsx` si consume `filters.brands` directamente (verificar en Task 5).

- [ ] **Step 4: Commit (sugerido, no ejecutar)**

```
feat(corporate): derivar brands con logo y collections en useSetFilter
```

---

### Task 5: Reescribir `SetFilterSidebar.tsx` — acordeones, iconos, logos, colección

**Files:**
- Modify: `src/components/catalog/SetFilterSidebar.tsx`

**Interfaces:**
- Consumes: `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent` (`@/components/ui/accordion`), `SetFilterState`/`SetFilterOptions` (Tasks 3-4), iconos `Venus`/`Mars`/`VenusAndMars`/`Users`/`X`/`SlidersHorizontal`/`ChevronDownIcon` (ya viene con `Accordion`) de `lucide-react`.
- Produces: mismo export `SetFilterSidebar`/`SetFilterButton`, misma prop interface pública (sin cambios de firma externa).

- [ ] **Step 1: Reescribir el archivo completo**

Reemplazar el contenido completo de `src/components/catalog/SetFilterSidebar.tsx`:

```tsx
'use client';

import { X, SlidersHorizontal, Venus, Mars, VenusAndMars, Users } from 'lucide-react';
import type { SetFilterState } from '@/lib/set-filter-logic';
import type { SetFilterOptions } from '@/hooks/useSetFilter';
import type { Gender } from '@/lib/types';
import { ColorSwatch } from './ColorSwatch';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

interface SetFilterSidebarProps {
  filters: SetFilterState;
  filterOptions: SetFilterOptions;
  onFilterChange: (filters: Partial<SetFilterState>) => void;
  isOpen: boolean;
  onClose: () => void;
}

type ArrayFilterKey = 'productTypes' | 'sizes';

const GENDER_OPTIONS: { value: Gender | null; label: string; Icon: typeof Venus }[] = [
  { value: 'Mujer', label: 'Mujer', Icon: Venus },
  { value: 'Hombre', label: 'Hombre', Icon: Mars },
  { value: 'Unisex', label: 'Unisex', Icon: VenusAndMars },
  { value: null, label: 'Todos', Icon: Users },
];

export function SetFilterSidebar({ filters, filterOptions, onFilterChange, isOpen, onClose }: SetFilterSidebarProps) {
  const toggleArrayFilter = (key: ArrayFilterKey, value: string) => {
    const current = filters[key];
    const newValue = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onFilterChange({ [key]: newValue });
  };

  const toggleStyleValue = (slug: string, value: string) => {
    const current = filters.selectedStyles[slug] || [];
    const newValues = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onFilterChange({ selectedStyles: { ...filters.selectedStyles, [slug]: newValues } });
  };

  const clearFilters = () => {
    onFilterChange({
      gender: null,
      productTypes: [],
      brandId: null,
      collectionId: null,
      colorId: null,
      sizes: [],
      selectedStyles: {},
    });
  };

  const toggleColor = (colorId: string) => {
    onFilterChange({ colorId: filters.colorId === colorId ? null : colorId });
  };

  const toggleBrand = (brandId: string) => {
    onFilterChange({ brandId: filters.brandId === brandId ? null : brandId });
  };

  const toggleCollection = (collectionId: string) => {
    onFilterChange({ collectionId: filters.collectionId === collectionId ? null : collectionId });
  };

  const hasActiveFilters =
    filters.gender !== null ||
    filters.productTypes.length > 0 ||
    filters.brandId !== null ||
    filters.collectionId !== null ||
    filters.colorId !== null ||
    filters.sizes.length > 0 ||
    Object.values(filters.selectedStyles).some((values) => values.length > 0);

  const defaultOpenSections = ['gender', 'brand'];

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between p-4 border-b border-[#E5E5E5] lg:hidden">
        <h2 className="text-lg font-semibold">Filtros</h2>
        <button onClick={onClose} className="p-2 hover:bg-[#F5F5F7] rounded-full">
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="p-4 overflow-y-auto max-h-[calc(100vh-80px)] lg:max-h-none">
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-[#111111] underline transition-colors mb-4"
          >
            Limpiar todos los filtros
          </button>
        )}

        <Accordion type="multiple" defaultValue={defaultOpenSections} className="w-full">
          <AccordionItem value="gender">
            <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
              Género
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-2">
                {GENDER_OPTIONS.map(({ value, label, Icon }) => {
                  const isSelected = filters.gender === value;
                  return (
                    <button
                      key={label}
                      onClick={() => onFilterChange({ gender: value })}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm rounded border transition-colors duration-150',
                        isSelected
                          ? 'border-[#111111] bg-[#F5F5F7] text-[#111111] font-medium'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400'
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>

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
                          // eslint-disable-next-line @next/next/no-img-element -- logo externo, mismo patrón que BrandCarousel
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

          {filterOptions.collections.length > 0 && (
            <AccordionItem value="collection">
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                Colección
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.collections.map((collection) => {
                    const isSelected = filters.collectionId === collection.id;
                    return (
                      <button
                        key={collection.id}
                        onClick={() => toggleCollection(collection.id)}
                        className={cn(
                          'px-3 py-2 text-xs font-medium rounded border transition-colors duration-150',
                          isSelected
                            ? 'border-[#111111] bg-[#F5F5F7] text-[#111111]'
                            : 'border-gray-200 text-gray-500 hover:border-gray-400'
                        )}
                      >
                        {collection.name}
                      </button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {filterOptions.productTypes.length > 0 && (
            <AccordionItem value="productType">
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                Tipo de Producto
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {filterOptions.productTypes.map((productType) => (
                    <label key={productType} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.productTypes.includes(productType)}
                        onChange={() => toggleArrayFilter('productTypes', productType)}
                        className="w-4 h-4 accent-[#111111] rounded"
                      />
                      <span className="text-sm text-[#333333]">{productType}</span>
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

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

          {filterOptions.sizes.length > 0 && (
            <AccordionItem value="size">
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                Talla
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.sizes.map((size) => {
                    const isSelected = filters.sizes.includes(size);
                    return (
                      <button
                        key={size}
                        onClick={() => toggleArrayFilter('sizes', size)}
                        className={cn(
                          'min-w-[40px] h-9 px-2 text-sm font-medium rounded transition-all duration-200',
                          isSelected
                            ? 'bg-[#111111] text-white'
                            : 'border border-gray-200 text-[#333333] hover:border-[#111111]'
                        )}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Estilos EAV (ej. Corte) — un AccordionItem por cada atributo de estilo presente en
              los datos, no hardcodeado: soporta cualquier atributo que aparezca en `set.availableStyles`. */}
          {filterOptions.styleOptions.map((styleOption) => (
            <AccordionItem key={styleOption.slug} value={`style-${styleOption.slug}`}>
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                {styleOption.label}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {styleOption.values.map((value) => (
                    <label key={value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(filters.selectedStyles[styleOption.slug] || []).includes(value)}
                        onChange={() => toggleStyleValue(styleOption.slug, value)}
                        className="w-4 h-4 accent-[#111111] rounded"
                      />
                      <span className="text-sm text-[#333333]">{value}</span>
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden lg:block w-[280px] flex-shrink-0">
        <div className="sticky top-20 bg-white border border-[#E5E5E5] rounded-lg">{sidebarContent}</div>
      </aside>

      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div
          className={cn(
            'absolute left-0 top-0 h-full w-[320px] bg-white shadow-xl transition-transform duration-300',
            isOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  );
}

export function SetFilterButton({ onClick, count }: { onClick: () => void; count?: number }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden flex items-center gap-2 px-4 py-2 border border-[#E5E5E5] rounded-full text-sm font-medium hover:border-[#111111] transition-colors"
    >
      <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
      Filtros
      {count !== undefined && count > 0 && (
        <span className="ml-1 w-5 h-5 bg-[#111111] text-white text-xs rounded-full flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  );
}
```

**Nota de implementación sobre el fallback de logo:** el `<span>` de fallback se renderiza siempre en el DOM (oculto con `hidden` vía clase si hay `logoUrl`), y el `onError` de la imagen lo revela manipulando `classList` directamente — evita depender de un `useState` por cada botón de marca dentro de un `.map()` (violaría las reglas de hooks). Si en la verificación visual esto no revela el fallback correctamente al fallar la carga, alternativa: extraer un subcomponente `BrandFilterOption` con su propio `useState(false)` para `imgFailed`, uno por marca (patrón ya usado en otros componentes del proyecto, ej. `ProductCard`/`SetGridCard`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores en `SetFilterSidebar.tsx`. Verificar también que no queden errores en `SetCatalogGrid.tsx` (que consume `filters`/`filterOptions` pero no debería referenciar `brands`/`collections` directamente — solo los pasa como props).

- [ ] **Step 3: Lint**

Run: `npm run lint` (o `npx eslint src/components/catalog/SetFilterSidebar.tsx src/lib/corporate-data-service.ts src/lib/corporate-types.ts src/lib/set-filter-logic.ts src/hooks/useSetFilter.ts`)
Expected: sin errores nuevos. Prestar atención al uso de `<img>` nativo (puede disparar `@next/next/no-img-element` si el proyecto tiene esa regla activa — ya se dejó el comentario de supresión en el Step 1; confirmar si es necesario o si el proyecto no tiene esa regla habilitada, en cuyo caso se puede quitar el comentario).

- [ ] **Step 4: Commit (sugerido, no ejecutar)**

```
feat(catalog): rediseñar SetFilterSidebar con acordeones, iconos de genero, logos de marca y filtro de coleccion
```

---

### Task 6: Validación completa y checklist manual

**Files:** ninguno (solo validación).

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build exitoso, incluyendo `/` y `/corporativo`.

- [ ] **Step 2: Lint y typecheck completos**

Run: `npm run lint && npx tsc --noEmit`
Expected: sin errores nuevos en los archivos de este plan (los problemas de lint preexistentes en otros archivos del proyecto no son responsabilidad de este cambio).

- [ ] **Step 3: Test suite**

Run: `npm run test`
Expected: sin regresiones nuevas. Si Task 3 Step 4 encontró y actualizó tests de `set-filter-logic.ts`, confirmar que pasan.

- [ ] **Step 4: Checklist manual (`npm run dev`, revisar `/` y `/corporativo`)**

- [ ] Los 7 grupos de filtro (Género, Marca, Colección, Tipo de Producto, Color, Talla, estilos EAV) se renderizan como acordeones colapsables.
- [ ] Género y Marca aparecen expandidos por defecto; el resto colapsado.
- [ ] Abrir/cerrar un acordeón anima suavemente (sin saltos, sin duración perceptible como lenta).
- [ ] Género muestra los 4 iconos correctos (Venus/Mars/VenusAndMars/Users) y sigue siendo single-select.
- [ ] Marca muestra logos donde existen; marcas sin logo muestran el nombre como fallback; selección es single-select (clickear otra marca deselecciona la anterior).
- [ ] Colección aparece como filtro nuevo; filtrar por una colección muestra sets que tengan AL MENOS una pieza de esa colección (verificar con un set de piezas mixtas si existe en los datos de prueba).
- [ ] Tipo de Producto, Talla y estilos EAV siguen siendo multi-select (checkboxes), sin cambios de comportamiento.
- [ ] Contador de filtros activos (badge en `SetFilterButton`, mobile) refleja correctamente género + marca + colección + color + tallas + estilos.
- [ ] "Limpiar todos los filtros" resetea los 7 grupos, incluyendo marca y colección.
- [ ] Comportamiento idéntico en `/` y `/corporativo` (mismo componente compartido, sin diferencias).
- [ ] Mobile (~390px): drawer de filtros abre/cierra igual que antes, acordeones funcionan dentro del drawer.
- [ ] `/catalogo` (retail individual): sin cambios — sigue usando `HierarchicalFilter.tsx`, no tocado.
- [ ] `/admin`: sin cambios visuales.

- [ ] **Step 5: Commit final combinado (sugerido, no ejecutar)**

```
feat(catalog): rediseñar filtros de sets corporativos

Agrega logo de marca y coleccion agregada a getActiveCorporateSets,
extiende CorporateSetSummary, convierte brandId/collectionId a
single-select en SetFilterState, y reescribe SetFilterSidebar con
acordeones colapsables (Radix), iconos de genero (lucide-react) y
cards de marca con logo. Aplica automaticamente a home y /corporativo
via el componente compartido SetCatalogGrid.
```

---

## Self-Review (completado por el autor del plan)

- **Cobertura de spec:** acordeones colapsables (Task 5) ✓; iconos de género (Task 5) ✓; logos de marca con fallback a texto (Tasks 1, 4, 5) ✓; filtro de colección nuevo con unión de piezas (Tasks 1, 2, 3, 4, 5) ✓; single-select en marca/colección (Task 3) ✓; Tipo de Producto/Talla/estilos EAV mantienen multi-select (Task 5, sin cambios de lógica en esos bloques) ✓; motion reutiliza animación existente sin CSS nuevo (Task 5, sin `@keyframes` agregados) ✓; `/catalogo` no tocado (ninguna task lo modifica) ✓.
- **Placeholders:** ninguno en el código de cada step — todo es pegable tal cual. La única nota de "alternativa si no funciona" (Task 5, fallback de logo) documenta una decisión de implementación con solución concreta de respaldo, no un placeholder sin resolver.
- **Consistencia de tipos:** `brandId`/`collectionId: string | null` se usan idénticamente en `set-filter-logic.ts`, `useSetFilter.ts` y `SetFilterSidebar.tsx`. `{ id: string; name: string; logoUrl: string | null }` (marca) y `{ id: string; name: string }` (colección) coinciden entre `CorporateSetSummary`, `SetFilterOptions` y su uso en el sidebar.
- **Orden de ejecución:** estrictamente secuencial — cada task depende de que la anterior haya extendido el tipo/dato que consume (Task 1 → datos crudos; Task 2 → tipo público; Task 3 → estado de filtro; Task 4 → opciones derivadas; Task 5 → UI; Task 6 → validación). No hay tasks paralelizables sin romper esta cadena de dependencias de tipos.

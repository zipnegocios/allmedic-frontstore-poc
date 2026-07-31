# Reemplazar productos individuales por sets corporativos en Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar ambas secciones de productos individuales en la home (`/`) por sets corporativos, reutilizando y extrayendo la experiencia de catálogo ya existente en `/corporativo`.

**Architecture:** Extraer dos piezas hoy acopladas a `CorporativoContent.tsx` (`SetGridCard` y el bloque de filtros+grid+paginación) a componentes compartidos, reutilizarlos en `Home.tsx`, y ampliar `getActiveCorporateSets()` con un filtro opcional de destacados. Home pasa a ser `force-dynamic` (mismo motivo que `/corporativo`: reglas de negocio son datos en vivo).

**Tech Stack:** Next.js (App Router), React client components, Drizzle ORM, TypeScript, Tailwind. Sin librería de testing de componentes en este repo (la suite `vitest` cubre solo lógica pura en `.test.ts`); verificación vía build/lint/typecheck + checklist manual.

## Global Constraints

- No se crea una función nueva para sets destacados — se amplía `getActiveCorporateSets()` con un parámetro opcional (spec, sección "Cambios de datos").
- `getAllProducts()` **no se toca** — la siguen usando `catalogo/page.tsx`, `p/[slug]/page.tsx`, `layout.tsx` (spec, "Decisiones cerradas" punto 4).
- Código que quede sin consumidores tras el cambio se elimina, previa verificación por grep (spec, "Decisiones cerradas" punto 4): `getFeaturedProducts()`, `FilterableProductSection.tsx`, función `FeaturedProductsSection` inline.
- `SetGridCard` y el bloque de filtros/grid/paginación se extraen sin cambios de lógica — solo recorte/reubicación (spec, "Extracción de componentes reutilizables").
- Prohibido: `git commit`, `git push`, creación de PRs (CLAUDE.md del repo) — el trabajo queda en el working tree; al final se sugiere el mensaje de commit.
- No usar Chrome DevTools MCP para ninguna verificación (CLAUDE.md del repo).

---

## Contexto de archivos relevantes (antes de empezar)

**`src/lib/corporate-data-service.ts:157-345`** — `getActiveCorporateSets()` actual, sin parámetros, retorna `Promise<CorporateSetSummary[]>`. El `where` de la query principal (línea 175) es:
```ts
.where(and(eq(corporateSetsTable.isActive, true), isNull(corporateSetsTable.deletedAt)))
```

**`src/app/(store)/corporativo/CorporativoContent.tsx`** — 408 líneas. Estructura:
- Líneas 1-18: imports.
- Líneas 30-158: función `SetGridCard` (local, no exportada).
- Líneas 160-193: inicio de `CorporativoContent`, hooks (`isFilterOpen`, `viewMode`, `useSetFilter`, `showPricesFor`).
- Líneas 194-209: hero "Catálogo Corporativo" (específico de esta página, NO se extrae).
- Líneas 211-404: bloque de filtros + búsqueda + grid + paginación (SÍ se extrae).

**`src/app/(store)/corporativo/page.tsx`** — patrón de datos a replicar en home:
```ts
const [sets, rules] = await Promise.all([
  getActiveCorporateSets(),
  getAllBusinessRules(),
]);
const resolved = resolveRules(rules, {});
const priceVisibilityRules = rules.filter((r) => r.ruleType === 'PRICE_VISIBILITY');
// uso: minQuantity={resolved.minQuantity.min}
```

**`src/legacy-pages/Home.tsx`** — 256 líneas. `Home({ heroSlides, featuredProducts, allProducts, brands })` renderiza en orden: `HeroCarousel` → `CorporateCTA` → `QuickAccessCards` → `FilterableProductSection` (si `allProducts`) → `BrandCarousel` → `FeaturedProductsSection` (si `featuredProducts`).

**`src/app/(store)/page.tsx`** — actual, sin `force-dynamic`:
```ts
import { Footer } from '@/components/layout/Footer';
import { Home } from '@/legacy-pages/Home';
import { getFeaturedProducts, getHeroSlides, getAllProducts, getBrandsForNav } from '@/lib/data-service';
import { getStores } from '@/lib/data-service';

export default async function HomePage() {
  const [featuredProducts, heroSlides, stores, allProducts, brands] = await Promise.all([
    getFeaturedProducts(),
    getHeroSlides(),
    getStores(),
    getAllProducts(),
    getBrandsForNav(),
  ]);

  return (
    <div className="min-h-screen bg-white">
      <Home heroSlides={heroSlides} featuredProducts={featuredProducts} allProducts={allProducts} brands={brands} />
      <Footer stores={stores} />
    </div>
  );
}
```

---

### Task 1: Filtro `featuredOnly` en `getActiveCorporateSets()`

**Files:**
- Modify: `src/lib/corporate-data-service.ts:157-176`

**Interfaces:**
- Produces: `getActiveCorporateSets(queryOptions?: { featuredOnly?: boolean }): Promise<CorporateSetSummary[]>` — firma que consumen las Tasks 4 y 5. (Nota de implementación: el parámetro se nombra `queryOptions`, no `options`, porque la función ya tenía una variable local `const options = ...` para las opciones de bloques del set — `options` habría colisionado por shadowing.)

- [ ] **Step 1: Modificar la firma y el `where` de la query**

En `src/lib/corporate-data-service.ts`, reemplazar:

```ts
export async function getActiveCorporateSets(): Promise<CorporateSetSummary[]> {
  const rows = await db
    .select({
      id: corporateSetsTable.id,
      slug: corporateSetsTable.slug,
      name: corporateSetsTable.name,
      description: corporateSetsTable.description,
      brandName: brandsTable.name,
      brandId: corporateSetsTable.brandId,
      isFeatured: corporateSetsTable.isFeatured,
      sortOrder: corporateSetsTable.sortOrder,
      priceManual: corporateSetsTable.priceManual,
      priceManualSale: corporateSetsTable.priceManualSale,
      manualDiscountEnd: corporateSetsTable.manualDiscountEnd,
      createdAt: corporateSetsTable.createdAt,
    })
    .from(corporateSetsTable)
    .leftJoin(brandsTable, eq(corporateSetsTable.brandId, brandsTable.id))
    .where(and(eq(corporateSetsTable.isActive, true), isNull(corporateSetsTable.deletedAt)))
    .orderBy(asc(corporateSetsTable.sortOrder));
```

por:

```ts
export async function getActiveCorporateSets(queryOptions?: { featuredOnly?: boolean }): Promise<CorporateSetSummary[]> {
  const baseConditions = [eq(corporateSetsTable.isActive, true), isNull(corporateSetsTable.deletedAt)];
  if (queryOptions?.featuredOnly) {
    baseConditions.push(eq(corporateSetsTable.isFeatured, true));
  }

  const rows = await db
    .select({
      id: corporateSetsTable.id,
      slug: corporateSetsTable.slug,
      name: corporateSetsTable.name,
      description: corporateSetsTable.description,
      brandName: brandsTable.name,
      brandId: corporateSetsTable.brandId,
      isFeatured: corporateSetsTable.isFeatured,
      sortOrder: corporateSetsTable.sortOrder,
      priceManual: corporateSetsTable.priceManual,
      priceManualSale: corporateSetsTable.priceManualSale,
      manualDiscountEnd: corporateSetsTable.manualDiscountEnd,
      createdAt: corporateSetsTable.createdAt,
    })
    .from(corporateSetsTable)
    .leftJoin(brandsTable, eq(corporateSetsTable.brandId, brandsTable.id))
    .where(and(...baseConditions))
    .orderBy(asc(corporateSetsTable.sortOrder));
```

El resto de la función (líneas 178-345 actuales) no cambia — sigue operando sobre `rows`/`setIds` igual que antes.

- [ ] **Step 2: Typecheck del archivo**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `corporate-data-service.ts`.

- [ ] **Step 3: Commit (sugerido, no ejecutar)**

```
feat(corporate): agregar filtro featuredOnly a getActiveCorporateSets
```

---

### Task 2: Extraer `SetGridCard` a componente propio

**Files:**
- Create: `src/components/catalog/SetGridCard.tsx`
- Modify: `src/app/(store)/corporativo/CorporativoContent.tsx`

**Interfaces:**
- Consumes: `resolveCardCover` (`@/lib/resolve-card-cover`), `MediaGridThumb` (`@/components/media/MediaGridThumb`), `ColorFallbackBadge`, `ColorSwatch` (mismo directorio), `CorporateSetSummary` (`@/lib/corporate-types`), `LiquidFillLoader` (`@/components/ui/LiquidFillLoader`).
- Produces: `export function SetGridCard({ set, activeColorId, showPrices }: { set: CorporateSetSummary; activeColorId: string | null; showPrices: boolean }): JSX.Element` — consumida por Task 3 (`SetCatalogGrid`) y Task 5 (`Home.tsx`).

- [ ] **Step 1: Crear el archivo nuevo con el contenido recortado**

Crear `src/components/catalog/SetGridCard.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Star } from 'lucide-react';
import type { CorporateSetSummary } from '@/lib/corporate-types';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import { ColorFallbackBadge } from '@/components/catalog/ColorFallbackBadge';
import { ColorSwatch } from '@/components/catalog/ColorSwatch';
import { LiquidFillLoader } from '@/components/ui/LiquidFillLoader';
import { resolveCardCover } from '@/lib/resolve-card-cover';

interface SetGridCardProps {
  set: CorporateSetSummary;
  activeColorId: string | null;
  showPrices: boolean;
}

/** Card del grid — extraída para poder trackear `isImageLoading` (barra líquida) por set
 * individual mientras se descarga la portada del color recién filtrado, sin violar las reglas
 * de hooks (no se puede usar `useState` dentro del `.map()` del padre). */
export function SetGridCard({ set, activeColorId, showPrices }: SetGridCardProps) {
  // Color elegido al clickear un swatch dentro de esta card. Si el filtro lateral
  // (prop activeColorId) cambia, debe primar sobre la selección local — mismo patrón
  // "durante el render" que ProductCard.tsx (sin useEffect, evita el render en cascada
  // de un setState síncrono dentro de un efecto).
  const [localColorId, setLocalColorId] = useState<string | null>(activeColorId);
  const [trackedFilterColor, setTrackedFilterColor] = useState(activeColorId);
  if (activeColorId !== trackedFilterColor) {
    setTrackedFilterColor(activeColorId);
    setLocalColorId(activeColorId);
  }

  const effectiveColorId = localColorId;
  const { cover, secondaryCover, isFallback } = resolveCardCover(set, effectiveColorId);
  const fallbackColor = isFallback ? set.colors.find((c) => c.id === effectiveColorId) : undefined;

  // Reinicio "durante el render" (sin useEffect) al cambiar la URL de portada — mismo patrón
  // que SetListItem.tsx, evita el render en cascada de un setState síncrono dentro de un efecto.
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [trackedCoverUrl, setTrackedCoverUrl] = useState(cover?.url);
  if (cover?.url !== trackedCoverUrl) {
    setTrackedCoverUrl(cover?.url);
    setIsImageLoading(true);
  }

  return (
    <Link
      href={`/corporativo/s/${set.slug}`}
      className="group border border-[#E5E5E5] rounded-xl overflow-hidden hover:shadow-lg transition-shadow bg-white"
    >
      <div className="relative aspect-product bg-[#F5F5F7] overflow-hidden">
        {cover ? (
          <>
            {isImageLoading && cover.type !== 'video' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#F5F5F7] z-[2] px-8">
                <LiquidFillLoader />
              </div>
            )}
            <MediaGridThumb
              item={cover}
              fallback="/images/placeholder-product.jpg"
              alt={set.name}
              fit="cover"
              className={`object-cover transition-opacity duration-300 ${secondaryCover ? 'group-hover:opacity-0' : 'group-hover:scale-105 transition-transform duration-500'} ${isImageLoading ? 'opacity-0' : ''}`}
              sizes="400px"
              onLoad={() => setIsImageLoading(false)}
              onError={() => setIsImageLoading(false)}
            />
            {secondaryCover && (
              <MediaGridThumb
                item={secondaryCover}
                fallback="/images/placeholder-product.jpg"
                alt={set.name}
                fit="cover"
                className="absolute inset-0 object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                sizes="400px"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Building2 className="w-12 h-12" strokeWidth={1} />
          </div>
        )}
        {set.isFeatured && (
          <span className="absolute top-3 left-3 flex items-center gap-1 bg-white/90 text-xs font-medium px-2 py-1 rounded-full">
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
            Destacado
          </span>
        )}
        {fallbackColor && (
          <ColorFallbackBadge colorHex={fallbackColor.hex} colorName={fallbackColor.name} />
        )}
      </div>
      <div className="p-4">
        {set.brandName && (
          <p className="font-sans text-body-sm uppercase tracking-badge text-gray-400 mb-1">{set.brandName}</p>
        )}
        <h3 className="font-sans text-body-md font-normal text-[#111111] mb-1">{set.name}</h3>
        <p className="font-sans text-body-sm text-gray-500 mb-3">
          {set.pieceCount} {set.pieceCount === 1 ? 'pieza' : 'piezas'}
        </p>
        {showPrices &&
          (set.referencePrice !== null ? (
            <div>
              <span className="font-sans text-body-md font-medium text-[#111111]">${set.referencePrice.toFixed(2)}</span>
              <span className="font-sans text-body-xs text-gray-400 ml-1">/ set referencial</span>
              {set.hasMissingPrices && (
                <span className="flex items-center gap-1 font-sans text-body-xs text-amber-600 mt-1">
                  <AlertTriangle className="w-3 h-3" /> Precio parcial
                </span>
              )}
            </div>
          ) : (
            <span className="font-sans text-body-sm text-gray-400">Precio bajo cotización</span>
          ))}
        {set.colors.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {set.colors.slice(0, 5).map(color => (
              <div
                key={color.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLocalColorId(color.id);
                }}
              >
                <ColorSwatch color={color} size="sm" isSelected={effectiveColorId === color.id} />
              </div>
            ))}
            {set.colors.length > 5 && (
              <span className="font-sans text-body-xs text-gray-400 flex items-center">
                +{set.colors.length - 5}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
```

Nota: el JSX usa `AlertTriangle` (icono de "Precio parcial") — agregarlo al import de `lucide-react` en la línea de imports: `import { Building2, Star, AlertTriangle } from 'lucide-react';` (reemplazar el `import { Building2, Star } from 'lucide-react';` de arriba por esta versión completa).

- [ ] **Step 2: Quitar `SetGridCard` de `CorporativoContent.tsx` y consumir el import**

En `src/app/(store)/corporativo/CorporativoContent.tsx`:

1. Eliminar la función `SetGridCard` completa (líneas 30-158 actuales, desde el comentario `/** Card del grid ... */` hasta el `}` de cierre de la función).
2. Eliminar de los imports lo que ya no se usa directamente en este archivo tras quitar `SetGridCard`: `Building2` sigue usándose (hero, empty state del grid no — verificar), `Star`, `AlertTriangle`, `ColorFallbackBadge`, `ColorSwatch`, `LiquidFillLoader`, `MediaGridThumb`, `resolveCardCover` pasan a usarse solo dentro de `SetGridCard.tsx`. **No eliminar nada del import todavía** — Task 3 mueve el resto del archivo también, así que la limpieza de imports se hace al final de Task 3, no aquí, para no dejar el archivo en un estado intermedio roto.
3. Agregar el import del componente extraído: `import { SetGridCard } from '@/components/catalog/SetGridCard';`

- [ ] **Step 3: Typecheck (se espera que siga habiendo errores hasta completar Task 3 — no ejecutar aún)**

Este step se omite intencionalmente aquí: `CorporativoContent.tsx` queda en estado intermedio (usa `SetGridCard` importado pero el resto del archivo — hero + bloque de filtros — sigue en el mismo archivo). El typecheck completo se corre al final de Task 3.

- [ ] **Step 4: Commit (sugerido, no ejecutar)**

```
refactor(catalog): extraer SetGridCard a componente propio reutilizable
```

---

### Task 3: Extraer bloque de filtros+grid+paginación a `SetCatalogGrid`

**Files:**
- Create: `src/components/catalog/SetCatalogGrid.tsx`
- Modify: `src/app/(store)/corporativo/CorporativoContent.tsx`

**Interfaces:**
- Consumes: `SetGridCard` (Task 2), `SetListItem` (`@/components/catalog/SetListItem`, sin cambios), `SetFilterSidebar`/`SetFilterButton` (`@/components/catalog/SetFilterSidebar`), `LayoutSwitcher`/`ViewMode` (`@/components/catalog/LayoutSwitcher`), `useSetFilter` (`@/hooks/useSetFilter`), `SetSortOption` (`@/lib/set-filter-logic`), `resolveRules`/`BusinessRule` (`@/lib/rules-engine`), `cn` (`@/lib/utils`), `CorporateSetSummary` (`@/lib/corporate-types`).
- Produces: `export function SetCatalogGrid({ sets, priceVisibilityRules, minQuantity }: SetCatalogGridProps): JSX.Element` — consumido por Task 3 Step 2 (`CorporativoContent`) y Task 5 (`Home.tsx`).

```ts
interface SetCatalogGridProps {
  sets: CorporateSetSummary[];
  priceVisibilityRules: BusinessRule[];
  minQuantity: number;
}
```

- [ ] **Step 1: Crear `src/components/catalog/SetCatalogGrid.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CorporateSetSummary } from '@/lib/corporate-types';
import { resolveRules, type BusinessRule } from '@/lib/rules-engine';
import { LayoutSwitcher, type ViewMode } from '@/components/catalog/LayoutSwitcher';
import { SetFilterSidebar, SetFilterButton } from '@/components/catalog/SetFilterSidebar';
import { SetListItem } from '@/components/catalog/SetListItem';
import { SetGridCard } from '@/components/catalog/SetGridCard';
import { useSetFilter } from '@/hooks/useSetFilter';
import type { SetSortOption } from '@/lib/set-filter-logic';

interface SetCatalogGridProps {
  sets: CorporateSetSummary[];
  priceVisibilityRules: BusinessRule[];
  minQuantity: number;
}

// `minQuantity` se recibe para mantener la misma prop interface que CorporativoContent,
// pero no se usa dentro del grid (solo aparece en el hero de /corporativo).
export function SetCatalogGrid({ sets, priceVisibilityRules }: SetCatalogGridProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid-4');

  const {
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
  } = useSetFilter(sets);

  const showPricesFor = (set: CorporateSetSummary): boolean => {
    const resolved = resolveRules(priceVisibilityRules, {
      setId: set.id,
      brandId: set.brandId,
      productIds: set.productIds,
    });
    return (
      resolved.priceVisibility.showPrices &&
      (resolved.priceVisibility.catalog === 'CORPORATE' || resolved.priceVisibility.catalog === 'BOTH')
    );
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#E5E5E5]">
        <div className="flex items-center gap-4">
          <SetFilterButton
            onClick={() => setIsFilterOpen(true)}
            count={activeFilterCount > 0 ? activeFilterCount : undefined}
          />
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="hidden sm:flex items-center gap-1 text-sm text-gray-500 hover:text-[#111111] transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 hidden sm:inline">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SetSortOption)}
              className="text-sm border border-[#E5E5E5] rounded-lg px-3 py-2 focus:outline-none focus:border-[#111111]"
            >
              <option value="relevance">Relevancia</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="newest">Más recientes</option>
            </select>
          </div>

          <div className="hidden sm:block">
            <LayoutSwitcher
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              totalItems={totalSets}
              showAllColumns={true}
            />
          </div>
          <div className="sm:hidden">
            <LayoutSwitcher
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              totalItems={totalSets}
              showAllColumns={false}
            />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => applyFilters({ search: e.target.value })}
            placeholder="Buscar en resultados..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111] transition-colors"
          />
          {filters.search && (
            <button
              onClick={() => applyFilters({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
            >
              <X className="w-3 h-3 text-gray-400" strokeWidth={1.5} />
            </button>
          )}
        </div>
        {filters.search && (
          <p className="text-xs text-gray-500 mt-2">
            {totalSets} resultado{totalSets !== 1 ? 's' : ''} para &quot;{filters.search}&quot;
          </p>
        )}
      </div>

      <div className="flex gap-8">
        <SetFilterSidebar
          filters={filters}
          filterOptions={filterOptions}
          onFilterChange={applyFilters}
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
        />

        <div className="flex-1">
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
            <>
              <div
                className={cn(
                  'grid gap-4 md:gap-6',
                  viewMode === 'grid-4' && 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
                  viewMode === 'grid-3' && 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3',
                  viewMode === 'grid-2' && 'grid-cols-2 lg:grid-cols-2',
                  viewMode === 'grid-1' && 'grid-cols-1 sm:grid-cols-2',
                  viewMode === 'list' && 'grid-cols-1'
                )}
              >
                {paginatedSets.map((set) =>
                  viewMode === 'list' ? (
                    <SetListItem key={set.id} set={set} showPrices={showPricesFor(set)} activeColorId={filters.colorId} />
                  ) : (
                    <SetGridCard key={set.id} set={set} activeColorId={filters.colorId} showPrices={showPricesFor(set)} />
                  )
                )}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#E5E5E5]">
                  <p className="text-sm text-gray-500">
                    Mostrando{' '}
                    <span className="font-medium text-[#111111]">{(currentPage - 1) * itemsPerPage + 1}</span>{' '}
                    -{' '}
                    <span className="font-medium text-[#111111]">
                      {Math.min(currentPage * itemsPerPage, totalSets)}
                    </span>{' '}
                    de <span className="font-medium text-[#111111]">{totalSets}</span> sets
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={cn(
                        'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-[#111111] hover:bg-[#F5F5F7]'
                      )}
                    >
                      <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                      <span className="hidden sm:inline">Anterior</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;

                        return (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            className={cn(
                              'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                              currentPage === pageNum ? 'bg-[#111111] text-white' : 'text-[#111111] hover:bg-[#F5F5F7]'
                            )}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={cn(
                        'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-[#111111] hover:bg-[#F5F5F7]'
                      )}
                    >
                      <span className="hidden sm:inline">Siguiente</span>
                      <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
```

**Nota importante sobre `minQuantity`:** en `CorporativoContent.tsx` original, `minQuantity` solo se usa en el hero (`Compra mínima: {minQuantity} sets`), NO dentro del bloque que se extrae aquí. Por eso este componente recibe la prop en `SetCatalogGridProps` (para cumplir la interfaz acordada en la spec, y porque quien lo invoque sigue pasándola) pero **no la destructura** en la firma de la función — así ESLint (`@typescript-eslint/no-unused-vars`, sin excepción configurada para prefijo `_` en este proyecto) no la marca como no usada. Si en el futuro se necesita mostrarla también en el grid, ya está disponible en la interfaz.

- [ ] **Step 2: Reescribir `CorporativoContent.tsx` completo, usando `SetCatalogGrid`**

Reemplazar el contenido completo de `src/app/(store)/corporativo/CorporativoContent.tsx` por:

```tsx
'use client';

import { Building2 } from 'lucide-react';
import type { CorporateSetSummary } from '@/lib/corporate-types';
import type { BusinessRule } from '@/lib/rules-engine';
import { SetCatalogGrid } from '@/components/catalog/SetCatalogGrid';

interface CorporativoContentProps {
  sets: CorporateSetSummary[];
  /** Solo las reglas PRICE_VISIBILITY — se resuelven por set en el cliente (loop en memoria). */
  priceVisibilityRules: BusinessRule[];
  minQuantity: number;
}

export function CorporativoContent({ sets, priceVisibilityRules, minQuantity }: CorporativoContentProps) {
  return (
    <main className="pt-14 sm:pt-16 min-h-screen">
      {/* Header */}
      <section className="bg-[#111111] py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-3">
            <Building2 className="w-4 h-4" strokeWidth={1.5} />
            <span>Ventas al Mayor / Compras Corporativas</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Catálogo Corporativo</h1>
          <p className="text-white/70 max-w-2xl">
            Sets de uniformes para instituciones, hospitales y clínicas. Precios referenciales sujetos a
            cotización formal. Compra mínima: <strong>{minQuantity} sets</strong>.
          </p>
        </div>
      </section>

      <SetCatalogGrid sets={sets} priceVisibilityRules={priceVisibilityRules} minQuantity={minQuantity} />
    </main>
  );
}
```

- [ ] **Step 3: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: sin errores en `CorporativoContent.tsx`, `SetCatalogGrid.tsx`, `SetGridCard.tsx`.

- [ ] **Step 4: Lint de los tres archivos**

Run: `npm run lint`
Expected: sin errores nuevos en los tres archivos (verificar en particular que no queden imports sin usar tras la reescritura de `CorporativoContent.tsx`).

- [ ] **Step 5: Verificación manual de `/corporativo` sin regresión**

Con `npm run dev` corriendo, visitar `/corporativo` y confirmar: hero se ve igual que antes, filtros/búsqueda/paginación/grid funcionan igual que antes del refactor (comportamiento idéntico, solo cambió dónde vive el código).

- [ ] **Step 6: Commit (sugerido, no ejecutar)**

```
refactor(catalog): extraer SetCatalogGrid de CorporativoContent para reutilizar en home
```

---

### Task 4: `force-dynamic` + datos de sets en `src/app/(store)/page.tsx`

**Files:**
- Modify: `src/app/(store)/page.tsx`

**Interfaces:**
- Consumes: `getActiveCorporateSets` (Task 1, `@/lib/corporate-data-service`), `getAllBusinessRules` (`@/lib/corporate-data-service`), `resolveRules` (`@/lib/rules-engine`), `getHeroSlides`/`getStores`/`getBrandsForNav` (`@/lib/data-service`, sin cambios).
- Produces: pasa a `Home` (Task 5) las props `heroSlides`, `featuredSets`, `allSets`, `priceVisibilityRules`, `minQuantity`, `brands`.

- [ ] **Step 1: Reescribir `src/app/(store)/page.tsx`**

```tsx
import { Footer } from '@/components/layout/Footer';
import { Home } from '@/legacy-pages/Home';
import { getHeroSlides, getStores, getBrandsForNav } from '@/lib/data-service';
import { getActiveCorporateSets, getAllBusinessRules } from '@/lib/corporate-data-service';
import { resolveRules } from '@/lib/rules-engine';

// Precios y reglas son datos en vivo — nunca pre-renderizar en build-time
// (evita fallos de build cuando DATABASE_URL solo está disponible en runtime, ej. Docker/EasyPanel).
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [featuredSets, allSets, heroSlides, stores, brands, rules] = await Promise.all([
    getActiveCorporateSets({ featuredOnly: true }),
    getActiveCorporateSets(),
    getHeroSlides(),
    getStores(),
    getBrandsForNav(),
    getAllBusinessRules(),
  ]);

  const resolved = resolveRules(rules, {});
  const priceVisibilityRules = rules.filter((r) => r.ruleType === 'PRICE_VISIBILITY');

  return (
    <div className="min-h-screen bg-white">
      <Home
        heroSlides={heroSlides}
        featuredSets={featuredSets}
        allSets={allSets}
        priceVisibilityRules={priceVisibilityRules}
        minQuantity={resolved.minQuantity.min}
        brands={brands}
      />
      <Footer stores={stores} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errores esperados en este punto SOLO por la firma de `Home` (todavía no actualizada — se corrige en Task 5). Si aparecen errores en otras líneas de `page.tsx`, detenerse y reportar.

- [ ] **Step 3: Commit (sugerido, no ejecutar)**

```
feat(home): traer sets corporativos y reglas de precio en page.tsx
```

---

### Task 5: Reescribir `Home.tsx` con secciones de sets

**Files:**
- Modify: `src/legacy-pages/Home.tsx`

**Interfaces:**
- Consumes: `SetGridCard` (Task 2), `SetCatalogGrid` (Task 3), `CorporateSetSummary`/`BusinessRule` (tipos).
- Produces: `Home({ heroSlides, featuredSets, allSets, priceVisibilityRules, minQuantity, brands })` — firma consumida por `page.tsx` (Task 4, ya escrito). Al remover el uso de `FilterableProductSection`/`getFeaturedProducts` de este archivo, Task 6 podrá eliminarlos por completo del proyecto.

- [ ] **Step 1: Reemplazar imports**

En `src/legacy-pages/Home.tsx`, reemplazar:

```tsx
import { ProductCard } from '@/components/catalog/ProductCard';
import { ProductListItem } from '@/components/catalog/LayoutSwitcher';
import type { ViewMode } from '@/components/catalog/LayoutSwitcher';
import { LayoutSwitcher } from '@/components/catalog/LayoutSwitcher';
import { FilterableProductSection } from '@/components/home/FilterableProductSection';
import { BrandCarousel } from '@/components/home/BrandCarousel';
import { CorporateCTA } from '@/components/home/CorporateCTA';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import type { Product, MediaItem, BrandNavItem } from '@/lib/types';
```

por:

```tsx
import type { ViewMode } from '@/components/catalog/LayoutSwitcher';
import { LayoutSwitcher } from '@/components/catalog/LayoutSwitcher';
import { SetGridCard } from '@/components/catalog/SetGridCard';
import { SetCatalogGrid } from '@/components/catalog/SetCatalogGrid';
import { BrandCarousel } from '@/components/home/BrandCarousel';
import { CorporateCTA } from '@/components/home/CorporateCTA';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import type { MediaItem, BrandNavItem } from '@/lib/types';
import type { CorporateSetSummary } from '@/lib/corporate-types';
import type { BusinessRule } from '@/lib/rules-engine';
```

(Se elimina `ProductCard`, `ProductListItem`, `FilterableProductSection`, `Product` — sin uso tras el cambio. Se agrega `SetGridCard`, `SetCatalogGrid`, `CorporateSetSummary`, `BusinessRule`.)

- [ ] **Step 2: Reemplazar `FeaturedProductsSection` por `FeaturedSetsSection`**

Reemplazar la función completa (líneas 194-241 actuales):

```tsx
// Featured Products Section Component
function FeaturedProductsSection({ products }: { products: Product[] }) {
  // Default to 4 columns on desktop, 2 columns on mobile (handled by responsive classes)
  const [viewMode, setViewMode] = useState<ViewMode>('grid-4');
  const [itemsPerPage, setItemsPerPage] = useState<number>(8);
  const displayedProducts = products.slice(0, itemsPerPage);

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="font-display uppercase text-h2-mobile md:text-h2">Lo más solicitado</h2>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <LayoutSwitcher viewMode={viewMode} onViewModeChange={setViewMode} itemsPerPage={itemsPerPage} onItemsPerPageChange={setItemsPerPage} totalItems={products.length} showAllColumns={true} />
            </div>
            <div className="sm:hidden">
              <LayoutSwitcher viewMode={viewMode} onViewModeChange={setViewMode} itemsPerPage={itemsPerPage} onItemsPerPageChange={setItemsPerPage} totalItems={products.length} showAllColumns={false} />
            </div>
            <Link href="/catalogo" className="hidden sm:flex items-center gap-1 text-sm font-medium text-[#333333] hover:text-[#111111] transition-colors">
              Ver todo <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
        <div className={cn(
          'grid gap-4 md:gap-6',
          viewMode === 'grid-4' && 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4',
          viewMode === 'grid-3' && 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3',
          viewMode === 'grid-2' && 'grid-cols-2 lg:grid-cols-2',
          viewMode === 'grid-1' && 'grid-cols-1 sm:grid-cols-2',
          viewMode === 'list' && 'grid-cols-1'
        )}>
          {displayedProducts.map(product => (
            viewMode === 'list' ? (
              <ProductListItem key={product.id} product={product} onQuickView={() => {}} />
            ) : (
              <ProductCard key={product.id} product={product} />
            )
          ))}
        </div>
        <div className="mt-6 sm:hidden">
          <Link href="/catalogo" className="flex items-center justify-center gap-1 text-sm font-medium text-[#333333] hover:text-[#111111] transition-colors py-3 border border-[#E5E5E5] rounded-lg">
            Ver todo <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}
```

por:

```tsx
// Featured Sets Section Component — grid simple, sin filtros (esos viven en /corporativo).
function FeaturedSetsSection({ sets, priceVisibilityRules }: { sets: CorporateSetSummary[]; priceVisibilityRules: BusinessRule[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid-4');
  const [itemsPerPage, setItemsPerPage] = useState<number>(8);
  const displayedSets = sets.slice(0, itemsPerPage);

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="font-display uppercase text-h2-mobile md:text-h2">Sets destacados</h2>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <LayoutSwitcher viewMode={viewMode} onViewModeChange={setViewMode} itemsPerPage={itemsPerPage} onItemsPerPageChange={setItemsPerPage} totalItems={sets.length} showAllColumns={true} />
            </div>
            <div className="sm:hidden">
              <LayoutSwitcher viewMode={viewMode} onViewModeChange={setViewMode} itemsPerPage={itemsPerPage} onItemsPerPageChange={setItemsPerPage} totalItems={sets.length} showAllColumns={false} />
            </div>
            <Link href="/corporativo" className="hidden sm:flex items-center gap-1 text-sm font-medium text-[#333333] hover:text-[#111111] transition-colors">
              Ver todo <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
        <div className={cn(
          'grid gap-4 md:gap-6',
          viewMode === 'grid-4' && 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4',
          viewMode === 'grid-3' && 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3',
          viewMode === 'grid-2' && 'grid-cols-2 lg:grid-cols-2',
          viewMode === 'grid-1' && 'grid-cols-1 sm:grid-cols-2',
          viewMode === 'list' && 'grid-cols-1'
        )}>
          {displayedSets.map(set => {
            const resolved = resolveRules(priceVisibilityRules, {
              setId: set.id,
              brandId: set.brandId,
              productIds: set.productIds,
            });
            const showPrices =
              resolved.priceVisibility.showPrices &&
              (resolved.priceVisibility.catalog === 'CORPORATE' || resolved.priceVisibility.catalog === 'BOTH');
            return (
              <SetGridCard key={set.id} set={set} activeColorId={null} showPrices={showPrices} />
            );
          })}
        </div>
        <div className="mt-6 sm:hidden">
          <Link href="/corporativo" className="flex items-center justify-center gap-1 text-sm font-medium text-[#333333] hover:text-[#111111] transition-colors py-3 border border-[#E5E5E5] rounded-lg">
            Ver todo <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}
```

Nota: `viewMode === 'list'` en este grid renderiza igual `SetGridCard` (no hay una versión "list" separada para la sección corta — a diferencia del catálogo completo, que sí distingue grid/list vía `SetListItem`). Esto es intencional: la sección de destacados es un grid simple sin la complejidad de `SetCatalogGrid`; si se quisiera paridad total de list-view aquí, se usaría `SetListItem` como hace `SetCatalogGrid`, pero la spec no lo exige y mantenerlo así reduce superficie de cambio.

Se necesita agregar el import de `resolveRules` (ya viene del import de tipos `BusinessRule` en Step 1 — agregar también la función, no solo el tipo): actualizar el import de Step 1 a:

```tsx
import { resolveRules, type BusinessRule } from '@/lib/rules-engine';
```

- [ ] **Step 3: Reescribir la función `Home` con la nueva firma**

Reemplazar:

```tsx
// Main Home Page
export function Home({ heroSlides, featuredProducts, allProducts, brands }: { heroSlides: HeroSlide[]; featuredProducts: Product[]; allProducts?: Product[]; brands?: BrandNavItem[] }) {
  return (
    <main className="pt-14 sm:pt-16">
      {heroSlides && heroSlides.length > 0 && <HeroCarousel slides={heroSlides} />}
      <CorporateCTA />
      <QuickAccessCards />
      {allProducts && allProducts.length > 0 && <FilterableProductSection products={allProducts} />}
      {brands && brands.length > 0 && <BrandCarousel brands={brands} />}
      {featuredProducts && featuredProducts.length > 0 && <FeaturedProductsSection products={featuredProducts} />}
    </main>
  );
}
```

por:

```tsx
// Main Home Page
export function Home({
  heroSlides,
  featuredSets,
  allSets,
  priceVisibilityRules,
  minQuantity,
  brands,
}: {
  heroSlides: HeroSlide[];
  featuredSets: CorporateSetSummary[];
  allSets: CorporateSetSummary[];
  priceVisibilityRules: BusinessRule[];
  minQuantity: number;
  brands?: BrandNavItem[];
}) {
  return (
    <main className="pt-14 sm:pt-16">
      {heroSlides && heroSlides.length > 0 && <HeroCarousel slides={heroSlides} />}
      <CorporateCTA />
      <QuickAccessCards />
      {allSets && allSets.length > 0 && (
        <SetCatalogGrid sets={allSets} priceVisibilityRules={priceVisibilityRules} minQuantity={minQuantity} />
      )}
      {brands && brands.length > 0 && <BrandCarousel brands={brands} />}
      {featuredSets && featuredSets.length > 0 && (
        <FeaturedSetsSection sets={featuredSets} priceVisibilityRules={priceVisibilityRules} />
      )}
    </main>
  );
}
```

- [ ] **Step 4: Typecheck y lint completos**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores en `Home.tsx`, `page.tsx`.

- [ ] **Step 5: Commit (sugerido, no ejecutar)**

```
feat(home): reemplazar secciones de productos individuales por sets corporativos
```

---

### Task 6: Eliminar código huérfano (`getFeaturedProducts`, `FilterableProductSection`)

**Files:**
- Modify: `src/lib/data-service.ts`
- Delete: `src/components/home/FilterableProductSection.tsx`

**Interfaces:** ninguna.

Task 5 ya removió el último consumidor de `FilterableProductSection`/`getFeaturedProducts` en `Home.tsx` — esta task confirma que no queda ninguno en todo el proyecto y elimina ambos.

- [ ] **Step 1: Grep de confirmación**

Run: `grep -rn "getFeaturedProducts\|FilterableProductSection" src/ --include="*.ts" --include="*.tsx"`
Expected: solo la definición de `getFeaturedProducts` en `data-service.ts` y el archivo `FilterableProductSection.tsx` en sí — ningún consumidor.

- [ ] **Step 2: Eliminar `getFeaturedProducts` de `src/lib/data-service.ts`**

Localizar la función (buscar `export async function getFeaturedProducts`) y eliminarla completa. Revisar si algún import usado solo por esa función (ej. `ne` de `drizzle-orm`, si no se usa en otra función del archivo) queda huérfano — eliminarlo también si corresponde.

- [ ] **Step 3: Eliminar el archivo `src/components/home/FilterableProductSection.tsx`**

- [ ] **Step 4: Typecheck y lint completos**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores de imports rotos en todo el proyecto.

- [ ] **Step 5: Commit (sugerido, no ejecutar)**

```
chore(home): eliminar getFeaturedProducts y FilterableProductSection sin uso
```

---

### Task 7: Validación completa del proyecto y checklist manual

**Files:** ninguno (solo validación).

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build exitoso, incluyendo `/` y `/corporativo` compilados sin errores.

- [ ] **Step 2: Lint y typecheck completos**

Run: `npm run lint && npx tsc --noEmit`
Expected: sin errores nuevos (los errores de lint preexistentes en archivos no tocados por este plan, si los hay, no son responsabilidad de este cambio — confirmar que no aparecen en los archivos modificados por este plan).

- [ ] **Step 3: Test suite**

Run: `npm run test`
Expected: sin regresiones en los tests existentes (este cambio no toca lógica cubierta por `.test.ts`).

- [ ] **Step 4: Checklist manual (`npm run dev`, revisar `/` y `/corporativo`)**

- [ ] Home (`/`): sección "Sets destacados" muestra solo sets con `isFeatured=true` (verificar contra el admin qué sets están marcados destacados).
- [ ] Home (`/`): sección debajo (antes "Explora nuestro catálogo") muestra el catálogo completo de sets con filtros, búsqueda y paginación funcionando.
- [ ] Home (`/`): click en swatch de color dentro de una card cambia la portada mostrada, sin navegar.
- [ ] Home (`/`): botón "Ver todo" de la sección destacados navega a `/corporativo`.
- [ ] `/corporativo`: comportamiento idéntico al que tenía antes del refactor (hero, filtros, grid, paginación).
- [ ] `/catalogo` (retail, productos individuales): sin cambios — sigue funcionando igual.
- [ ] PDP individual (`/p/[slug]`) y `layout.tsx` (que usan `getAllProducts`): sin cambios.
- [ ] `/admin`: sin cambios visuales.
- [ ] Mobile (~390px) y desktop (~1280px): ambas secciones de home se ven correctamente.

- [ ] **Step 5: Commit final combinado (sugerido, no ejecutar)**

Si se prefiere un solo commit para todo el cambio en vez de uno por task:

```
feat(home): reemplazar productos individuales por sets corporativos

Extrae SetGridCard y el bloque de filtros/grid/paginacion de
CorporativoContent a componentes compartidos (SetGridCard,
SetCatalogGrid), agrega filtro featuredOnly a getActiveCorporateSets,
y los reutiliza en la home para reemplazar las secciones de productos
individuales. Elimina getFeaturedProducts y FilterableProductSection
sin uso.
```

---

## Self-Review (completado por el autor del plan)

- **Cobertura de spec:** filtro `featuredOnly` (Task 1) ✓; extracción `SetGridCard` (Task 2) ✓; extracción `SetCatalogGrid` (Task 3) ✓; `force-dynamic` + datos en `page.tsx` (Task 4) ✓; `Home.tsx` con nuevas secciones (Task 5) ✓; eliminación de código huérfano con verificación por grep (Task 6) ✓; `getAllProducts()` no se toca (ninguna task la modifica) ✓; `CorporateCTA`/`QuickAccessCards`/`HeroCarousel`/`BrandCarousel` sin cambios (ninguna task los toca) ✓.
- **Placeholders:** ninguno — todo el código de cada step está completo. La nota sobre `minQuantity` no usado en `SetCatalogGrid` documenta una decisión real (prefijo `_`), no un placeholder.
- **Consistencia de tipos:** `SetGridCardProps`, `SetCatalogGridProps`, `CorporateSetSummary`, `BusinessRule` se usan idénticamente en las tasks que los consumen. La firma de `Home()` en Task 5 coincide exactamente con las props que le pasa `page.tsx` en Task 4 (`featuredSets`, `allSets`, `priceVisibilityRules`, `minQuantity`, `heroSlides`, `brands`).
- **Orden de ejecución:** Task 2 deja `CorporativoContent.tsx` en estado intermedio a propósito (documentado explícitamente) — Task 3 lo completa. Task 6 (limpieza) debe correr DESPUÉS de Task 5 (que remueve el último consumidor de `FilterableProductSection`/`getFeaturedProducts`). Orden secuencial: 1 → 2 → 3 → 4 → 5 → 6 → 7.

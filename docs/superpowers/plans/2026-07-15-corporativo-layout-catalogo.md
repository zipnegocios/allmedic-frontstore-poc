# Corporativo adopta el layout de filtrado y grilla de Catálogo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/corporativo` use the same filter-sidebar + grid/list layout as `/catalogo`, with sets filtered by the aggregated attributes of the pieces (products) that compose them.

**Architecture:** Extend the corporate listing query to aggregate per-set attributes (colors/sizes/genders/categories/fits/pieceNames/createdAt) from active variants of the set's pieces. Add a pure matching/sorting module (`set-filter-logic.ts`, unit-tested) and a client hook (`useSetFilter`) that consumes it, mirroring the *actual* behavior of `/catalogo` (which is implemented inline in `CatalogoContent.tsx`, not via the existing-but-unused `useProductFilter` hook — see Fase 0 finding below). Build a new `SetFilterSidebar` and `SetListItem` that replicate `/catalogo`'s visual patterns (its `FilterSidebar` is a single monolithic file with no extractable subcomponents beyond `ColorSwatch`), and reuse `LayoutSwitcher` and `ColorSwatch` unmodified. Reassemble `CorporativoContent.tsx` around these pieces, replacing the current single-select Grupo/Marca pill filters.

**Tech Stack:** Next.js (App Router), React (client components), Drizzle ORM (Postgres), TypeScript, Tailwind, Vitest.

## Fase 0 — Findings (already verified, do not re-audit)

- `/catalogo`'s actual filter/sort/search/pagination logic lives **inline in `CatalogoContent.tsx`** (`src/app/(store)/catalogo/CatalogoContent.tsx:73-148`). The `useProductFilter` hook (`src/hooks/useProductFilter.ts`) exists but is **not used by `/catalogo`** — it's used by home-page components (`FilterableProductSection`, `HierarchicalFilter`). `useSetFilter` mirrors what `CatalogoContent.tsx` actually does, not `useProductFilter`'s API.
- `getActiveCorporateSets()` (`src/lib/corporate-data-service.ts:71-145`) returns only card-level data today (no per-piece colors/sizes/gender/category/fit). `getCorporateSetBySlug` (`corporate-data-service.ts:148-326`) already joins `productVariants`→`colors` per piece — confirms the attributes exist in-schema and the join pattern to replicate.
- No DB schema changes needed. Relevant columns already exist: `products.category` (text), `products.gender` (text, mapped via `genderFromDb`), `productVariants.size`/`fit`/`colorId` (text/text/uuid), `productVariants.status` (text: `'AVAILABLE' | 'BACKORDER' | 'OUT_OF_STOCK'`), `corporateSets.createdAt` (timestamp, already in schema but not currently selected by either query).
- "Active variant" filtering pattern already established: `getInventorySnapshotByProductIds` (`corporate-data-service.ts:452`) uses `eq(variantsTable.status, 'AVAILABLE')`. Reuse this exact condition for "sin opción muerta" aggregation.
- `src/components/catalog/FilterSidebar.tsx` is one file with inline JSX per filter group (Gender/Category/Brand/Color/Size/Price) — only `ColorSwatch` (`src/components/catalog/ColorSwatch.tsx`) is a standalone reusable component. `SetFilterSidebar` replicates the visual patterns; it does not import from `FilterSidebar.tsx`.
- `LayoutSwitcher` (`src/components/catalog/LayoutSwitcher.tsx:35-91`) is fully agnostic to item type (column count + items-per-page only) — reused as-is, unmodified.
- `ProductListItem` (same file, lines 99-173) is tightly coupled to the `Product` type — not reusable. A new `SetListItem` is created.
- `/catalogo`'s "Relevancia" = no sort applied (DB/query order preserved). Its "Más recientes" sorts by the `isNew` boolean flag (`CatalogoContent.tsx:134-136`), not a date — sets have no `isNew` concept, so **"Más recientes" for sets sorts by true `createdAt desc`** (an intentional, flagged deviation from the individual catalog's literal quirk; the spec's own Fase 1 requirements already ask for `createdAt` on sets for exactly this purpose).
- The "Buscar en resultados..." input is **not** part of `FilterSidebar.tsx` in the individual catalog — it lives in `CatalogoContent.tsx`'s controls area (lines 248-272), bound to local `gridSearchQuery` state, separate from the sidebar. `CorporativoContent.tsx` replicates this exact placement; `SetFilterSidebar` does not contain a search input. (The hook's `filters.search` field satisfies the spec's Decisión 2 wording ("buscador interno" is one of the filter groups conceptually) while matching the individual catalog's actual DOM placement.)

## Global Constraints

- No database schema or migration changes.
- Individual catalog (`/catalogo`, `useProductFilter`, `FilterSidebar`, `CatalogoContent.tsx`) must have zero behavior or visual changes — never edit those files.
- Corporate set detail page (`/corporativo/s/[slug]`), the combination builder, and `src/lib/rules-engine/` are out of scope — do not edit `SetDetailContent.tsx` or anything under `rules-engine/`.
- `SetFilterSidebar` has **no price range filter** (corporate prices are referential).
- Matching semantics (per set, per active filter group independently): a set matches a filter group if **any** piece of the set satisfies **any** selected value of that group (OR within group). All active groups must match (AND across groups). Groups: `groups` (Grupo, new, multi-select), `gender`, `categories`, `brands`, `colors`, `sizes`, `fits`.
- "Active variant" = `productVariants.status === 'AVAILABLE'`. Only active variants feed `colors`/`sizes`/`fits` aggregation ("sin opción muerta").
- Sort options, exact 4, exact labels: Relevancia (`relevance`, no sort), Precio: menor a mayor (`price-asc`), Precio: mayor a menor (`price-desc`), Más recientes (`newest`, by `createdAt desc`). Price sort uses `referencePrice` regardless of whether `PRICE_VISIBILITY` hides the value on cards.
- Pagination: client-side, options `[5, 10, 20, 50]`, default **20** — matches `LayoutSwitcher`'s existing `itemsPerPageOptions`.
- `LayoutSwitcher` and `ColorSwatch` are imported and used unmodified — never edit `LayoutSwitcher.tsx` or `ColorSwatch.tsx`.
- Card markup (grid mode) keeps `aspect-[4/5]` and the exact JSX/classes currently in `CorporativoContent.tsx:134-188` (Fase 0 already unified this ratio project-wide per `docs/audits/AUDITORIA-corporativo-armador.md`).
- `PRICE_VISIBILITY` resolution (`resolveRules(priceVisibilityRules, {...})` per set, checking `resolved.priceVisibility.showPrices` and `catalog === 'CORPORATE' || 'BOTH'`) is preserved exactly, called per card in both grid and list view.
- Empty state message stays exactly: "No hay sets corporativos disponibles con estos filtros." with a way to clear filters.
- No git commits, no `npm run build`/deploy/push actions beyond local validation commands. No Markdown summary files beyond the required report in `docs/reports/`.

---

### Task 1: Data layer — aggregate per-set attributes

**Files:**
- Modify: `src/lib/corporate-types.ts`
- Modify: `src/lib/corporate-data-service.ts`
- Modify: `src/lib/data-service.ts:65-69` (export `genderFromDb`)

**Interfaces:**
- Produces: `CorporateSetSummary` gains `colors: ProductColor[]`, `sizes: string[]`, `genders: Gender[]`, `categories: string[]`, `fits: string[]`, `pieceNames: string[]`, `createdAt: string` (ISO). `CorporateSetDetail extends CorporateSetSummary`, so `getCorporateSetBySlug` must also populate these (computed from its already-fetched `pieces`/variants — no new queries beyond 2 extra selected columns).
- Consumes: nothing from later tasks.

- [ ] **Step 1: Export `genderFromDb` from `data-service.ts`**

In `src/lib/data-service.ts`, change line 65 from:

```ts
const genderFromDb: Record<string, Gender> = {
```

to:

```ts
export const genderFromDb: Record<string, Gender> = {
```

- [ ] **Step 2: Extend `CorporateSetSummary` in `corporate-types.ts`**

Replace the full contents of `src/lib/corporate-types.ts` with:

```ts
import type { ProductColor, ProductVariant } from './types';
import type { Gender } from './types';

export interface SetGroupSummary {
  id: string;
  name: string;
  slug: string;
}

export interface SetPiece {
  setItemId: string;
  productId: string;
  productName: string;
  productSlug: string;
  quantityPerSet: number;
  priceWholesale: number | null;
  priceWholesaleSale: number | null;
  colors: ProductColor[];
  availableSizes: string[];
  variants: ProductVariant[];
}

export interface CorporateSetSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  groupName: string | null;
  groupSlug: string | null;
  /** Id del grupo de sets (para resolver reglas por ítem en el grid — `groupSlug` es solo para filtros de UI). */
  setGroupId: string | null;
  brandName: string | null;
  /** Id de la marca (para resolver reglas por ítem en el grid — `brandName` es solo para mostrar/filtrar). */
  brandId: string | null;
  /** Ids de los productos que componen el set — para resolver reglas de ámbito Producto en el grid. */
  productIds: string[];
  isFeatured: boolean;
  pieceCount: number;
  referencePrice: number | null;
  hasMissingPrices: boolean;
  /** Atributos agregados de las piezas activas del set — usados por el filtrado de `/corporativo`. */
  colors: ProductColor[];
  sizes: string[];
  genders: Gender[];
  categories: string[];
  fits: string[];
  pieceNames: string[];
  createdAt: string;
}

export interface CorporateSetDetail extends CorporateSetSummary {
  setGroupId: string | null;
  brandId: string | null;
  pieces: SetPiece[];
}
```

- [ ] **Step 3: Extend `getActiveCorporateSets` in `corporate-data-service.ts`**

Replace the imports block (lines 1-22) with:

```ts
import { db } from '@/db';
import {
  corporateSets as corporateSetsTable,
  setGroups as setGroupsTable,
  setItems as setItemsTable,
  products as productsTable,
  brands as brandsTable,
  colors as colorsTable,
  productVariants as variantsTable,
  businessRules as businessRulesTable,
  corporateAccounts as corporateAccountsTable,
  quotes as quotesTable,
  quoteDocuments as quoteDocumentsTable,
  mediaLinks as mediaLinksTable,
  mediaAssets as mediaAssetsTable,
} from '@/db/schema';
import { eq, and, inArray, asc, desc, sql, isNotNull, isNull } from 'drizzle-orm';
import type { BusinessRule, InventoryStockSnapshot, SetPieceInfo } from './rules-engine';
import type { CorporateSetSummary, CorporateSetDetail, SetPiece, SetGroupSummary } from './corporate-types';
import type { ProductColor, ProductVariant, Gender } from './types';
import { resolveMediaUrl, isVideoMime, type MediaItem } from './media';
import { effectiveManualPrice } from './set-pricing';
import { genderFromDb } from './data-service';
```

Replace the full `getActiveCorporateSets` function (currently lines 70-145, from `// ── Grid público de sets activos ──` through its closing `}`) with:

```ts
// ── Grid público de sets activos ──
export async function getActiveCorporateSets(): Promise<CorporateSetSummary[]> {
  const rows = await db
    .select({
      id: corporateSetsTable.id,
      slug: corporateSetsTable.slug,
      name: corporateSetsTable.name,
      description: corporateSetsTable.description,
      groupName: setGroupsTable.name,
      groupSlug: setGroupsTable.slug,
      setGroupId: corporateSetsTable.setGroupId,
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
    .leftJoin(setGroupsTable, eq(corporateSetsTable.setGroupId, setGroupsTable.id))
    .leftJoin(brandsTable, eq(corporateSetsTable.brandId, brandsTable.id))
    .where(and(eq(corporateSetsTable.isActive, true), isNull(corporateSetsTable.deletedAt)))
    .orderBy(asc(corporateSetsTable.sortOrder));

  const setIds = rows.map((r) => r.id);
  if (setIds.length === 0) return [];

  const items = await db
    .select({
      setId: setItemsTable.setId,
      productId: setItemsTable.productId,
      quantityPerSet: setItemsTable.quantityPerSet,
      priceWholesale: productsTable.priceWholesale,
      priceWholesaleSale: productsTable.priceWholesaleSale,
      productName: productsTable.name,
      category: productsTable.category,
      gender: productsTable.gender,
    })
    .from(setItemsTable)
    .leftJoin(productsTable, eq(setItemsTable.productId, productsTable.id))
    .where(inArray(setItemsTable.setId, setIds));

  const productIds = Array.from(new Set(items.map((i) => i.productId).filter((id): id is string => !!id)));

  // Solo variantes activas ("sin opción muerta") alimentan colores/tallas/cortes agregados.
  const variants = productIds.length > 0
    ? await db
        .select({
          productId: variantsTable.productId,
          colorId: variantsTable.colorId,
          size: variantsTable.size,
          fit: variantsTable.fit,
          colorName: colorsTable.name,
          colorCode: colorsTable.code,
          colorHex: colorsTable.hex,
        })
        .from(variantsTable)
        .leftJoin(colorsTable, eq(variantsTable.colorId, colorsTable.id))
        .where(and(inArray(variantsTable.productId, productIds), eq(variantsTable.status, 'AVAILABLE')))
    : [];

  const coverImages = await getCoverImageMap(setIds);

  return rows.map((set) => {
    const setItems = items.filter((i) => i.setId === set.id);
    let autoPrice = 0;
    let hasMissingPrices = false;
    for (const item of setItems) {
      const price = wholesalePriceOf(item.priceWholesale, item.priceWholesaleSale);
      if (price === null) {
        hasMissingPrices = true;
        continue;
      }
      autoPrice += price * (item.quantityPerSet ?? 1);
    }
    const manualPrice = effectiveManualPrice(set.priceManual, set.priceManualSale, set.manualDiscountEnd);
    const referencePrice = manualPrice ?? autoPrice;
    if (manualPrice !== null) hasMissingPrices = false;

    const setProductIds = Array.from(new Set(setItems.map((i) => i.productId).filter((id): id is string => !!id)));
    const categories = Array.from(new Set(setItems.map((i) => i.category).filter((c): c is string => !!c)));
    const genders = Array.from(
      new Set(setItems.map((i) => (i.gender ? genderFromDb[i.gender] : undefined)).filter((g): g is Gender => !!g))
    );
    const pieceNames = Array.from(new Set(setItems.map((i) => i.productName).filter((n): n is string => !!n)));

    const setVariants = variants.filter((v) => setProductIds.includes(v.productId));
    const colorMap = new Map<string, ProductColor>();
    const sizeSet = new Set<string>();
    const fitSet = new Set<string>();
    for (const v of setVariants) {
      if (v.colorId && !colorMap.has(v.colorId)) {
        colorMap.set(v.colorId, { id: v.colorId, name: v.colorName || '', code: v.colorCode || '', hex: v.colorHex || '' });
      }
      sizeSet.add(v.size);
      if (v.fit) fitSet.add(v.fit);
    }

    return {
      id: set.id,
      slug: set.slug,
      name: set.name,
      description: set.description,
      imageUrl: coverImages.get(set.id) ?? null,
      groupName: set.groupName,
      groupSlug: set.groupSlug,
      setGroupId: set.setGroupId,
      brandName: set.brandName,
      brandId: set.brandId,
      productIds: setProductIds,
      isFeatured: set.isFeatured ?? false,
      pieceCount: setItems.length,
      referencePrice: setItems.length > 0 || manualPrice !== null ? referencePrice : null,
      hasMissingPrices,
      colors: Array.from(colorMap.values()),
      sizes: Array.from(sizeSet),
      genders,
      categories,
      fits: Array.from(fitSet),
      pieceNames,
      createdAt: set.createdAt ? set.createdAt.toISOString() : new Date(0).toISOString(),
    };
  });
}
```

- [ ] **Step 4: Extend `getCorporateSetBySlug` to satisfy the widened `CorporateSetDetail` type**

In `src/lib/corporate-data-service.ts`, in the first `db.select` of `getCorporateSetBySlug` (the one selecting `id, slug, name, description, setGroupId, brandId, groupName, groupSlug, brandName, isFeatured, priceManual, priceManualSale, manualDiscountEnd`), add one field so it reads:

```ts
  const [set] = await db
    .select({
      id: corporateSetsTable.id,
      slug: corporateSetsTable.slug,
      name: corporateSetsTable.name,
      description: corporateSetsTable.description,
      setGroupId: corporateSetsTable.setGroupId,
      brandId: corporateSetsTable.brandId,
      groupName: setGroupsTable.name,
      groupSlug: setGroupsTable.slug,
      brandName: brandsTable.name,
      isFeatured: corporateSetsTable.isFeatured,
      priceManual: corporateSetsTable.priceManual,
      priceManualSale: corporateSetsTable.priceManualSale,
      manualDiscountEnd: corporateSetsTable.manualDiscountEnd,
      createdAt: corporateSetsTable.createdAt,
    })
```

In the same function, the `items` query (selecting `setItemId, productId, quantityPerSet, sortOrder, productName, productSlug, priceWholesale, priceWholesaleSale`) — add two fields so it reads:

```ts
  const items = await db
    .select({
      setItemId: setItemsTable.id,
      productId: setItemsTable.productId,
      quantityPerSet: setItemsTable.quantityPerSet,
      sortOrder: setItemsTable.sortOrder,
      productName: productsTable.name,
      productSlug: productsTable.slug,
      priceWholesale: productsTable.priceWholesale,
      priceWholesaleSale: productsTable.priceWholesaleSale,
      category: productsTable.category,
      gender: productsTable.gender,
    })
```

Immediately before the line `const pieces: SetPiece[] = items.map((item) => {`, insert:

```ts
  const categoriesAgg = new Set<string>();
  const gendersAgg = new Set<Gender>();
  const colorMapAgg = new Map<string, ProductColor>();
  const sizeSetAgg = new Set<string>();
  const fitSetAgg = new Set<string>();
```

Inside the `items.map((item) => { ... })` callback that builds `pieces`, immediately after the line `const productVariants = variants.filter((v) => v.productId === item.productId);`, insert:

```ts
    if (item.category) categoriesAgg.add(item.category);
    if (item.gender && genderFromDb[item.gender]) gendersAgg.add(genderFromDb[item.gender]);
    for (const v of productVariants) {
      if (v.status !== 'AVAILABLE') continue;
      if (!colorMapAgg.has(v.colorId)) {
        colorMapAgg.set(v.colorId, { id: v.colorId, name: v.colorName || '', code: v.colorCode || '', hex: v.colorHex || '' });
      }
      sizeSetAgg.add(v.size);
      if (v.fit) fitSetAgg.add(v.fit);
    }
```

In the function's final `return { ... }` object (the one with `id: set.id, slug: set.slug, ...`), add the new fields so it reads:

```ts
  return {
    id: set.id,
    slug: set.slug,
    name: set.name,
    description: set.description,
    imageUrl: coverImages.get(set.id) ?? null,
    setGroupId: set.setGroupId,
    brandId: set.brandId,
    groupName: set.groupName,
    groupSlug: set.groupSlug,
    brandName: set.brandName,
    productIds: pieces.map((p) => p.productId),
    isFeatured: set.isFeatured ?? false,
    pieceCount: pieces.length,
    referencePrice: pieces.length > 0 || manualPrice !== null ? (manualPrice ?? referencePrice) : null,
    hasMissingPrices: effectiveHasMissingPrices,
    colors: Array.from(colorMapAgg.values()),
    sizes: Array.from(sizeSetAgg),
    genders: Array.from(gendersAgg),
    categories: Array.from(categoriesAgg),
    fits: Array.from(fitSetAgg),
    pieceNames: pieces.map((p) => p.productName).filter((n) => !!n),
    createdAt: set.createdAt ? set.createdAt.toISOString() : new Date(0).toISOString(),
    pieces,
  };
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors related to `corporate-data-service.ts`, `corporate-types.ts`, or `data-service.ts`. (Other pre-existing unrelated errors, if any, are not this task's concern — but there should be none introduced by this change.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/corporate-types.ts src/lib/corporate-data-service.ts src/lib/data-service.ts
git commit -m "feat(corporativo): agregar atributos de piezas activas por set en la capa de datos"
```

---

### Task 2: Pure matching/sorting/pagination logic + tests

**Files:**
- Create: `src/lib/set-filter-logic.ts`
- Test: `src/lib/__tests__/set-filter-logic.test.ts`

**Interfaces:**
- Consumes: `CorporateSetSummary` from `src/lib/corporate-types.ts` (Task 1 — already has `colors/sizes/genders/categories/fits/pieceNames/createdAt`).
- Produces: `SetFilterState`, `EMPTY_SET_FILTERS`, `SetSortOption`, `matchesSetFilters(set, filters): boolean`, `sortSets(sets, sortBy): CorporateSetSummary[]`, `countActiveSetFilters(filters): number`, `paginate<T>(items, page, perPage): T[]` — all consumed by Task 3's `useSetFilter`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/set-filter-logic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  matchesSetFilters,
  sortSets,
  countActiveSetFilters,
  paginate,
  EMPTY_SET_FILTERS,
  type SetFilterState,
} from '../set-filter-logic';
import type { CorporateSetSummary } from '../corporate-types';

function makeSet(overrides: Partial<CorporateSetSummary> = {}): CorporateSetSummary {
  return {
    id: 's1',
    slug: 'set-1',
    name: 'Set Enfermería Básico',
    description: null,
    imageUrl: null,
    groupName: 'Enfermería',
    groupSlug: 'enfermeria',
    setGroupId: 'g1',
    brandName: 'AllMedic',
    brandId: 'b1',
    productIds: ['p1', 'p2'],
    isFeatured: false,
    pieceCount: 2,
    referencePrice: 100,
    hasMissingPrices: false,
    colors: [{ id: 'c-navy', name: 'Navy', code: 'NVY', hex: '#1B2A4A' }],
    sizes: ['M'],
    genders: ['Unisex'],
    categories: ['Camisas'],
    fits: ['Regular'],
    pieceNames: ['Camisa Clínica', 'Pantalón Cargo'],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function filters(overrides: Partial<SetFilterState> = {}): SetFilterState {
  return { ...EMPTY_SET_FILTERS, ...overrides };
}

describe('matchesSetFilters', () => {
  it('matches a set when Navy comes from one piece and M comes from a different piece (aggregated, cross-piece AND)', () => {
    // colors=[Navy] aggregated from the shirt, sizes=[M] aggregated from the pants — same set object.
    const set = makeSet({ colors: [{ id: 'c-navy', name: 'Navy', code: 'NVY', hex: '#1B2A4A' }], sizes: ['M'] });
    const result = matchesSetFilters(set, filters({ colors: ['c-navy'], sizes: ['M'] }));
    expect(result).toBe(true);
  });

  it('excludes a set with no piece in Navy when filtering by Navy', () => {
    const set = makeSet({ colors: [{ id: 'c-black', name: 'Black', code: 'BLK', hex: '#000000' }] });
    const result = matchesSetFilters(set, filters({ colors: ['c-navy'] }));
    expect(result).toBe(false);
  });

  it('applies OR within a group: Navy OR Black matches a set that only has Black', () => {
    const set = makeSet({ colors: [{ id: 'c-black', name: 'Black', code: 'BLK', hex: '#000000' }] });
    const result = matchesSetFilters(set, filters({ colors: ['c-navy', 'c-black'] }));
    expect(result).toBe(true);
  });

  it('applies AND across groups: Grupo matches but Color does not -> overall false', () => {
    const set = makeSet({ groupSlug: 'enfermeria', colors: [{ id: 'c-black', name: 'Black', code: 'BLK', hex: '#000000' }] });
    const result = matchesSetFilters(set, filters({ groups: ['enfermeria'], colors: ['c-navy'] }));
    expect(result).toBe(false);
  });

  it('matches both groups when Grupo and Color both satisfy the set', () => {
    const set = makeSet({ groupSlug: 'enfermeria', colors: [{ id: 'c-navy', name: 'Navy', code: 'NVY', hex: '#1B2A4A' }] });
    const result = matchesSetFilters(set, filters({ groups: ['enfermeria'], colors: ['c-navy'] }));
    expect(result).toBe(true);
  });

  it('search finds a set by a piece name it does not otherwise match by', () => {
    const set = makeSet({ name: 'Set Genérico', pieceNames: ['Camisa Clínica', 'Pantalón Cargo'] });
    const result = matchesSetFilters(set, filters({ search: 'pantalón cargo' }));
    expect(result).toBe(true);
  });

  it('search is case-insensitive and matches set name too', () => {
    const set = makeSet({ name: 'Set Radiología Avanzado' });
    const result = matchesSetFilters(set, filters({ search: 'RADIOLOGÍA' }));
    expect(result).toBe(true);
  });
});

describe('sortSets', () => {
  const cheap = makeSet({ id: 'cheap', referencePrice: 50, createdAt: '2026-01-01T00:00:00.000Z' });
  const pricey = makeSet({ id: 'pricey', referencePrice: 150, createdAt: '2026-03-01T00:00:00.000Z' });
  const mid = makeSet({ id: 'mid', referencePrice: 100, createdAt: '2026-02-01T00:00:00.000Z' });

  it('sorts price-asc by referencePrice ascending', () => {
    const result = sortSets([pricey, cheap, mid], 'price-asc').map((s) => s.id);
    expect(result).toEqual(['cheap', 'mid', 'pricey']);
  });

  it('sorts price-desc by referencePrice descending', () => {
    const result = sortSets([cheap, pricey, mid], 'price-desc').map((s) => s.id);
    expect(result).toEqual(['pricey', 'mid', 'cheap']);
  });

  it('sorts newest by createdAt descending', () => {
    const result = sortSets([cheap, mid, pricey], 'newest').map((s) => s.id);
    expect(result).toEqual(['pricey', 'mid', 'cheap']);
  });

  it('relevance leaves the original order untouched', () => {
    const result = sortSets([pricey, cheap, mid], 'relevance').map((s) => s.id);
    expect(result).toEqual(['pricey', 'cheap', 'mid']);
  });
});

describe('countActiveSetFilters', () => {
  it('counts zero for empty filters', () => {
    expect(countActiveSetFilters(EMPTY_SET_FILTERS)).toBe(0);
  });

  it('counts each active group once, arrays by length', () => {
    const count = countActiveSetFilters(
      filters({ groups: ['g1', 'g2'], gender: 'Mujer', colors: ['c1'] })
    );
    expect(count).toBe(4); // 2 groups + 1 gender + 1 color
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it('returns the first page', () => {
    expect(paginate(items, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('returns a middle page', () => {
    expect(paginate(items, 2, 10)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('returns a partial last page', () => {
    expect(paginate(items, 3, 10)).toEqual([21, 22, 23, 24, 25]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/set-filter-logic.test.ts`
Expected: FAIL — `Cannot find module '../set-filter-logic'`

- [ ] **Step 3: Implement `set-filter-logic.ts`**

Create `src/lib/set-filter-logic.ts`:

```ts
import type { CorporateSetSummary } from './corporate-types';
import type { Gender } from './types';

export interface SetFilterState {
  search: string;
  groups: string[];
  gender: Gender | null;
  categories: string[];
  brands: string[];
  colors: string[];
  sizes: string[];
  fits: string[];
}

export const EMPTY_SET_FILTERS: SetFilterState = {
  search: '',
  groups: [],
  gender: null,
  categories: [],
  brands: [],
  colors: [],
  sizes: [],
  fits: [],
};

export type SetSortOption = 'relevance' | 'price-asc' | 'price-desc' | 'newest';

export function matchesSetFilters(set: CorporateSetSummary, filters: SetFilterState): boolean {
  if (filters.groups.length > 0 && (!set.groupSlug || !filters.groups.includes(set.groupSlug))) {
    return false;
  }
  if (filters.gender && !set.genders.includes(filters.gender)) {
    return false;
  }
  if (filters.categories.length > 0 && !set.categories.some((c) => filters.categories.includes(c))) {
    return false;
  }
  if (filters.brands.length > 0 && (!set.brandName || !filters.brands.includes(set.brandName))) {
    return false;
  }
  if (filters.colors.length > 0 && !set.colors.some((c) => filters.colors.includes(c.id))) {
    return false;
  }
  if (filters.sizes.length > 0 && !set.sizes.some((s) => filters.sizes.includes(s))) {
    return false;
  }
  if (filters.fits.length > 0 && !set.fits.some((f) => filters.fits.includes(f))) {
    return false;
  }

  const query = filters.search.trim().toLowerCase();
  if (query) {
    const haystack = [set.name, set.groupName ?? '', set.brandName ?? '', ...set.pieceNames]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  return true;
}

export function sortSets(sets: CorporateSetSummary[], sortBy: SetSortOption): CorporateSetSummary[] {
  const sorted = [...sets];
  switch (sortBy) {
    case 'price-asc':
      sorted.sort((a, b) => (a.referencePrice ?? Number.POSITIVE_INFINITY) - (b.referencePrice ?? Number.POSITIVE_INFINITY));
      break;
    case 'price-desc':
      sorted.sort((a, b) => (b.referencePrice ?? Number.NEGATIVE_INFINITY) - (a.referencePrice ?? Number.NEGATIVE_INFINITY));
      break;
    case 'newest':
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    default:
      break;
  }
  return sorted;
}

export function countActiveSetFilters(filters: SetFilterState): number {
  return (
    filters.groups.length +
    (filters.gender ? 1 : 0) +
    filters.categories.length +
    filters.brands.length +
    filters.colors.length +
    filters.sizes.length +
    filters.fits.length
  );
}

export function paginate<T>(items: T[], page: number, perPage: number): T[] {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/set-filter-logic.test.ts`
Expected: PASS — all 15 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/set-filter-logic.ts src/lib/__tests__/set-filter-logic.test.ts
git commit -m "feat(corporativo): logica pura de filtrado/orden/paginacion de sets con tests"
```

---

### Task 3: `useSetFilter` hook

**Files:**
- Create: `src/hooks/useSetFilter.ts`

**Interfaces:**
- Consumes: `CorporateSetSummary`, `SetGroupSummary` (`@/lib/corporate-types`); `SetFilterState`, `EMPTY_SET_FILTERS`, `SetSortOption`, `matchesSetFilters`, `sortSets`, `countActiveSetFilters`, `paginate` (`@/lib/set-filter-logic`, Task 2).
- Produces (consumed by Task 6): `useSetFilter(sets, groups)` returns `{ filters, filterOptions, paginatedSets, currentPage, totalPages, totalSets, hasActiveFilters, activeFilterCount, applyFilters(partial), resetFilters(), goToPage(page), sortBy, setSortBy(option), itemsPerPage, setItemsPerPage(count) }`. `filterOptions` shape: `{ groups: SetGroupSummary[]; categories: string[]; brands: string[]; colors: {id,name,code,hex}[]; sizes: string[]; fits: string[] }` (exported as `SetFilterOptions`).

- [ ] **Step 1: Implement the hook**

Create `src/hooks/useSetFilter.ts`:

```ts
import { useState, useMemo, useCallback } from 'react';
import type { CorporateSetSummary, SetGroupSummary } from '@/lib/corporate-types';
import {
  EMPTY_SET_FILTERS,
  matchesSetFilters,
  sortSets,
  countActiveSetFilters,
  paginate,
  type SetFilterState,
  type SetSortOption,
} from '@/lib/set-filter-logic';

export interface SetFilterOptions {
  groups: SetGroupSummary[];
  categories: string[];
  brands: string[];
  colors: { id: string; name: string; code: string; hex: string }[];
  sizes: string[];
  fits: string[];
}

const ITEMS_PER_PAGE_DEFAULT = 20;

export function useSetFilter(sets: CorporateSetSummary[], groups: SetGroupSummary[]) {
  const [filters, setFilters] = useState<SetFilterState>(EMPTY_SET_FILTERS);
  const [sortBy, setSortBy] = useState<SetSortOption>('relevance');
  const [itemsPerPage, setItemsPerPageState] = useState<number>(ITEMS_PER_PAGE_DEFAULT);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filterOptions: SetFilterOptions = useMemo(() => {
    const categories = new Set<string>();
    const brands = new Set<string>();
    const colorMap = new Map<string, { id: string; name: string; code: string; hex: string }>();
    const sizes = new Set<string>();
    const fits = new Set<string>();
    for (const s of sets) {
      for (const c of s.categories) categories.add(c);
      if (s.brandName) brands.add(s.brandName);
      for (const c of s.colors) if (!colorMap.has(c.id)) colorMap.set(c.id, c);
      for (const sz of s.sizes) sizes.add(sz);
      for (const f of s.fits) fits.add(f);
    }
    return {
      groups,
      categories: Array.from(categories).sort(),
      brands: Array.from(brands).sort(),
      colors: Array.from(colorMap.values()),
      sizes: Array.from(sizes),
      fits: Array.from(fits).sort(),
    };
  }, [sets, groups]);

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

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `src/hooks/useSetFilter.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSetFilter.ts
git commit -m "feat(corporativo): hook useSetFilter para filtrado/orden/paginacion client-side"
```

---

### Task 4: `SetFilterSidebar` + `SetFilterButton`

**Files:**
- Create: `src/components/catalog/SetFilterSidebar.tsx`

**Interfaces:**
- Consumes: `ColorSwatch` (`@/components/catalog/ColorSwatch`, unmodified); `SetFilterState` (`@/lib/set-filter-logic`); `SetFilterOptions` (`@/hooks/useSetFilter`, Task 3); `Gender` (`@/lib/types`); `cn` (`@/lib/utils`).
- Produces (consumed by Task 6): `SetFilterSidebar({ filters, filterOptions, onFilterChange, isOpen, onClose })` where `onFilterChange: (partial: Partial<SetFilterState>) => void`. `SetFilterButton({ onClick, count })`.

- [ ] **Step 1: Implement `SetFilterSidebar.tsx`**

Create `src/components/catalog/SetFilterSidebar.tsx`:

```tsx
'use client';

import { X, SlidersHorizontal } from 'lucide-react';
import type { SetFilterState } from '@/lib/set-filter-logic';
import type { SetFilterOptions } from '@/hooks/useSetFilter';
import type { Gender } from '@/lib/types';
import { ColorSwatch } from './ColorSwatch';
import { cn } from '@/lib/utils';

interface SetFilterSidebarProps {
  filters: SetFilterState;
  filterOptions: SetFilterOptions;
  onFilterChange: (filters: Partial<SetFilterState>) => void;
  isOpen: boolean;
  onClose: () => void;
}

type ArrayFilterKey = 'groups' | 'categories' | 'brands' | 'colors' | 'sizes' | 'fits';

export function SetFilterSidebar({ filters, filterOptions, onFilterChange, isOpen, onClose }: SetFilterSidebarProps) {
  const toggleArrayFilter = (key: ArrayFilterKey, value: string) => {
    const current = filters[key];
    const newValue = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onFilterChange({ [key]: newValue });
  };

  const clearFilters = () => {
    onFilterChange({ groups: [], gender: null, categories: [], brands: [], colors: [], sizes: [], fits: [] });
  };

  const hasActiveFilters =
    filters.groups.length > 0 ||
    filters.gender !== null ||
    filters.categories.length > 0 ||
    filters.brands.length > 0 ||
    filters.colors.length > 0 ||
    filters.sizes.length > 0 ||
    filters.fits.length > 0;

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between p-4 border-b border-[#E5E5E5] lg:hidden">
        <h2 className="text-lg font-semibold">Filtros</h2>
        <button onClick={onClose} className="p-2 hover:bg-[#F5F5F7] rounded-full">
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-80px)] lg:max-h-none">
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-[#111111] underline transition-colors">
            Limpiar todos los filtros
          </button>
        )}

        {filterOptions.groups.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Grupo</h3>
            <div className="space-y-2">
              {filterOptions.groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.groups.includes(g.slug)}
                    onChange={() => toggleArrayFilter('groups', g.slug)}
                    className="w-4 h-4 accent-[#111111] rounded"
                  />
                  <span className="text-sm text-[#333333]">{g.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Género</h3>
          <div className="space-y-2">
            {(['Mujer', 'Hombre', 'Unisex'] as Gender[]).map((gender) => (
              <label key={gender} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="set-gender"
                  checked={filters.gender === gender}
                  onChange={() => onFilterChange({ gender })}
                  className="w-4 h-4 accent-[#111111]"
                />
                <span className="text-sm text-[#333333]">{gender}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="set-gender"
                checked={filters.gender === null}
                onChange={() => onFilterChange({ gender: null })}
                className="w-4 h-4 accent-[#111111]"
              />
              <span className="text-sm text-[#333333]">Todos</span>
            </label>
          </div>
        </div>

        {filterOptions.categories.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Categoría</h3>
            <div className="space-y-2">
              {filterOptions.categories.map((category) => (
                <label key={category} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(category)}
                    onChange={() => toggleArrayFilter('categories', category)}
                    className="w-4 h-4 accent-[#111111] rounded"
                  />
                  <span className="text-sm text-[#333333]">{category}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {filterOptions.brands.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Marca</h3>
            <div className="grid grid-cols-2 gap-2">
              {filterOptions.brands.map((brand) => {
                const isSelected = filters.brands.includes(brand);
                return (
                  <button
                    key={brand}
                    onClick={() => toggleArrayFilter('brands', brand)}
                    className={cn(
                      'px-3 py-2 text-xs font-medium rounded border transition-all duration-200 text-left',
                      isSelected
                        ? 'border-[#111111] bg-[#F5F5F7] text-[#111111]'
                        : 'border-gray-200 text-gray-500 hover:border-gray-400'
                    )}
                  >
                    {brand}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {filterOptions.colors.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Color</h3>
            <div className="flex flex-wrap gap-2">
              {filterOptions.colors.slice(0, 20).map((color) => (
                <ColorSwatch
                  key={color.id}
                  color={color}
                  isSelected={filters.colors.includes(color.id)}
                  onClick={() => toggleArrayFilter('colors', color.id)}
                  size="md"
                />
              ))}
            </div>
          </div>
        )}

        {filterOptions.sizes.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Talla</h3>
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
          </div>
        )}

        {filterOptions.fits.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Corte</h3>
            <div className="space-y-2">
              {filterOptions.fits.map((fit) => (
                <label key={fit} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.fits.includes(fit)}
                    onChange={() => toggleArrayFilter('fits', fit)}
                    className="w-4 h-4 accent-[#111111] rounded"
                  />
                  <span className="text-sm text-[#333333]">{fit}</span>
                </label>
              ))}
            </div>
          </div>
        )}
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

Note: unlike `FilterSidebar.tsx`, this component binds directly to the `filters` prop (no local-state mirror via `useEffect`) — the parent's `applyFilters` already re-renders synchronously, so the extra local-state layer would be redundant for this component. This is an intentional simplification, flagged for review.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `src/components/catalog/SetFilterSidebar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/catalog/SetFilterSidebar.tsx
git commit -m "feat(corporativo): SetFilterSidebar con Grupo/Genero/Categoria/Marca/Color/Talla/Corte"
```

---

### Task 5: `SetListItem` (vista Lista)

**Files:**
- Create: `src/components/catalog/SetListItem.tsx`

**Interfaces:**
- Consumes: `CorporateSetSummary` (`@/lib/corporate-types`); `MediaGridThumb` (`@/components/media/MediaGridThumb`); `MediaItem` (`@/lib/media`).
- Produces (consumed by Task 6): `SetListItem({ set, showPrices })`; `coverImageItem(imageUrl: string | null): MediaItem | undefined` (exported, replaces the copy currently inlined in `CorporativoContent.tsx`).

- [ ] **Step 1: Implement `SetListItem.tsx`**

Create `src/components/catalog/SetListItem.tsx`:

```tsx
import Link from 'next/link';
import { Building2, AlertTriangle } from 'lucide-react';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import type { CorporateSetSummary } from '@/lib/corporate-types';
import type { MediaItem } from '@/lib/media';

export function coverImageItem(imageUrl: string | null): MediaItem | undefined {
  if (!imageUrl) return undefined;
  return { url: imageUrl, type: 'image', mimeType: 'image/jpeg', width: null, height: null };
}

interface SetListItemProps {
  set: CorporateSetSummary;
  showPrices: boolean;
}

export function SetListItem({ set, showPrices }: SetListItemProps) {
  return (
    <Link
      href={`/corporativo/s/${set.slug}`}
      className="group flex gap-4 p-4 bg-white border border-[#E5E5E5] rounded-xl hover:border-[#111111] hover:shadow-md transition-all duration-300"
    >
      <div className="relative flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 bg-[#F5F5F7] rounded-lg overflow-hidden">
        {set.imageUrl ? (
          <MediaGridThumb
            item={coverImageItem(set.imageUrl)}
            fallback="/images/placeholder-product.jpg"
            alt={set.name}
            sizes="128px"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Building2 className="w-8 h-8" strokeWidth={1} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1">
          {set.brandName && <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{set.brandName}</p>}
          <h3 className="text-base sm:text-lg font-semibold text-[#111111] mb-1 group-hover:underline line-clamp-2">
            {set.name}
          </h3>
          <p className="text-sm text-gray-500">
            {set.pieceCount} {set.pieceCount === 1 ? 'pieza' : 'piezas'}
            {set.groupName && ` · ${set.groupName}`}
          </p>
        </div>

        <div className="flex items-center justify-between mt-3">
          {showPrices ? (
            set.referencePrice !== null ? (
              <div>
                <span className="text-lg font-bold text-[#111111]">${set.referencePrice.toFixed(2)}</span>
                <span className="text-xs text-gray-400 ml-1">/ set referencial</span>
                {set.hasMissingPrices && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                    <AlertTriangle className="w-3 h-3" /> Precio parcial
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-gray-400">Precio bajo cotización</span>
            )
          ) : (
            <span />
          )}

          <span className="px-4 py-2 bg-[#111111] text-white text-sm font-medium rounded-full group-hover:opacity-80 transition-opacity">
            Ver set
          </span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `src/components/catalog/SetListItem.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/catalog/SetListItem.tsx
git commit -m "feat(corporativo): SetListItem para la vista Lista del grid corporativo"
```

---

### Task 6: Reestructurar `CorporativoContent.tsx`

**Files:**
- Modify: `src/app/(store)/corporativo/CorporativoContent.tsx`

**Interfaces:**
- Consumes: `useSetFilter` (Task 3), `SetFilterSidebar`/`SetFilterButton` (Task 4), `SetListItem`/`coverImageItem` (Task 5), `LayoutSwitcher`/`ViewMode` (`@/components/catalog/LayoutSwitcher`, unmodified), `SetSortOption` (`@/lib/set-filter-logic`).
- Produces: nothing consumed by later tasks (this is the final integration point).

- [ ] **Step 1: Replace the full contents of `CorporativoContent.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Star, AlertTriangle, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CorporateSetSummary, SetGroupSummary } from '@/lib/corporate-types';
import { resolveRules, type BusinessRule } from '@/lib/rules-engine';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import { LayoutSwitcher, type ViewMode } from '@/components/catalog/LayoutSwitcher';
import { SetFilterSidebar, SetFilterButton } from '@/components/catalog/SetFilterSidebar';
import { SetListItem, coverImageItem } from '@/components/catalog/SetListItem';
import { useSetFilter } from '@/hooks/useSetFilter';
import type { SetSortOption } from '@/lib/set-filter-logic';

interface CorporativoContentProps {
  sets: CorporateSetSummary[];
  groups: SetGroupSummary[];
  /** Solo las reglas PRICE_VISIBILITY — se resuelven por set en el cliente (loop en memoria). */
  priceVisibilityRules: BusinessRule[];
  minQuantity: number;
}

export function CorporativoContent({ sets, groups, priceVisibilityRules, minQuantity }: CorporativoContentProps) {
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
  } = useSetFilter(sets, groups);

  const showPricesFor = (set: CorporateSetSummary): boolean => {
    const resolved = resolveRules(priceVisibilityRules, {
      setId: set.id,
      setGroupId: set.setGroupId,
      brandId: set.brandId,
      productIds: set.productIds,
    });
    return (
      resolved.priceVisibility.showPrices &&
      (resolved.priceVisibility.catalog === 'CORPORATE' || resolved.priceVisibility.catalog === 'BOTH')
    );
  };

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
                      <SetListItem key={set.id} set={set} showPrices={showPricesFor(set)} />
                    ) : (
                      <Link
                        key={set.id}
                        href={`/corporativo/s/${set.slug}`}
                        className="group border border-[#E5E5E5] rounded-xl overflow-hidden hover:shadow-lg transition-shadow bg-white"
                      >
                        <div className="relative aspect-[4/5] bg-[#F5F5F7] overflow-hidden">
                          {set.imageUrl ? (
                            <MediaGridThumb
                              item={coverImageItem(set.imageUrl)}
                              fallback="/images/placeholder-product.jpg"
                              alt={set.name}
                              className="object-cover group-hover:scale-105 transition-transform duration-500"
                              sizes="400px"
                            />
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
                        </div>
                        <div className="p-4">
                          {set.brandName && <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{set.brandName}</p>}
                          <h3 className="font-semibold text-[#111111] mb-1">{set.name}</h3>
                          <p className="text-sm text-gray-500 mb-3">
                            {set.pieceCount} {set.pieceCount === 1 ? 'pieza' : 'piezas'}
                            {set.groupName && ` · ${set.groupName}`}
                          </p>
                          {showPricesFor(set) &&
                            (set.referencePrice !== null ? (
                              <div>
                                <span className="text-lg font-bold text-[#111111]">${set.referencePrice.toFixed(2)}</span>
                                <span className="text-xs text-gray-400 ml-1">/ set referencial</span>
                                {set.hasMissingPrices && (
                                  <span className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                                    <AlertTriangle className="w-3 h-3" /> Precio parcial
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">Precio bajo cotización</span>
                            ))}
                        </div>
                      </Link>
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
    </main>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/app/\(store\)/corporativo/CorporativoContent.tsx src/components/catalog/SetFilterSidebar.tsx src/components/catalog/SetListItem.tsx src/hooks/useSetFilter.ts src/lib/set-filter-logic.ts`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: all suites pass, including the new `set-filter-logic.test.ts` and every pre-existing suite (confirms `/catalogo` and the rest of the corporate flow are untouched).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(store)/corporativo/CorporativoContent.tsx"
git commit -m "feat(corporativo): adoptar layout de filtrado y grilla del catalogo individual"
```

---

### Task 7: Validación final y reporte

**Files:**
- Create: `docs/reports/REPORTE-corporativo-layout-catalogo-<fecha-de-ejecucion>.md` (usar la fecha real en que se ejecuta esta tarea, no una fecha fija del plan)

- [ ] **Step 1: Full validation sweep**

Run in order, recording pass/fail of each:
1. `npx tsc --noEmit`
2. `npx eslint .` (or the project's existing lint script from `package.json`)
3. `npx vitest run`
4. `npm run build`

All four must be green before proceeding.

- [ ] **Step 2: Write the session report**

Create `docs/reports/REPORTE-corporativo-layout-catalogo-<fecha>.md` following this repo's existing report format (see `docs/reports/REPORTE-corporativo-armador-2026-07-12.md` for structure/tone) containing: Resumen Ejecutivo, checklist de Verificación Manual en Producción (must explicitly list: filtros combinados Navy+M sobre un set con atributos en piezas distintas; multi-selección de Grupo; vista Lista; cambio de columnas 4/3/2; paginación; orden por precio referencial asc/desc; orden Más recientes por `createdAt`; `PRICE_VISIBILITY` ocultando precios en cards de grid y de lista; responsive móvil del sidebar — abrir/cerrar drawer; regresión visual de `/catalogo` — confirmar que no cambió), Migraciones Ejecutadas ("ninguna"), Builds y Validaciones (resultados del Step 1), Commits Sugeridos (el commit de referencia del prompt original), y las 2 decisiones autónomas flagueadas (vista Lista = `SetListItem` nuevo, no reutilización de `ProductListItem`; "Relevancia"/"Más recientes" replican el criterio del individual salvo el uso de `isNew`, sustituido por `createdAt` real).

- [ ] **Step 3: Present executive summary in chat**

Summarize the same content from Step 2 directly in the conversation (per the project's global execution instructions — no separate summary markdown files beyond the one report already created in Step 2).

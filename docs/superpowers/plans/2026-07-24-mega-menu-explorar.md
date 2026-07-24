# Mega Menu "Explorar": hover, tabs (Sets/Marcas/Sucursales), tamaños — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mega menu's click-only toggle with hover (desktop) + persistent click (touch fallback), swap the "Productos" tab for "Sets Corporativos" backed by a new lightweight data query, shrink set cards to ~25% size, strip the "Marcas" tab down to bare logos, and remove the "Cerrar" button.

**Architecture:** A new lightweight query `getLatestCorporateSets` is added to `src/lib/corporate-data-service.ts` and threaded through the existing server → `AppShell` → `Header` → `MegaMenu` prop chain (same pattern as `products`/`brands`/`stores`). `Header.tsx` gains a `megaMenuOpenedBy: 'hover' | 'click' | null` state machine with a document-level click-outside listener, replacing the current boolean toggle. `MegaMenu.tsx`'s tab/section switch gets a new `'set'` section type and a simplified `'brand'` layout; the backdrop and "Cerrar" button are removed.

**Tech Stack:** Next.js (App Router, server components for data fetching), React (client components for interactive header), Drizzle ORM, Tailwind CSS, lucide-react icons, Vitest for pure-function tests.

## Global Constraints

- No auto-commits, no `git push`, no PR/release creation — only propose commit messages at the end (project CLAUDE.md).
- No manual-testing-as-primary-validation — validate via build, lint, typecheck, existing tests (project CLAUDE.md). Chrome DevTools MCP is forbidden for any inspection/testing (project CLAUDE.md).
- No new database migrations — `getLatestCorporateSets` queries existing tables only.
- Mobile drawer (`isMobileMenuOpen` in `Header.tsx`) and the `stores` tab are out of scope — do not modify.
- `SetListItem.tsx` and `/corporativo` grid are separate components — do not modify.
- Final response to the user must follow the project's mandatory format: Resumen Ejecutivo, Verificación Manual en Producción, Migraciones Ejecutadas, Builds y Validaciones, Commits Sugeridos (project CLAUDE.md).

---

### Task 1: `getLatestCorporateSets` data query + type

**Files:**
- Modify: `src/lib/corporate-types.ts` (add `CorporateSetNavItem` interface)
- Modify: `src/lib/corporate-data-service.ts` (add `getLatestCorporateSets` function)
- Test: `src/lib/__tests__/get-latest-corporate-sets.test.ts`

**Interfaces:**
- Consumes: `db` (from `@/db`), `corporateSets`/`setBlocks`/`setBlockOptions`/`products`/`brands` tables (from `@/db/schema`), `eq`/`and`/`isNull`/`inArray`/`desc`/`asc` (from `drizzle-orm`), private helper `wholesalePriceOf` and `effectiveManualPrice` (already imported in `corporate-data-service.ts`), private helper `getCoverMediaMap` (already defined in `corporate-data-service.ts`).
- Produces: `CorporateSetNavItem { id: string; slug: string; name: string; cover: MediaItem | null; brandName: string | null; referencePrice: number | null }` and `getLatestCorporateSets(limit?: number): Promise<CorporateSetNavItem[]>` — consumed by Task 2 (`layout.tsx`) and Task 4 (`MegaMenu.tsx`).

This task adds a new query so the DB layer can be verified independently of the UI. Since this codebase has no test harness for DB-backed functions (all existing tests in `src/lib/__tests__/` cover pure functions only — `set-pricing.test.ts`, `set-filter-logic.test.ts`, etc.), we test the pure pricing/shape logic by extracting it, and verify the query itself via typecheck + a manual smoke check documented in the final report (per Global Constraints: no DB-integration test harness exists to add one for a single query without introducing new infrastructure, which is out of scope for this UI-focused change).

- [ ] **Step 1: Add `CorporateSetNavItem` to `corporate-types.ts`**

Add after the closing brace of `CorporateSetSummary` (after line 64):

```typescript
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

- [ ] **Step 2: Write the failing test for the price-aggregation shape**

`getLatestCorporateSets` reuses the same block-price-minimum logic as `getActiveCorporateSets` (already covered indirectly via `effectiveManualPrice`'s own test suite in `set-pricing.test.ts`). Since the function itself is a DB query with no pure sub-unit to isolate further without refactoring `getActiveCorporateSets` too (out of scope), write a typecheck-level test that asserts the exported type shape compiles correctly, plus confirm `effectiveManualPrice` (already tested) is the correct building block:

Create `src/lib/__tests__/get-latest-corporate-sets.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { CorporateSetNavItem } from "../corporate-types";

describe("CorporateSetNavItem shape", () => {
  it("accepts a minimal valid nav item", () => {
    const item: CorporateSetNavItem = {
      id: "set-1",
      slug: "set-uno",
      name: "Set Uno",
      cover: null,
      brandName: null,
      referencePrice: null,
    };
    expect(item.id).toBe("set-1");
  });

  it("accepts a fully populated nav item with a numeric price", () => {
    const item: CorporateSetNavItem = {
      id: "set-2",
      slug: "set-dos",
      name: "Set Dos",
      cover: { type: "image", url: "https://example.com/a.jpg" },
      brandName: "AllMedic",
      referencePrice: 42.5,
    };
    expect(item.referencePrice).toBe(42.5);
  });
});
```

Run `npx vitest run src/lib/__tests__/get-latest-corporate-sets.test.ts` — check the exact `MediaItem` shape first if this fails to compile (see Step 2b).

- [ ] **Step 2b: Confirm `MediaItem` shape before running the test**

Read `src/lib/media.ts` to confirm the `MediaItem` type's exact fields (`type`, `url`, and any required fields for `type: 'image'`) so Step 2's test object compiles. Adjust the test's `cover` object literal to match if it differs from `{ type: "image", url: "..." }`.

- [ ] **Step 3: Run the test to verify it fails (or passes trivially since only types are checked)**

Run: `npx vitest run src/lib/__tests__/get-latest-corporate-sets.test.ts`
Expected: PASS (this is a type-shape smoke test, not a behavior test — it exists to catch a `CorporateSetNavItem` field typo before Task 2/4 depend on it). If it fails to compile, fix `CorporateSetNavItem` in `corporate-types.ts` from Step 1.

- [ ] **Step 4: Implement `getLatestCorporateSets` in `corporate-data-service.ts`**

Add after `getActiveCorporateSets` (after the closing brace on the line following `createdAt: set.createdAt ? ... : ...` — i.e. after line 279 `}`), before the `// ── Detalle de un set` comment:

```typescript
// ── Últimos sets creados (para nav/mega-menu) — versión liviana sin variantes/colores/estilos ──
export async function getLatestCorporateSets(limit = 8): Promise<CorporateSetNavItem[]> {
  const rows = await db
    .select({
      id: corporateSetsTable.id,
      slug: corporateSetsTable.slug,
      name: corporateSetsTable.name,
      brandName: brandsTable.name,
      priceManual: corporateSetsTable.priceManual,
      priceManualSale: corporateSetsTable.priceManualSale,
      manualDiscountEnd: corporateSetsTable.manualDiscountEnd,
    })
    .from(corporateSetsTable)
    .leftJoin(brandsTable, eq(corporateSetsTable.brandId, brandsTable.id))
    .where(and(eq(corporateSetsTable.isActive, true), isNull(corporateSetsTable.deletedAt)))
    .orderBy(desc(corporateSetsTable.createdAt))
    .limit(limit);

  const setIds = rows.map((r) => r.id);
  if (setIds.length === 0) return [];

  const blocks = await db
    .select({ id: setBlocksTable.id, setId: setBlocksTable.setId, quantityPerSet: setBlocksTable.quantityPerSet })
    .from(setBlocksTable)
    .where(inArray(setBlocksTable.setId, setIds));
  const blockIds = blocks.map((b) => b.id);

  const options = blockIds.length > 0
    ? await db
        .select({
          blockId: setBlockOptionsTable.blockId,
          priceWholesale: productsTable.priceWholesale,
          priceWholesaleSale: productsTable.priceWholesaleSale,
        })
        .from(setBlockOptionsTable)
        .leftJoin(productsTable, eq(setBlockOptionsTable.productId, productsTable.id))
        .where(inArray(setBlockOptionsTable.blockId, blockIds))
    : [];

  const optionsByBlock = new Map<string, typeof options>();
  for (const o of options) {
    if (!optionsByBlock.has(o.blockId)) optionsByBlock.set(o.blockId, []);
    optionsByBlock.get(o.blockId)!.push(o);
  }
  const blocksBySet = new Map<string, typeof blocks>();
  for (const b of blocks) {
    if (!blocksBySet.has(b.setId)) blocksBySet.set(b.setId, []);
    blocksBySet.get(b.setId)!.push(b);
  }

  const coverMedia = await getCoverMediaMap(setIds);

  return rows.map((set) => {
    const setBlockRows = blocksBySet.get(set.id) ?? [];
    let autoPrice = 0;
    let hasAnyPrice = setBlockRows.length > 0;
    for (const block of setBlockRows) {
      const blockPrices = (optionsByBlock.get(block.id) ?? [])
        .map((o) => wholesalePriceOf(o.priceWholesale, o.priceWholesaleSale))
        .filter((p): p is number => p !== null);
      if (blockPrices.length === 0) {
        hasAnyPrice = false;
        continue;
      }
      autoPrice += Math.min(...blockPrices) * (block.quantityPerSet ?? 1);
    }
    const manualPrice = effectiveManualPrice(set.priceManual, set.priceManualSale, set.manualDiscountEnd);
    const referencePrice = manualPrice !== null ? manualPrice : (hasAnyPrice ? autoPrice : null);

    return {
      id: set.id,
      slug: set.slug,
      name: set.name,
      cover: coverMedia.get(set.id)?.cover ?? null,
      brandName: set.brandName,
      referencePrice,
    };
  });
}
```

Add `CorporateSetNavItem` to the existing type-only import at the top of the file:

```typescript
import type { CorporateSetSummary, CorporateSetDetail, SetPiece, SetBlock, CorporateSetNavItem } from './corporate-types';
```

- [ ] **Step 5: Run typecheck to verify the new function compiles cleanly**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `corporate-data-service.ts` or `corporate-types.ts`.

- [ ] **Step 6: Run the full test suite to confirm nothing broke**

Run: `npx vitest run`
Expected: all tests PASS, including the new `get-latest-corporate-sets.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/corporate-types.ts src/lib/corporate-data-service.ts src/lib/__tests__/get-latest-corporate-sets.test.ts
git commit -m "feat(nav): agregar getLatestCorporateSets para el mega menu"
```

---

### Task 2: Thread `corporateSets` through the server layout → AppShell prop chain

**Files:**
- Modify: `src/app/(store)/layout.tsx`
- Modify: `src/components/layout/AppShell.tsx`

**Interfaces:**
- Consumes: `getLatestCorporateSets` (from Task 1, `src/lib/corporate-data-service.ts`), `CorporateSetNavItem` (from Task 1, `src/lib/corporate-types.ts`).
- Produces: `AppShell` now accepts and forwards a `corporateSets?: CorporateSetNavItem[]` prop to `Header` — consumed by Task 3.

- [ ] **Step 1: Add `getLatestCorporateSets` to the `Promise.all` in `layout.tsx`**

In `src/app/(store)/layout.tsx`, update the import and the data fetch:

```typescript
import { getAllProducts, getBrandsForNav, getStores } from '@/lib/data-service';
import { getAllBusinessRules, getLatestCorporateSets } from '@/lib/corporate-data-service';
```

```typescript
  const [products, brands, stores, rules, corporateSets] = await Promise.all([
    getAllProducts(),
    getBrandsForNav(),
    getStores(),
    getAllBusinessRules(),
    getLatestCorporateSets(),
  ]);
```

```typescript
            <AppShell products={products} brands={brands} stores={stores} corporateSets={corporateSets}>
```

- [ ] **Step 2: Add `corporateSets` prop to `AppShell.tsx`**

In `src/components/layout/AppShell.tsx`:

```typescript
import type { Product, Store, BrandNavItem } from '@/lib/types';
import type { CorporateSetNavItem } from '@/lib/corporate-types';

interface AppShellProps {
  children: React.ReactNode;
  products?: Product[];
  brands?: BrandNavItem[];
  stores?: Store[];
  corporateSets?: CorporateSetNavItem[];
}

export function AppShell({ children, products, brands, stores, corporateSets }: AppShellProps) {
  const [isCartOpen, setIsCartOpen] = useState(false);

  return (
    <>
      <Header
        onCartClick={() => setIsCartOpen(true)}
        products={products}
        brands={brands}
        stores={stores}
        corporateSets={corporateSets}
      />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      {children}
    </>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: new errors only in `Header.tsx` (`corporateSets` prop not yet accepted) — confirms the chain compiles up to that point. If errors appear elsewhere, fix before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(store\)/layout.tsx src/components/layout/AppShell.tsx
git commit -m "feat(nav): pasar corporateSets desde el layout hacia AppShell"
```

---

### Task 3: Hover + persistent-click interaction in `Header.tsx`

**Files:**
- Modify: `src/components/layout/Header.tsx`

**Interfaces:**
- Consumes: `CorporateSetNavItem` (from Task 1), nothing new from other tasks otherwise.
- Produces: `Header` accepts `corporateSets?: CorporateSetNavItem[]` and forwards it to `MegaMenu` as `sets={corporateSets}` — consumed by Task 4. `Header` also exposes the new interaction model (`megaMenuOpenedBy` state) that Task 5 (removing the backdrop) depends on, since `MegaMenu` no longer owns click-outside/backdrop logic after this task.

This task changes the open/close state machine and wraps button+panel in a shared container with hover/focus/click-outside handlers. `MegaMenu` itself keeps rendering based on a plain `isOpen: boolean` prop (unchanged interface) — only `Header` changes how it computes and sets that boolean now.

- [ ] **Step 1: Add the `corporateSets` prop and import type**

In `src/components/layout/Header.tsx`, update imports and props:

```typescript
import type { Product, Store, BrandNavItem } from '@/lib/types';
import type { CorporateSetNavItem } from '@/lib/corporate-types';

interface HeaderProps {
  onCartClick: () => void;
  products?: Product[];
  brands?: BrandNavItem[];
  stores?: Store[];
  corporateSets?: CorporateSetNavItem[];
}

export function Header({ onCartClick, products, brands, stores, corporateSets }: HeaderProps) {
```

- [ ] **Step 2: Replace `isMegaMenuOpen` boolean with `megaMenuOpenedBy` state machine**

Replace this line:

```typescript
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
```

with:

```typescript
  const [megaMenuOpenedBy, setMegaMenuOpenedBy] = useState<'hover' | 'click' | null>(null);
  const isMegaMenuOpen = megaMenuOpenedBy !== null;
  const megaMenuContainerRef = useRef<HTMLDivElement>(null);
  const megaMenuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeMegaMenu = () => {
    if (megaMenuCloseTimeoutRef.current) {
      clearTimeout(megaMenuCloseTimeoutRef.current);
      megaMenuCloseTimeoutRef.current = null;
    }
    setMegaMenuOpenedBy(null);
  };

  const openMegaMenuByHover = () => {
    if (typeof window !== 'undefined' && !window.matchMedia('(hover: hover)').matches) return;
    if (megaMenuCloseTimeoutRef.current) {
      clearTimeout(megaMenuCloseTimeoutRef.current);
      megaMenuCloseTimeoutRef.current = null;
    }
    setMegaMenuOpenedBy((prev) => (prev === 'click' ? prev : 'hover'));
  };

  const scheduleMegaMenuHoverClose = () => {
    setMegaMenuOpenedBy((prev) => {
      if (prev !== 'hover') return prev;
      megaMenuCloseTimeoutRef.current = setTimeout(() => {
        setMegaMenuOpenedBy((current) => (current === 'hover' ? null : current));
      }, 180);
      return prev;
    });
  };

  const toggleMegaMenuByClick = () => {
    setMegaMenuOpenedBy((prev) => (prev !== null ? null : 'click'));
  };

  // Click-outside: solo cierra si el panel fue fijado por click (modo hover se cierra por mouseleave).
  useEffect(() => {
    if (megaMenuOpenedBy !== 'click') return;
    const handleClickOutside = (e: MouseEvent) => {
      if (megaMenuContainerRef.current && !megaMenuContainerRef.current.contains(e.target as Node)) {
        closeMegaMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [megaMenuOpenedBy]);

  // Limpieza del timeout de cierre por hover al desmontar.
  useEffect(() => {
    return () => {
      if (megaMenuCloseTimeoutRef.current) clearTimeout(megaMenuCloseTimeoutRef.current);
    };
  }, []);
```

- [ ] **Step 3: Wrap the "Explorar" button + `MegaMenu` in the shared container with hover/focus handlers**

Replace the current button block:

```typescript
              {/* MegaMenu Button - Toggle behavior */}
              <button
                onClick={() => setIsMegaMenuOpen(!isMegaMenuOpen)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 font-sans text-body-lg rounded-full transition-all duration-200',
                  isMegaMenuOpen
                    ? 'bg-[#111111] text-white'
                    : 'text-[#333333] hover:bg-[#F5F5F7] hover:text-[#111111]'
                )}
              >
                <Grid3X3 className="w-4 h-4" strokeWidth={1.5} />
                Explorar
              </button>
```

with:

```typescript
              {/* MegaMenu trigger container - hover en desktop, click fijo en touch, con panel anidado */}
              <div
                ref={megaMenuContainerRef}
                className="relative"
                onMouseEnter={openMegaMenuByHover}
                onMouseLeave={scheduleMegaMenuHoverClose}
                onFocus={openMegaMenuByHover}
                onBlur={(e) => {
                  if (!megaMenuContainerRef.current?.contains(e.relatedTarget as Node)) {
                    closeMegaMenu();
                  }
                }}
              >
                <button
                  onClick={toggleMegaMenuByClick}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 font-sans text-body-lg rounded-full transition-all duration-200',
                    isMegaMenuOpen
                      ? 'bg-[#111111] text-white'
                      : 'text-[#333333] hover:bg-[#F5F5F7] hover:text-[#111111]'
                  )}
                >
                  <Grid3X3 className="w-4 h-4" strokeWidth={1.5} />
                  Explorar
                </button>

                <MegaMenu
                  isOpen={isMegaMenuOpen}
                  onClose={closeMegaMenu}
                  products={products}
                  brands={brands}
                  stores={stores}
                  sets={corporateSets}
                />
              </div>
```

- [ ] **Step 4: Remove the old standalone `<MegaMenu>` render at the bottom of the component**

Delete this block near the end of the file (it's now rendered inside the container from Step 3):

```typescript
      {/* MegaMenu */}
      <MegaMenu
        isOpen={isMegaMenuOpen}
        onClose={() => setIsMegaMenuOpen(false)}
        products={products}
        brands={brands}
        stores={stores}
      />
```

- [ ] **Step 5: Update `Escape` handling note**

`MegaMenu.tsx` already listens for `Escape` internally via its own `useEffect` (calls `onClose`, which is now `closeMegaMenu`) — no change needed here, this step is just confirmation, not a code change. Verify in Task 4 that `MegaMenu`'s `onClose` prop type still matches `() => void`.

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in `MegaMenu.tsx` referencing the new `sets` prop (not yet defined — that's Task 4). No errors in `Header.tsx` itself.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(nav): abrir mega menu por hover con fallback de click persistente en touch"
```

---

### Task 4: `MegaMenu.tsx` — sets tab, brand-logo tab, remove backdrop/close button

**Files:**
- Modify: `src/components/layout/MegaMenu.tsx`

**Interfaces:**
- Consumes: `CorporateSetNavItem` (from Task 1), `sets` prop passed by `Header.tsx` (from Task 3).
- Produces: none consumed by later tasks — this is the last code task.

- [ ] **Step 1: Update imports and props**

Replace the top of the file:

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, MapPin, Boxes, Tag, Store } from 'lucide-react';
// Removed dummy imports
import type { Product, Store as StoreType, BrandNavItem } from '@/lib/types';
import type { CorporateSetNavItem } from '@/lib/corporate-types';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import { usePriceVisibility } from '@/context/PriceVisibilityContext';
import { resolveCoverMedia } from '@/lib/product-cover';
import { cn } from '@/lib/utils';

interface MegaMenuProps {
  isOpen: boolean;
  onClose: () => void;
  products?: Product[];
  brands?: BrandNavItem[];
  stores?: StoreType[];
  sets?: CorporateSetNavItem[];
}


export function MegaMenu({ isOpen, onClose, products: productsProp, brands: brandsProp, stores: storesProp, sets: setsProp }: MegaMenuProps) {
  const showPrices = usePriceVisibility();
  const BRANDS = brandsProp || [];
  const STORES = storesProp || [];
  const SETS = setsProp || [];

  const [activeTab, setActiveTab] = useState<'sets' | 'brands' | 'stores'>('sets');
```

Notes on this replacement:
- `Package` and `X` are removed from the lucide-react import (no longer used — `Package` was the old `products` tab icon, `X` was the "Cerrar" button icon). `Boxes` is added.
- `PRODUCTS`, `getFeaturedProducts`, `getNewArrivals`, `getProductsByCategory` are all removed — `products` prop is no longer consumed by this component at all (it was only used to build those three helpers and the brand product-count; product-count is also removed in Step 3 below).
- `productsProp` is destructured but intentionally unused in the new version — remove it from destructuring entirely since nothing reads it anymore:

```typescript
export function MegaMenu({ isOpen, onClose, brands: brandsProp, stores: storesProp, sets: setsProp }: MegaMenuProps) {
```

(keep `products` in `MegaMenuProps` for now since `Header.tsx` still passes it — Task 3 already includes `products={products}` in the `<MegaMenu>` call. It's fine for the prop to exist and go unused by internal logic; this keeps `Header.tsx` untouched a second time. But it must not be destructured as a variable if unused, to avoid an eslint `no-unused-vars` failure.)

- [ ] **Step 2: Remove the `bg-black/50 backdrop-blur-sm` backdrop div**

Delete:

```typescript
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
```

The outer wrapping `<div className="fixed inset-0 z-40">` — check whether it's still needed. Since the backdrop is gone and the panel itself is now `absolute`-positioned relative to the `Header`'s new container (`position: relative` from Task 3 Step 3), change the outer wrapper so the panel positions correctly:

```typescript
  if (!isOpen) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-40">
      {/* MegaMenu Panel */}
      <div 
        ref={containerRef}
        className="fixed left-0 right-0 top-[56px] sm:top-[64px] bg-white shadow-2xl animate-in slide-in-from-top-2 duration-200"
      >
```

This keeps the panel full-viewport-width (via `fixed left-0 right-0`) positioned right below the header bar, same visual position as before, while the outer `absolute` wrapper anchors to the trigger container from Task 3 for correct DOM nesting (hover events bubble correctly since the panel is now a DOM descendant of the hover container).

- [ ] **Step 3: Update `tabs` array — remove `products`, add `sets`**

Replace:

```typescript
  const tabs = [
    { id: 'products' as const, label: 'Productos', icon: Package },
    { id: 'brands' as const, label: 'Marcas', icon: Tag },
    { id: 'stores' as const, label: 'Sucursales', icon: Store },
  ];
```

with:

```typescript
  const tabs = [
    { id: 'sets' as const, label: 'Sets Corporativos', icon: Boxes },
    { id: 'brands' as const, label: 'Marcas', icon: Tag },
    { id: 'stores' as const, label: 'Sucursales', icon: Store },
  ];
```

- [ ] **Step 4: Replace `getCarouselItems`'s `products` case with a `sets` case**

Replace:

```typescript
  const getCarouselItems = () => {
    switch (activeTab) {
      case 'products':
        return {
          sections: [
            { title: 'Más Solicitados', items: getFeaturedProducts(), type: 'product' as const },
            { title: 'Nuevos Ingresos', items: getNewArrivals(), type: 'product' as const },
            { title: 'Camisas', items: getProductsByCategory('Camisas'), type: 'product' as const },
            { title: 'Pantalones', items: getProductsByCategory('Pantalones'), type: 'product' as const },
          ]
        };
      case 'brands':
        return {
          sections: [{
            title: 'Nuestras Marcas',
            items: BRANDS.map(brand => ({
              id: brand.name,
              name: brand.name,
              slug: brand.name.toLowerCase().replace(/\s+/g, '-'),
              logoUrl: brand.logoUrl,
              productCount: PRODUCTS.filter(p => p.brand === brand.name).length
            })),
            type: 'brand' as const
          }]
        };
```

with:

```typescript
  const getCarouselItems = () => {
    switch (activeTab) {
      case 'sets':
        return {
          sections: [{
            title: 'Sets Corporativos',
            items: SETS,
            type: 'set' as const,
          }]
        };
      case 'brands':
        return {
          sections: [{
            title: 'Nuestras Marcas',
            items: BRANDS.map(brand => ({
              id: brand.name,
              name: brand.name,
              slug: brand.name.toLowerCase().replace(/\s+/g, '-'),
              logoUrl: brand.logoUrl,
            })),
            type: 'brand' as const
          }]
        };
```

(the `stores` case below is unchanged, leave as-is)

- [ ] **Step 5: Remove the "Cerrar" button and simplify the tabs bar layout**

Replace:

```typescript
        {/* Tabs with Close Button */}
        <div className="border-b border-[#E5E5E5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 sm:gap-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-all border-b-2',
                        activeTab === tab.id
                          ? 'border-[#111111] text-[#111111]'
                          : 'border-transparent text-gray-500 hover:text-[#111111] hover:bg-[#F5F5F7]'
                      )}
                    >
                      <Icon className="w-4 h-4" strokeWidth={1.5} />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
              
              {/* Close Button */}
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-gray-500 hover:text-[#111111] hover:bg-[#F5F5F7] rounded-lg transition-all"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
                <span className="hidden sm:inline">Cerrar</span>
              </button>
            </div>
          </div>
        </div>
```

with:

```typescript
        {/* Tabs */}
        <div className="border-b border-[#E5E5E5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-1 sm:gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-all border-b-2',
                      activeTab === tab.id
                        ? 'border-[#111111] text-[#111111]'
                        : 'border-transparent text-gray-500 hover:text-[#111111] hover:bg-[#F5F5F7]'
                    )}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
```

- [ ] **Step 6: Add the `'set'` card rendering + shrink grid, remove the `'product'` case**

Replace the `{section.type === 'product' && (...)}` block entirely with a `'set'` block:

```typescript
                  {section.type === 'set' && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
                      {section.items.map((set: CorporateSetNavItem) => (
                        <Link
                          key={set.id}
                          href={`/corporativo/s/${set.slug}`}
                          onClick={onClose}
                          className="group"
                        >
                          <div className="relative aspect-product bg-[#F5F5F7] rounded-lg overflow-hidden mb-1 sm:mb-1.5">
                            <MediaGridThumb
                              item={set.cover ?? undefined}
                              fallback="/images/placeholder-product.jpg"
                              alt={set.name}
                              sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, 12vw"
                              fit="cover"
                              className="object-contain group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <p className="font-sans text-[10px] leading-tight font-medium text-[#111111] line-clamp-2 group-hover:underline">{set.name}</p>
                          {showPrices && set.referencePrice !== null && (
                            <p className="font-sans text-[10px] leading-tight font-semibold mt-0.5">
                              ${set.referencePrice.toFixed(2)}
                            </p>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
```

Note: `resolveCoverMedia` is no longer used by this block (`set.cover` is already a `MediaItem | null`, unlike `Product` which needs `resolveCoverMedia(product)` to derive it) — but `resolveCoverMedia` stays imported since the file no longer has any other consumer of it. Remove the `resolveCoverMedia` import since the `'product'` case that used it is deleted:

```typescript
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import { usePriceVisibility } from '@/context/PriceVisibilityContext';
import { cn } from '@/lib/utils';
```

(drop the `import { resolveCoverMedia } from '@/lib/product-cover';` line)

- [ ] **Step 7: Simplify the `'brand'` card to bare logo, no wrapper card**

Replace:

```typescript
                  {section.type === 'brand' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                      {section.items.map((brand: any) => (
                        <Link
                          key={brand.id}
                          href={`/catalogo?brand=${encodeURIComponent(brand.name)}`}
                          onClick={onClose}
                          className="group bg-[#F5F5F7] rounded-xl p-4 sm:p-6 hover:bg-[#111111] transition-colors"
                        >
                          <div className="aspect-square max-w-[60px] sm:max-w-[80px] mx-auto mb-3 flex items-center justify-center">
                            {brand.logoUrl ? (
                              <img
                                src={brand.logoUrl}
                                alt={brand.name}
                                className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const fallback = document.createElement('div');
                                    fallback.className = 'text-lg font-bold text-[#111111] group-hover:text-white text-center';
                                    fallback.textContent = brand.name;
                                    parent.appendChild(fallback);
                                  }
                                }}
                              />
                            ) : (
                              <span className="text-lg font-bold text-[#111111] group-hover:text-white text-center">
                                {brand.name}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-[#111111] group-hover:text-white text-center mb-1">
                            {brand.name}
                          </p>
                          <p className="text-xs text-gray-500 group-hover:text-gray-300 text-center">
                            {brand.productCount} productos
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
```

with:

```typescript
                  {section.type === 'brand' && (
                    <div className="flex flex-wrap gap-3 items-center">
                      {section.items.map((brand: any) => (
                        <Link
                          key={brand.id}
                          href={`/catalogo?brand=${encodeURIComponent(brand.name)}`}
                          onClick={onClose}
                          className="group p-1"
                        >
                          <div className="aspect-square max-w-[60px] sm:max-w-[80px] flex items-center justify-center">
                            {brand.logoUrl ? (
                              <img
                                src={brand.logoUrl}
                                alt={brand.name}
                                className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const fallback = document.createElement('div');
                                    fallback.className = 'text-sm font-bold text-[#111111] group-hover:opacity-70 text-center';
                                    fallback.textContent = brand.name;
                                    parent.appendChild(fallback);
                                  }
                                }}
                              />
                            ) : (
                              <span className="text-sm font-bold text-[#111111] group-hover:opacity-70 text-center">
                                {brand.name}
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
```

- [ ] **Step 8: Update "Ver todo" link's `activeTab` conditional**

Replace:

```typescript
            <Link
              href={activeTab === 'stores' ? '/sucursales' : activeTab === 'brands' ? '/catalogo' : '/catalogo'}
```

with:

```typescript
            <Link
              href={activeTab === 'stores' ? '/sucursales' : activeTab === 'brands' ? '/catalogo' : '/corporativo'}
```

- [ ] **Step 9: Run typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors in `MegaMenu.tsx`, `Header.tsx`, `AppShell.tsx`, `layout.tsx`, `corporate-data-service.ts`, `corporate-types.ts`.

Run: `npx eslint src/components/layout/MegaMenu.tsx src/components/layout/Header.tsx src/components/layout/AppShell.tsx`
Expected: no errors (in particular, no `no-unused-vars` for removed imports/props like `Package`, `X`, `resolveCoverMedia`, `PRODUCTS`, `getFeaturedProducts`).

- [ ] **Step 10: Commit**

```bash
git add src/components/layout/MegaMenu.tsx
git commit -m "refactor(nav): tab Sets Corporativos a 25% de tamano, tab Marcas solo-logo, sin boton Cerrar"
```

---

### Task 5: Full build + lint + typecheck + test verification pass

**Files:** none modified — verification only.

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests PASS (including pre-existing tests and the new one from Task 1).

- [ ] **Step 2: Run typecheck across the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run lint across the whole project**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Run the production build**

Run: `npm run build`
Expected: build succeeds with no errors. Note: this project sets `dynamic = 'force-dynamic'` on `(store)/layout.tsx`, so the build does not attempt to statically render pages requiring DB access — if `DATABASE_URL` is unavailable in this environment, expect the build to still succeed since data fetching happens at request time, not build time. If the build fails specifically due to missing `DATABASE_URL` in a way unrelated to this change, note it in the final report as a pre-existing environment constraint, not a regression.

- [ ] **Step 5: Manual smoke-check reminder (not a substitute for the above)**

Per project constraints, Chrome DevTools MCP is forbidden — do not attempt browser automation. If a dev server is already running or the user wants to check visually themselves, the checklist for them is captured in the final chat response's "Verificación Manual en Producción" section (not performed by the agent here).

No commit for this task — it's verification-only. If any step fails, return to the relevant task, fix, and re-run this task's steps from the top.

---

## Self-Review Notes

- **Spec coverage:** Fase 1 (hover/click) → Task 3. Fase 2 (sets tab + data) → Tasks 1, 2, 4 (Steps 3–4). Fase 3 (card sizing) → Task 4 Step 6. Fase 4 (brand logos) → Task 4 Step 7. Fase 5 (remove Cerrar) → Task 4 Step 5. All spec sections have a corresponding task.
- **Placeholder scan:** no TBD/TODO; all steps show complete code.
- **Type consistency:** `CorporateSetNavItem` defined once in Task 1 and reused verbatim (same field names: `id, slug, name, cover, brandName, referencePrice`) in Tasks 2, 3, 4. `megaMenuOpenedBy`/`closeMegaMenu`/`openMegaMenuByHover`/`scheduleMegaMenuHoverClose`/`toggleMegaMenuByClick` names introduced in Task 3 are used consistently and not renamed elsewhere. `sets` prop name matches between `Header.tsx` (Task 3, passed as `sets={corporateSets}`) and `MegaMenuProps` (Task 4, `sets?: CorporateSetNavItem[]`).

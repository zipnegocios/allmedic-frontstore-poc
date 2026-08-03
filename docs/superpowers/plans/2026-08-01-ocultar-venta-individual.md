# Ocultar venta individual y migrar accesos corporativos al Header global — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ocultar todos los accesos a venta individual (`/catalogo`) de la navegación pública, y mover los íconos de "Mi cuenta"/"Carrito corporativo" de FAB (solo visibles en `/corporativo/*`) al Header global (visibles en todo el sitio).

**Architecture:** `CorporateCartProvider` sube del layout de `/corporativo` al layout raíz de `(store)`. `CorporateAccountLink`/`CorporateCartButton` se reescriben de FAB fijo a botones ícono embebidos en `Header.tsx`. El buscador del Header pasa de operar sobre `products` a operar sobre `corporateSets`, redirigiendo a `/corporativo?q=`. `SetCatalogGrid`/`useSetFilter` ganan soporte de querystring (`?q=`, `?brand=`) para que esa redirección y los links de marca (MegaMenu/BrandCarousel/BrandCard) funcionen de punta a punta.

**Tech Stack:** Next.js (App Router), React client components, `next/navigation` (`useSearchParams`), TypeScript, Tailwind. Sin librería de testing de componentes en este repo — verificación vía build/lint/typecheck + checklist manual.

## Global Constraints

- `/catalogo` sigue existiendo como ruta — no se borra código ni la página, solo se ocultan sus accesos desde la navegación (spec, "Decisiones cerradas" punto 9).
- `CartContext`/`CartProvider`/`CartDrawer` quedan intactos por dentro — solo se remueve el trigger visual del Header (spec, punto 2).
- `src/legacy-pages/*` no se toca — confirmado sin ruteo activo en el sitio en vivo.
- No usar Chrome DevTools MCP para ninguna verificación (instrucción explícita del usuario en este pedido, y regla general de CLAUDE.md del repo).
- Prohibido: `git commit`, `git push`, creación de PRs — el trabajo queda en el working tree. Al final se sugiere el mensaje de commit en formato `git commit -m "ACTIVITY: ..."` (instrucción explícita del usuario en este pedido), sin ejecutarlo.
- Sincronización de querystring → filtros: se resuelve en el valor inicial de `useState` dentro de `useSetFilter` (lazy initializer), sin `useEffect`, para evitar un flash de filtros vacíos seguido de un re-render (spec, sección `SetCatalogGrid`/`useSetFilter`).

---

## Contexto de archivos relevantes (verificado antes de escribir este plan)

**`src/components/layout/Header.tsx`** (536 líneas) — archivo central de este plan. Puntos exactos:
- `navLinks` (líneas 26-31): array con el item "Catálogo" a remover.
- Botón carrito individual (líneas 283-295): `ShoppingBag` + badge `totalItems`, a remover.
- Bloque "Actions" (líneas 272-296): contenedor donde viven Search + Cart — acá se agregan los 2 íconos nuevos.
- Búsqueda: `products` prop (línea 20), `searchResults: Product[]` (línea 111), filtro sobre `products` (líneas 137-155), `handleSearchSubmit` → `/catalogo?q=` (línea 167), link "Ver todos los resultados" → `/catalogo?q=` (línea 490), búsquedas populares → `/catalogo?q=` (línea 517), render de cada resultado como producto con `/p/${product.slug}` (líneas 456-488) — todo esto se reescribe para `corporateSets`.
- Mobile drawer (líneas 340-384): itera el mismo `navLinks`, más un `<li>` extra hardcodeado "Ventas al Mayor" → `/corporativo` (líneas 365-382) que NO está en `navLinks` — no se toca, sigue existiendo.
- `CorporateNavCTA` (línea 269): pill ya existente en el nav desktop, no se toca.

**`src/lib/corporate-types.ts:98-105`** — `CorporateSetNavItem`:
```ts
export interface CorporateSetNavItem {
  id: string;
  slug: string;
  name: string;
  cover: MediaItem | null;
  brandName: string | null;
  referencePrice: number | null;
}
```

**`src/app/(store)/layout.tsx`** (44 líneas) — completo:
```tsx
import { CartProvider } from '@/context/CartContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { PriceVisibilityProvider } from '@/context/PriceVisibilityContext';
import { AppShell } from '@/components/layout/AppShell';
import { getAllProducts, getBrandsForNav, getStores } from '@/lib/data-service';
import { getAllBusinessRules, getLatestCorporateSets } from '@/lib/corporate-data-service';

export const dynamic = 'force-dynamic';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [products, brands, stores, rules, corporateSets] = await Promise.all([
    getAllProducts(),
    getBrandsForNav(),
    getStores(),
    getAllBusinessRules(),
    getLatestCorporateSets(),
  ]);
  const priceVisibilityRules = rules.filter((r) => r.ruleType === 'PRICE_VISIBILITY');

  return (
    <div className="font-sans">
      <NotificationProvider>
        <PriceVisibilityProvider rules={priceVisibilityRules}>
          <CartProvider>
            <AppShell products={products} brands={brands} stores={stores} corporateSets={corporateSets}>
              {children}
            </AppShell>
          </CartProvider>
        </PriceVisibilityProvider>
      </NotificationProvider>
    </div>
  );
}
```

**`src/app/(store)/corporativo/layout.tsx`** (16 líneas) — completo:
```tsx
import { CorporateCartProvider } from '@/context/CorporateCartContext';
import { CorporateCartButton } from '@/components/corporate/CorporateCartButton';
import { CorporateAccountLink } from '@/components/corporate/CorporateAccountLink';
import { Footer } from '@/components/layout/Footer';

export default function CorporativoLayout({ children }: { children: React.ReactNode }) {
  return (
    <CorporateCartProvider>
      {children}
      <CorporateAccountLink />
      <CorporateCartButton />
      <Footer />
    </CorporateCartProvider>
  );
}
```
Nota: `Footer` se monta acá (no en `AppShell`) — **no se toca**, queda tal cual, fuera del alcance de este plan.

**`src/context/CorporateCartContext.tsx:153`** — `CorporateCartProvider({ children }: { children: React.ReactNode })`, sin props obligatorias adicionales — se puede montar en el layout raíz sin datos nuevos.

**`src/components/corporate/CorporateAccountLink.tsx`** (22 líneas, completo) y **`src/components/corporate/CorporateCartButton.tsx`** (40 líneas, completo) — ver contenido exacto en Task 4.

**`src/hooks/useSetFilter.ts:36-38`**:
```ts
export function useSetFilter(sets: CorporateSetSummary[]) {
  const [filters, setFilters] = useState<SetFilterState>(EMPTY_SET_FILTERS);
```
`filterOptions.brands` se deriva de `sets` vía `useMemo` (líneas 42-76 aprox.) — la misma fuente (`sets`) está disponible como argumento del hook antes de necesitar el valor inicial de `filters`.

**`src/components/catalog/SetCatalogGrid.tsx:23`** — `export function SetCatalogGrid({ sets, priceVisibilityRules }: SetCatalogGridProps)`, ya `'use client'`.

---

### Task 1: `Header.tsx` — quitar nav "Catálogo" y shopping bag individual

**Files:**
- Modify: `src/components/layout/Header.tsx`

**Interfaces:** ninguna nueva — cambios internos al componente, misma prop interface externa (`HeaderProps` sin cambios en esta task).

- [ ] **Step 1: Quitar "Catálogo" de `navLinks`**

Reemplazar:
```ts
const navLinks = [
  { label: 'Inicio', href: '/', icon: Home },
  { label: 'Catálogo', href: '/catalogo', icon: Tag },
  { label: 'Marcas', href: '/marcas', icon: Tag },
  { label: 'Tiendas', href: '/sucursales', icon: MapPin },
];
```
por:
```ts
const navLinks = [
  { label: 'Inicio', href: '/', icon: Home },
  { label: 'Marcas', href: '/marcas', icon: Tag },
  { label: 'Tiendas', href: '/sucursales', icon: MapPin },
];

// Renombrado de "Catálogo" a "Productos" para cuando se reactive la venta individual —
// no se incluye en `navLinks` mientras el sitio solo vende sets corporativos.
// { label: 'Productos', href: '/catalogo', icon: Tag },
```

- [ ] **Step 2: Quitar el botón de carrito individual (`ShoppingBag`)**

Reemplazar el bloque "Actions" (líneas 272-296 actuales):
```tsx
            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Search Button */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors"
                aria-label="Buscar"
              >
                <Search className="w-5 h-5" strokeWidth={1.5} />
              </button>

              {/* Cart Button */}
              <button
                onClick={onCartClick}
                className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors relative"
                aria-label="Carrito"
              >
                <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
                {isMounted && totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#FF3B30] text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </button>
            </div>
```
por (placeholder temporal — Task 4 agrega los íconos corporativos acá mismo):
```tsx
            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Search Button */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors"
                aria-label="Buscar"
              >
                <Search className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>
```

- [ ] **Step 3: Quitar el uso de `useCart`/`totalItems`/`isMounted` si quedan sin uso**

`totalItems` (línea 34, `const { totalItems } = useCart();`) e `isMounted` (líneas 38-42) quedaban usados únicamente por el botón de carrito recién quitado. Verificar con lectura del archivo si algún otro bloque los sigue usando (no debería, según lo leído) y, si no, eliminar esas líneas:
```ts
const { totalItems } = useCart();
```
y
```ts
const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  setIsMounted(true);
}, []);
```
y el import `useCart` de `@/context/CartContext` (línea 7) si queda sin otro uso en el archivo.

**No eliminar** la prop `onCartClick` de `HeaderProps`/`Header(...)` — `AppShell.tsx` la sigue pasando y el `CartDrawer` sigue existiendo; solo no hay trigger visual en el Header. Dejar la prop declarada aunque no se invoque desde este archivo evita romper la firma que consume `AppShell`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: puede haber un warning/error de `onCartClick` declarado y no usado dentro del componente — si TypeScript/ESLint lo marca como error (no solo warning), dejar un comentario `// onCartClick ya no dispara ningún trigger visual en este Header — CartDrawer se mantiene montado desde AppShell` junto al parámetro, sin eliminarlo de la firma.

- [ ] **Step 5: Commit (sugerido, no ejecutar)**

```
git commit -m "ACTIVITY: ocultar item de nav Catalogo y boton de carrito individual del Header"
```

---

### Task 2: Buscador del Header — de `products` a `corporateSets`

**Files:**
- Modify: `src/components/layout/Header.tsx`

**Interfaces:**
- Consumes: `CorporateSetNavItem` (`@/lib/corporate-types`, ya importado en el archivo), prop `corporateSets` (ya existe en `HeaderProps`, ya se recibe).
- Produces: ningún cambio de firma externa.

- [ ] **Step 1: Cambiar el tipo y la fuente de `searchResults`**

Reemplazar:
```ts
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<Product[]>([]);
```
por:
```ts
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<CorporateSetNavItem[]>([]);
```

- [ ] **Step 2: Reescribir el filtro debounced**

Reemplazar el bloque (líneas 132-162 actuales):
```ts
  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (searchQuery.length >= 2) {
      searchDebounceRef.current = setTimeout(() => {
        let results: Product[];
        if (products) {
          const q = searchQuery.toLowerCase();
          results = products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            (p.productType?.name.toLowerCase().includes(q) ?? false) ||
            p.colors.some(c => c.name.toLowerCase().includes(q))
          );
        } else {
          results = [];
        }
        setSearchResults(results.slice(0, 6));
      }, 200);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery]);
```
por:
```ts
  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (searchQuery.length >= 2) {
      searchDebounceRef.current = setTimeout(() => {
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
      }, 200);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, corporateSets]);
```

- [ ] **Step 3: Redirigir `handleSearchSubmit` a `/corporativo?q=`**

Reemplazar:
```ts
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/catalogo?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };
```
por:
```ts
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/corporativo?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };
```

- [ ] **Step 4: Reescribir el render de resultados (cards de set en vez de producto)**

Reemplazar el bloque `searchResults.map(...)` (líneas 456-488 actuales):
```tsx
                    {searchResults.map(product => (
                      <Link
                        key={product.id}
                        href={`/p/${product.slug}`}
                        onClick={() => {
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="flex items-center gap-3 sm:gap-4 p-3 hover:bg-[#F5F5F7] rounded-lg transition-colors"
                      >
                        <div className="relative w-12 h-16 sm:w-14 sm:h-18 bg-[#F5F5F7] rounded overflow-hidden flex-shrink-0">
                          <MediaGridThumb
                            item={resolveCoverMedia(product)}
                            fallback="/images/placeholder-product.jpg"
                            alt={product.name}
                            sizes="56px"
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 uppercase">{product.brand}</p>
                          <p className="text-sm font-medium text-[#111111] truncate">{product.name}</p>
                        </div>
                        {showPrices && (
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              ${(product.priceSale || product.priceNormal).toFixed(2)}
                            </p>
                          </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                      </Link>
                    ))}
                    <Link
                      href={`/catalogo?q=${encodeURIComponent(searchQuery)}`}
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="flex items-center justify-center gap-2 p-3 text-sm font-medium text-[#111111] hover:bg-[#F5F5F7] rounded-lg transition-colors"
                    >
                      Ver todos los resultados
                      <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                    </Link>
```
por:
```tsx
                    {searchResults.map(set => (
                      <Link
                        key={set.id}
                        href={`/corporativo/s/${set.slug}`}
                        onClick={() => {
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="flex items-center gap-3 sm:gap-4 p-3 hover:bg-[#F5F5F7] rounded-lg transition-colors"
                      >
                        <div className="relative w-12 h-16 sm:w-14 sm:h-18 bg-[#F5F5F7] rounded overflow-hidden flex-shrink-0">
                          <MediaGridThumb
                            item={set.cover}
                            fallback="/images/placeholder-product.jpg"
                            alt={set.name}
                            sizes="56px"
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          {set.brandName && <p className="text-xs text-gray-400 uppercase">{set.brandName}</p>}
                          <p className="text-sm font-medium text-[#111111] truncate">{set.name}</p>
                        </div>
                        {showPrices && set.referencePrice !== null && (
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              ${set.referencePrice.toFixed(2)}
                            </p>
                          </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                      </Link>
                    ))}
                    <Link
                      href={`/corporativo?q=${encodeURIComponent(searchQuery)}`}
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="flex items-center justify-center gap-2 p-3 text-sm font-medium text-[#111111] hover:bg-[#F5F5F7] rounded-lg transition-colors"
                    >
                      Ver todos los resultados
                      <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                    </Link>
```

Nota: `resolveCoverMedia` (import de `@/lib/product-cover`, línea 16 del archivo) ya no se usa en este bloque — `set.cover` es directamente un `MediaItem | null`. Verificar en el Step de typecheck/lint si `resolveCoverMedia` queda sin otro uso en el archivo; si es así, quitar el import.

- [ ] **Step 5: Redirigir "búsquedas populares" a `/corporativo?q=`**

Reemplazar:
```tsx
                        onClick={() => {
                          setSearchQuery(term);
                          router.push(`/catalogo?q=${encodeURIComponent(term)}`);
                          setIsSearchOpen(false);
                        }}
```
por:
```tsx
                        onClick={() => {
                          setSearchQuery(term);
                          router.push(`/corporativo?q=${encodeURIComponent(term)}`);
                          setIsSearchOpen(false);
                        }}
```

- [ ] **Step 6: Actualizar el placeholder del input de búsqueda**

Reemplazar:
```tsx
                placeholder="Buscar productos, marcas, colores..."
```
por:
```tsx
                placeholder="Buscar sets, marcas..."
```

- [ ] **Step 7: Typecheck y lint**

Run: `npx tsc --noEmit`
Expected: sin errores. Si `Product` (import de `@/lib/types`, línea 13) o `resolveCoverMedia` quedan sin otro uso en el archivo, quitarlos del import — verificar con grep dentro del mismo archivo antes de quitar (`products` prop y `MegaMenu products={products}` en línea 247 SÍ siguen usando `Product`, así que probablemente el import se mantiene).

Run: `npx eslint src/components/layout/Header.tsx`
Expected: sin errores nuevos.

- [ ] **Step 8: Commit (sugerido, no ejecutar)**

```
git commit -m "ACTIVITY: redirigir buscador del header hacia sets corporativos en vez de productos individuales"
```

---

### Task 3: Mover `CorporateCartProvider` al layout raíz de `(store)`

**Files:**
- Modify: `src/app/(store)/layout.tsx`
- Modify: `src/app/(store)/corporativo/layout.tsx`

**Interfaces:**
- Consumes: `CorporateCartProvider` (`@/context/CorporateCartContext`, sin props obligatorias más allá de `children`).
- Produces: `CorporateCartContext` disponible en TODO el árbol de `(store)`, no solo en `/corporativo/*` — consumido por Task 4 (íconos en `Header.tsx`).

- [ ] **Step 1: Agregar `CorporateCartProvider` a `src/app/(store)/layout.tsx`**

Reemplazar:
```tsx
import { CartProvider } from '@/context/CartContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { PriceVisibilityProvider } from '@/context/PriceVisibilityContext';
import { AppShell } from '@/components/layout/AppShell';
```
por:
```tsx
import { CartProvider } from '@/context/CartContext';
import { CorporateCartProvider } from '@/context/CorporateCartContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { PriceVisibilityProvider } from '@/context/PriceVisibilityContext';
import { AppShell } from '@/components/layout/AppShell';
```

y reemplazar:
```tsx
      <NotificationProvider>
        <PriceVisibilityProvider rules={priceVisibilityRules}>
          <CartProvider>
            <AppShell products={products} brands={brands} stores={stores} corporateSets={corporateSets}>
              {children}
            </AppShell>
          </CartProvider>
        </PriceVisibilityProvider>
      </NotificationProvider>
```
por:
```tsx
      <NotificationProvider>
        <PriceVisibilityProvider rules={priceVisibilityRules}>
          <CartProvider>
            <CorporateCartProvider>
              <AppShell products={products} brands={brands} stores={stores} corporateSets={corporateSets}>
                {children}
              </AppShell>
            </CorporateCartProvider>
          </CartProvider>
        </PriceVisibilityProvider>
      </NotificationProvider>
```

- [ ] **Step 2: Quitar `CorporateCartProvider` (y los FAB) de `src/app/(store)/corporativo/layout.tsx`**

Reemplazar el archivo completo:
```tsx
import { CorporateCartProvider } from '@/context/CorporateCartContext';
import { CorporateCartButton } from '@/components/corporate/CorporateCartButton';
import { CorporateAccountLink } from '@/components/corporate/CorporateAccountLink';
import { Footer } from '@/components/layout/Footer';

export default function CorporativoLayout({ children }: { children: React.ReactNode }) {
  return (
    <CorporateCartProvider>
      {children}
      <CorporateAccountLink />
      <CorporateCartButton />
      <Footer />
    </CorporateCartProvider>
  );
}
```
por:
```tsx
import { Footer } from '@/components/layout/Footer';

export default function CorporativoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Footer />
    </>
  );
}
```

`Footer` se mantiene sin cambios (fuera de alcance, ver nota en "Contexto de archivos relevantes"). `CorporateCartButton`/`CorporateAccountLink` se remueven de este layout porque Task 4 los monta dentro de `Header.tsx`, que ya está disponible en todas las rutas de `(store)` vía `AppShell`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `(store)/layout.tsx` ni `corporativo/layout.tsx`. Es normal que en este punto `CorporateAccountLink`/`CorporateCartButton` (Task 4 los reescribe) no estén siendo consumidos por ningún archivo — no es un error de tipos, solo quedan temporalmente sin uso hasta Task 4.

- [ ] **Step 4: Commit (sugerido, no ejecutar)**

```
git commit -m "ACTIVITY: mover CorporateCartProvider del layout de corporativo al layout raiz de la tienda"
```

---

### Task 4: Reescribir `CorporateAccountLink`/`CorporateCartButton` como íconos, montarlos en `Header.tsx`

**Files:**
- Modify: `src/components/corporate/CorporateAccountLink.tsx`
- Modify: `src/components/corporate/CorporateCartButton.tsx`
- Modify: `src/components/layout/Header.tsx`

**Interfaces:**
- Consumes: `useSession` (`next-auth/react`), `useCorporateCart` (`@/context/CorporateCartContext`, ahora disponible en todo `(store)` gracias a Task 3).
- Produces: `CorporateAccountLink`/`CorporateCartButton` como botones ícono-only, exportados igual (mismo nombre), consumidos por `Header.tsx`.

- [ ] **Step 1: Reescribir `src/components/corporate/CorporateAccountLink.tsx`**

Reemplazar el archivo completo:
```tsx
'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { UserCircle } from 'lucide-react';

export function CorporateAccountLink() {
  const { data: session, status } = useSession();

  if (status === 'loading') return null;

  return (
    <Link
      href={session?.user ? '/corporativo/mi-cuenta' : '/corporativo/login'}
      className="fixed bottom-24 right-6 z-40 flex items-center gap-2 px-4 py-2 bg-white border border-[#E5E5E5] text-[#111111] rounded-full shadow-md hover:shadow-lg transition-shadow text-sm font-medium"
    >
      <UserCircle className="w-4 h-4" strokeWidth={1.5} />
      {session?.user ? 'Mi Cuenta' : 'Iniciar sesión'}
    </Link>
  );
}
```
por:
```tsx
'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { UserCircle } from 'lucide-react';

export function CorporateAccountLink() {
  const { data: session, status } = useSession();

  if (status === 'loading') return null;

  return (
    <Link
      href={session?.user ? '/corporativo/mi-cuenta' : '/corporativo/login'}
      className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors"
      aria-label={session?.user ? 'Mi cuenta' : 'Iniciar sesión'}
    >
      <UserCircle className="w-5 h-5" strokeWidth={1.5} />
    </Link>
  );
}
```

- [ ] **Step 2: Reescribir `src/components/corporate/CorporateCartButton.tsx`**

Reemplazar el archivo completo:
```tsx
'use client';

import { useState, useSyncExternalStore } from 'react';
import { Building2 } from 'lucide-react';
import { useCorporateCart } from '@/context/CorporateCartContext';
import { CorporateCartDrawer } from './CorporateCartDrawer';

function useMounted() {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}

export function CorporateCartButton() {
  const { items } = useCorporateCart();
  const [isOpen, setIsOpen] = useState(false);
  const mounted = useMounted();

  const totalSets = items.reduce(
    (sum, item) => sum + item.lines.reduce((lineSum, l) => lineSum + l.quantity, 0),
    0
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 bg-[#111111] text-white rounded-full shadow-lg hover:opacity-90 transition-opacity"
        aria-label="Abrir carrito corporativo"
      >
        <Building2 className="w-5 h-5" strokeWidth={1.5} />
        <span className="text-sm font-medium">Carrito Corporativo</span>
        {mounted && totalSets > 0 && (
          <span className="flex items-center justify-center w-5 h-5 bg-white text-[#111111] text-xs font-bold rounded-full">
            {totalSets}
          </span>
        )}
      </button>
      <CorporateCartDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
```
por:
```tsx
'use client';

import { useState, useSyncExternalStore } from 'react';
import { Building2 } from 'lucide-react';
import { useCorporateCart } from '@/context/CorporateCartContext';
import { CorporateCartDrawer } from './CorporateCartDrawer';

function useMounted() {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}

export function CorporateCartButton() {
  const { items } = useCorporateCart();
  const [isOpen, setIsOpen] = useState(false);
  const mounted = useMounted();

  const totalSets = items.reduce(
    (sum, item) => sum + item.lines.reduce((lineSum, l) => lineSum + l.quantity, 0),
    0
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors relative"
        aria-label="Abrir carrito corporativo"
      >
        <Building2 className="w-5 h-5" strokeWidth={1.5} />
        {mounted && totalSets > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#FF3B30] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {totalSets > 99 ? '99+' : totalSets}
          </span>
        )}
      </button>
      <CorporateCartDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
```

Nota de estilo: el badge usa el mismo patrón visual (`bg-[#FF3B30]`, esquina superior derecha, `-top-0.5 -right-0.5`) que ya usaba el `ShoppingBag` individual quitado en Task 1 — consistencia entre los íconos del Header.

- [ ] **Step 3: Montar ambos en `Header.tsx`, dentro de "Actions"**

En `src/components/layout/Header.tsx`, agregar los imports:
```tsx
import { CorporateAccountLink } from '@/components/corporate/CorporateAccountLink';
import { CorporateCartButton } from '@/components/corporate/CorporateCartButton';
```

Reemplazar el bloque "Actions" dejado en Task 1 Step 2:
```tsx
            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Search Button */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors"
                aria-label="Buscar"
              >
                <Search className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>
```
por:
```tsx
            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Search Button */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors"
                aria-label="Buscar"
              >
                <Search className="w-5 h-5" strokeWidth={1.5} />
              </button>

              {/* Corporate account (Mi cuenta / Iniciar sesión) */}
              <CorporateAccountLink />

              {/* Corporate cart */}
              <CorporateCartButton />
            </div>
```

- [ ] **Step 4: Typecheck y lint**

Run: `npx tsc --noEmit`
Expected: sin errores en `CorporateAccountLink.tsx`, `CorporateCartButton.tsx`, `Header.tsx`.

Run: `npx eslint src/components/corporate/CorporateAccountLink.tsx src/components/corporate/CorporateCartButton.tsx src/components/layout/Header.tsx`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit (sugerido, no ejecutar)**

```
git commit -m "ACTIVITY: mover Mi cuenta y Carrito corporativo de FAB flotante a iconos en el Header global"
```

---

### Task 5: `CorporateCTA.tsx` — quitar card "Compra Individual"

**Files:**
- Modify: `src/components/home/CorporateCTA.tsx`

**Interfaces:** ninguna — cambio puramente visual.

- [ ] **Step 1: Reescribir el archivo completo**

Reemplazar:
```tsx
'use client';

import Link from 'next/link';
import { ArrowRight, Building2, ShoppingBag } from 'lucide-react';
import { useAlternatingText } from '@/hooks/useAlternatingText';

const ALTERNATING_TEXTS = ['Ventas al Mayor', 'Compras Corporativas'];

export function CorporateCTA() {
  const { text, fade } = useAlternatingText(ALTERNATING_TEXTS);

  return (
    <section className="py-16 bg-[#F5F5F7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Catálogo Individual */}
          <Link
            href="/catalogo"
            className="group relative overflow-hidden rounded-2xl bg-white border border-[#E5E5E5] p-8 sm:p-10 flex flex-col justify-between min-h-[220px] hover:shadow-lg transition-shadow"
          >
            <div>
              <ShoppingBag className="w-8 h-8 text-[#111111] mb-4" strokeWidth={1.5} />
              <h3 className="text-2xl font-bold text-[#111111] mb-2">Compra Individual</h3>
              <p className="text-[#666666]">
                Explora nuestro catálogo completo de uniformes médicos premium.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-[#111111] group-hover:gap-3 transition-all">
              Ver catálogo
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </span>
          </Link>

          {/* Catálogo Corporativo — CTA con texto alternante */}
          <Link
            href="/corporativo"
            className="group relative overflow-hidden rounded-2xl bg-[#111111] p-8 sm:p-10 flex flex-col justify-between min-h-[220px] hover:shadow-lg transition-shadow"
          >
            <div>
              <Building2 className="w-8 h-8 text-white mb-4" strokeWidth={1.5} />
              <h3
                aria-live="polite"
                className={`text-2xl font-bold text-white mb-2 transition-opacity duration-300 motion-reduce:transition-none ${
                  fade ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {text}
                <span className="sr-only"> — Ventas al Mayor y Compras Corporativas</span>
              </h3>
              <p className="text-white/70">
                Cotizaciones especiales, sets de uniformes y precios preferenciales para instituciones.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-white group-hover:gap-3 transition-all">
              Ir al catálogo corporativo
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
```
por:
```tsx
'use client';

import Link from 'next/link';
import { ArrowRight, Building2 } from 'lucide-react';
import { useAlternatingText } from '@/hooks/useAlternatingText';

const ALTERNATING_TEXTS = ['Ventas al Mayor', 'Compras Corporativas'];

export function CorporateCTA() {
  const { text, fade } = useAlternatingText(ALTERNATING_TEXTS);

  return (
    <section className="py-16 bg-[#F5F5F7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1">
          {/* Catálogo Corporativo — CTA con texto alternante */}
          <Link
            href="/corporativo"
            className="group relative overflow-hidden rounded-2xl bg-[#111111] p-8 sm:p-10 flex flex-col justify-between min-h-[220px] hover:shadow-lg transition-shadow"
          >
            <div>
              <Building2 className="w-8 h-8 text-white mb-4" strokeWidth={1.5} />
              <h3
                aria-live="polite"
                className={`text-2xl font-bold text-white mb-2 transition-opacity duration-300 motion-reduce:transition-none ${
                  fade ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {text}
                <span className="sr-only"> — Ventas al Mayor y Compras Corporativas</span>
              </h3>
              <p className="text-white/70">
                Cotizaciones especiales, sets de uniformes y precios preferenciales para instituciones.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-white group-hover:gap-3 transition-all">
              Ir al catálogo corporativo
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck y lint**

Run: `npx tsc --noEmit && npx eslint src/components/home/CorporateCTA.tsx`
Expected: sin errores.

- [ ] **Step 3: Commit (sugerido, no ejecutar)**

```
git commit -m "ACTIVITY: quitar card Compra Individual de CorporateCTA en la home"
```

---

### Task 6: MegaMenu / BrandCarousel / BrandCard — links de marca a `/corporativo?brand=`

**Files:**
- Modify: `src/components/layout/MegaMenu.tsx`
- Modify: `src/components/home/BrandCarousel.tsx`
- Modify: `src/app/(store)/marcas/BrandCard.tsx`

**Interfaces:** ninguna — cambio de un string de `href`, tres archivos idénticos en patrón.

- [ ] **Step 1: `MegaMenu.tsx`**

Reemplazar:
```tsx
                        <Link
                          key={brand.id}
                          href={`/catalogo?brand=${encodeURIComponent(brand.name)}`}
                          onClick={onClose}
                          className="group p-1"
                        >
```
por:
```tsx
                        <Link
                          key={brand.id}
                          href={`/corporativo?brand=${encodeURIComponent(brand.name)}`}
                          onClick={onClose}
                          className="group p-1"
                        >
```

- [ ] **Step 2: `BrandCarousel.tsx`**

Reemplazar:
```tsx
                <Link
                  key={brand.name}
                  href={`/catalogo?brand=${encodeURIComponent(brand.name)}`}
```
por:
```tsx
                <Link
                  key={brand.name}
                  href={`/corporativo?brand=${encodeURIComponent(brand.name)}`}
```

- [ ] **Step 3: `BrandCard.tsx`**

Reemplazar:
```tsx
    <Link
      href={`/catalogo?brand=${encodeURIComponent(brand.name)}`}
      className="group bg-[#F5F5F7] rounded-xl p-6 sm:p-8 hover:bg-[#111111] transition-all duration-300"
    >
```
por:
```tsx
    <Link
      href={`/corporativo?brand=${encodeURIComponent(brand.name)}`}
      className="group bg-[#F5F5F7] rounded-xl p-6 sm:p-8 hover:bg-[#111111] transition-all duration-300"
    >
```

También ajustar el copy "productos"/"Ver productos" de `BrandCard.tsx` (líneas 52, 56) a "sets"/"Ver sets", ya que el conteo (`brand.productCount`) y el destino ahora refieren a sets, no productos individuales:
```tsx
        <span>{brand.productCount} productos</span>
```
→
```tsx
        <span>{brand.productCount} productos</span>
```
**No cambiar esta línea todavía** — `brand.productCount` sigue siendo un conteo de productos individuales (viene de `getBrands()` en `data-service.ts`, fuera de alcance de este plan cambiar esa query). Cambiar el copy a "sets" sin cambiar el dato subyacente sería incorrecto (mostraría "sets" pero contaría productos). Dejar "productos"/"Ver productos" tal cual — el copy es momentáneamente inconsistente con el destino del link, pero es preferible a mostrar un número falso. Anotado como deuda conocida, no se resuelve en este plan (fuera de alcance: cambiar `getBrands()`/`BrandNavItem` para contar sets en vez de productos).

- [ ] **Step 4: Typecheck y lint**

Run: `npx tsc --noEmit && npx eslint src/components/layout/MegaMenu.tsx src/components/home/BrandCarousel.tsx "src/app/(store)/marcas/BrandCard.tsx"`
Expected: sin errores.

- [ ] **Step 5: Commit (sugerido, no ejecutar)**

```
git commit -m "ACTIVITY: redirigir links de marca (MegaMenu, BrandCarousel, BrandCard) hacia /corporativo en vez de /catalogo"
```

---

### Task 7: `Footer.tsx` — quitar link "Catálogo"

**Files:**
- Modify: `src/components/layout/Footer.tsx`

**Interfaces:** ninguna.

- [ ] **Step 1: Quitar el `<li>` de Catálogo**

Reemplazar:
```tsx
            <ul className="space-y-3">
              <li>
                <Link
                  href="/catalogo"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Catálogo
                </Link>
              </li>
              <li>
                <Link
                  href="/marcas"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Marcas
                </Link>
              </li>
```
por:
```tsx
            <ul className="space-y-3">
              <li>
                <Link
                  href="/marcas"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Marcas
                </Link>
              </li>
```

- [ ] **Step 2: Typecheck y lint**

Run: `npx tsc --noEmit && npx eslint src/components/layout/Footer.tsx`
Expected: sin errores.

- [ ] **Step 3: Commit (sugerido, no ejecutar)**

```
git commit -m "ACTIVITY: quitar link Catalogo de Enlaces rapidos en el Footer"
```

---

### Task 8: `SetCatalogGrid`/`useSetFilter` — soporte de querystring `?q=` y `?brand=`

**Files:**
- Modify: `src/hooks/useSetFilter.ts`
- Modify: `src/components/catalog/SetCatalogGrid.tsx`

**Interfaces:**
- Produces: `useSetFilter(sets: CorporateSetSummary[], initial?: { search?: string; brandName?: string }): ...` — mismo shape de retorno que hoy, con `filters` ya precargado según `initial`.

- [ ] **Step 1: `useSetFilter.ts` — aceptar `initial` y resolver el valor inicial de `filters`**

Reemplazar la firma y el primer `useState`:
```ts
export function useSetFilter(sets: CorporateSetSummary[]) {
  const [filters, setFilters] = useState<SetFilterState>(EMPTY_SET_FILTERS);
```
por:
```ts
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
```

Nota: el lazy initializer de `useState` solo se ejecuta una vez, en el primer render — coherente con la restricción de no usar `useEffect` para esto (spec, Global Constraints). `sets` está disponible como parámetro del hook antes de que se calcule `filterOptions` (que vive en un `useMemo` posterior), así que no hay dependencia circular.

- [ ] **Step 2: `SetCatalogGrid.tsx` — leer `useSearchParams()` y pasarlo a `useSetFilter`**

Reemplazar:
```tsx
'use client';

import { useState } from 'react';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
```
por:
```tsx
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
```

Reemplazar el bloque completo (líneas 23-43 actuales del archivo real):
```tsx
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
```
por:
```tsx
export function SetCatalogGrid({ sets, priceVisibilityRules }: SetCatalogGridProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid-4');
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('q') ?? undefined;
  const initialBrandName = searchParams.get('brand') ?? undefined;

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
  } = useSetFilter(sets, { search: initialSearch, brandName: initialBrandName });
```

- [ ] **Step 3: Verificar que `SetCatalogGrid` sigue siendo consumible como Client Component con `useSearchParams`**

`useSearchParams()` requiere que el componente (o un ancestro) esté envuelto en un `<Suspense>` boundary en Next.js App Router cuando la página que lo consume es estática; en este caso `CorporativoContent.tsx` y `Home.tsx` ya son `'use client'` completos y las páginas que los usan (`src/app/(store)/corporativo/page.tsx`, `src/app/(store)/page.tsx`) ya tienen `export const dynamic = 'force-dynamic'` (confirmado en tareas anteriores de esta sesión) — con renderizado dinámico forzado, Next.js no exige el `Suspense` boundary adicional para `useSearchParams` (esa exigencia aplica a rutas estáticas). Si el build (Step 5) reporta un error o warning de "useSearchParams should be wrapped in a suspense boundary", envolver `<SetCatalogGrid>` en un `<Suspense fallback={null}>` en `CorporativoContent.tsx` y en `Home.tsx`, en el punto exacto donde se renderiza.

- [ ] **Step 4: Typecheck y lint**

Run: `npx tsc --noEmit`
Expected: sin errores en `useSetFilter.ts` ni `SetCatalogGrid.tsx`.

Run: `npx eslint src/hooks/useSetFilter.ts src/components/catalog/SetCatalogGrid.tsx`
Expected: sin errores nuevos.

- [ ] **Step 5: Build completo (para detectar el posible warning de `useSearchParams`/Suspense mencionado en Step 3)**

Run: `npm run build`
Expected: build exitoso. Si aparece el warning de Suspense boundary para `useSearchParams`, aplicar el fix descrito en Step 3 y volver a correr el build.

- [ ] **Step 6: Commit (sugerido, no ejecutar)**

```
git commit -m "ACTIVITY: SetCatalogGrid lee ?q y ?brand de la URL para precargar busqueda y marca"
```

---

### Task 9: Validación completa del proyecto y checklist manual

**Files:** ninguno (solo validación).

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build exitoso, incluyendo `/`, `/corporativo`, `/catalogo` (sigue existiendo como ruta), `/marcas`.

- [ ] **Step 2: Lint y typecheck completos**

Run: `npm run lint && npx tsc --noEmit`
Expected: sin errores nuevos en los archivos modificados por este plan (los problemas de lint preexistentes en otros archivos del proyecto, ya confirmados en tareas anteriores de esta sesión, no son responsabilidad de este cambio).

- [ ] **Step 3: Test suite**

Run: `npm run test`
Expected: sin regresiones nuevas — este cambio es mayormente de UI/navegación, sin lógica pura nueva cubierta por `.test.ts`, salvo la resolución de `brandId` desde `brandName` en `useSetFilter.ts` (Task 8), que no tiene test dedicado en este plan (si se detecta necesidad de cobertura durante la implementación, se puede agregar un caso en `src/lib/__tests__/set-filter-logic.test.ts` o un test nuevo para `useSetFilter`, evaluando en el momento si el hook es testeable sin un harness de React — probablemente no lo es sin `@testing-library/react`, que no está instalado en este proyecto; en ese caso, la cobertura queda en la verificación manual del Step 4).

- [ ] **Step 4: Checklist manual (`npm run dev`, sin Chrome DevTools MCP)**

- [ ] Nav desktop y mobile: sin item "Catálogo".
- [ ] Header: sin ícono de shopping bag individual (bolsa).
- [ ] Header: íconos "Mi cuenta" (`UserCircle`) y "Carrito corporativo" (`Building2` con badge) visibles y funcionales en TODAS las páginas públicas: home, `/corporativo`, `/marcas`, `/sucursales` — no solo dentro de `/corporativo/*`.
- [ ] Click en "Mi cuenta" sin sesión → `/corporativo/login`; con sesión → `/corporativo/mi-cuenta`.
- [ ] Click en "Carrito corporativo" abre `CorporateCartDrawer` correctamente en cualquier página (verificar especialmente fuera de `/corporativo`, ej. desde home).
- [ ] Agregar un set al carrito corporativo desde `/corporativo/s/[slug]`, navegar a home, confirmar que el badge de contador en el Header sigue reflejando el mismo carrito (prueba de que `CorporateCartProvider` en el layout raíz persiste el estado entre rutas).
- [ ] Buscador del header (ícono lupa): escribir texto, ver resultados de SETS (no productos), click en un resultado lleva a `/corporativo/s/[slug]`, "Ver todos los resultados" lleva a `/corporativo?q=texto` con el filtro de búsqueda ya aplicado.
- [ ] Búsquedas populares (Navy, Black, Scrub, Uniforme) redirigen a `/corporativo?q=` con resultados relevantes si existen sets que matcheen.
- [ ] Home: `CorporateCTA` muestra una sola card "Catálogo Corporativo" a ancho completo, sin la card "Compra Individual".
- [ ] Click en una marca desde el tab "Marcas" del MegaMenu → `/corporativo?brand=NOMBRE` con el filtro de marca ya aplicado (verificar que el chip de esa marca aparece seleccionado en el sidebar de filtros).
- [ ] Mismo comportamiento desde `BrandCarousel` (home) y `BrandCard` (`/marcas`).
- [ ] Footer: sin link "Catálogo" en "Enlaces rápidos".
- [ ] `/catalogo` sigue siendo accesible por URL directa (no se rompió la ruta, solo se ocultó de la navegación) — confirmar que la página sigue cargando sin error.
- [ ] `CartContext`/carrito individual: si se navega directamente a `/p/[slug]` (PDP individual, fuera de alcance pero sigue existiendo), el flujo de agregar al carrito individual sigue funcionando internamente (no se verifica visualmente porque no hay botón en el Header, pero no debe haber errores de consola).
- [ ] Mobile (~390px): drawer hamburguesa sin "Catálogo"; íconos de cuenta/carrito corporativo visibles en el header top-bar (no en el drawer, salvo que se decida agregarlos ahí también — no estaba en el alcance pedido).
- [ ] `/admin`: sin cambios visuales.

- [ ] **Step 5: Commit final combinado (sugerido, no ejecutar) — resumen de toda la actividad**

```
git commit -m "ACTIVITY: ocultar venta individual (nav, buscador, CTA home, marcas) y mover Mi cuenta/Carrito corporativo del FAB al Header global"
```

---

## Self-Review (completado por el autor del plan)

- **Cobertura de spec:** rename "Catálogo"→"Productos" oculto (Task 1) ✓; shopping bag oculto, `CartContext` intacto (Task 1) ✓; FAB→íconos en Header global (Tasks 3-4) ✓; buscador sobre sets + `/corporativo?q=` (Task 2) ✓; `CorporateCTA` una sola card (Task 5) ✓; MegaMenu/BrandCarousel/BrandCard → `/corporativo?brand=` (Task 6) ✓; `SetCatalogGrid` lee `?q=`/`?brand=` (Task 8) ✓; Footer sin "Catálogo" (Task 7) ✓; `/catalogo` no se borra (ninguna task toca la ruta ni sus archivos internos) ✓; `legacy-pages` no se toca (ninguna task lo referencia) ✓.
- **Placeholders:** ninguno real — el "placeholder temporal" mencionado en Task 1 Step 2 está explícitamente resuelto por Task 4 Step 3 en la misma sesión de ejecución, con referencia cruzada clara. La nota sobre `brand.productCount`/copy en Task 6 documenta una decisión consciente de NO cambiar algo (dejar "productos" aunque el link ahora vaya a sets), con justificación, no una ambigüedad sin resolver.
- **Consistencia de tipos:** `useSetFilter(sets, initial?: { search?: string; brandName?: string })` se llama con la misma forma exacta en Task 8 Step 2 que la firma definida en Task 8 Step 1. `CorporateSetNavItem` se usa idénticamente en Task 2 (buscador) y ya estaba definido en `corporate-types.ts` sin cambios de forma.
- **Orden de ejecución:** Task 1 deja `Header.tsx` con un placeholder de "Actions" reducido a propósito — Task 4 lo completa. Task 3 debe ejecutarse antes de Task 4 (mueve el Provider antes de que el ícono de carrito corporativo intente usarlo desde el Header). Task 8 es independiente del resto (toca archivos distintos) pero requiere que Task 6 ya exista conceptualmente para que `?brand=` tenga sentido de punta a punta — no hay dependencia de código entre ambas, solo de propósito de producto. Orden recomendado: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9.

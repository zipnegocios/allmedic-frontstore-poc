# Diseño — Ocultar venta individual y migrar accesos corporativos al Header global

## Contexto

El negocio deja de vender productos individuales por ahora — solo se comercializan sets del catálogo corporativo (`/corporativo`). Esto requiere tres cambios pedidos explícitamente, más un alcance ampliado descubierto durante la exploración (confirmado con el usuario):

1. Ocultar el item de menú "Catálogo" (renombrado a "Productos" para cuando se reactive, pero no visible ahora).
2. Ocultar el shopping bag de compras individuales.
3. Mover los botones flotantes "Mi cuenta" y "Carrito corporativo" (hoy FAB visibles solo dentro de `/corporativo/*`) al Header global del sitio, como íconos, visibles en todas las páginas.

**Alcance ampliado (decidido junto al usuario tras la exploración):** ocultar/discontinuar también los demás accesos a `/catalogo` encontrados: buscador del header, tab "Marcas" del MegaMenu, Footer, card "Compra Individual" en home (`CorporateCTA.tsx`), y links de marca en `BrandCarousel`/`BrandCard`.

## Decisiones cerradas

1. **Rename "Catálogo" → "Productos":** cambio de string únicamente, sin efecto visible ahora (el item queda fuera del array de nav activo). Preparación para una reactivación futura.
2. **Shopping bag individual:** se oculta el botón/trigger del Header. `CartContext`/`CartProvider`/`CartDrawer` quedan intactos por dentro — no se desmonta nada, solo se remueve el ícono visual y su badge.
3. **FAB "Mi cuenta" y "Carrito corporativo" → íconos en el Header global:** dejan de ser `position: fixed` visibles solo en `/corporativo/*`, y pasan a vivir en el Header del sitio completo (`src/components/layout/Header.tsx`), visibles en todas las páginas públicas. Esto requiere mover `CorporateCartProvider` del layout de `/corporativo` al layout raíz de `(store)`.
4. **Buscador del Header:** se reescribe para operar sobre `corporateSets` (prop ya existente en `HeaderProps`) en vez de `products`, y redirige a `/corporativo?q=...` en vez de `/catalogo?q=...`.
5. **`CorporateCTA.tsx` (home):** se elimina la card "Compra Individual"; la card "Catálogo Corporativo" pasa a ocupar el ancho completo de la sección (grid de 1 columna en vez de 2).
6. **MegaMenu (tab Marcas) / `BrandCarousel` / `BrandCard`:** cambian su link de `/catalogo?brand=NOMBRE` a `/corporativo?brand=NOMBRE`.
7. **`SetCatalogGrid`/`useSetFilter` ganan soporte de querystring** (`?q=`, `?brand=`) para que los cambios 4 y 6 funcionen — se lee `useSearchParams()` al montar, `q` precarga `filters.search`, `brand` (nombre) se resuelve contra `filterOptions.brands` para precargar `filters.brandId`.
8. **Footer:** se quita el link "Catálogo" de "Enlaces rápidos".
9. **Fuera de alcance:** `/catalogo` sigue existiendo como ruta (no se borra código ni la página); `src/legacy-pages/*` no se toca (confirmado sin ruteo activo); `CartProvider`/`CartDrawer`/`/p/[slug]` no se tocan internamente.

## Cambios por archivo

### `src/components/layout/Header.tsx`
- `navLinks`: se quita la entrada de Catálogo del array activo. Se documenta el string "Productos" en un comentario o constante separada para reactivación futura.
- Botón `ShoppingBag`/`onCartClick` y su badge: se elimina del render (no la prop `onCartClick` del componente si otros consumidores la necesitan — verificar en implementación).
- Buscador: `searchResults` pasa de `Product[]` filtrado sobre `products` a resultados sobre `corporateSets: CorporateSetNavItem[]` (prop ya recibida). `CorporateSetNavItem` tiene `{ id, slug, name, cover, brandName, referencePrice }` (`src/lib/corporate-types.ts:98-105`) — el filtro compara `name`/`brandName` (no tiene `pieceNames`, ese campo es exclusivo de `CorporateSetSummary`, la versión completa usada en `/corporativo`). `handleSearchSubmit` y el link "ver todos los resultados" redirigen a `/corporativo?q=`.
- Se agregan dos botones ícono en la zona de "Actions" (mismo lugar que ocupaba el `ShoppingBag`): `UserCircle` (Mi cuenta / Iniciar sesión, mismo comportamiento condicional por sesión que `CorporateAccountLink.tsx` actual) y `Building2` con badge de contador (Carrito corporativo, abre `CorporateCartDrawer`).
- `CorporateNavCTA` (pill "Ventas al Mayor/Compras Corporativas") se mantiene sin cambios — es un CTA de descubrimiento, no un ícono de cuenta/carrito.

### `src/app/(store)/layout.tsx`
- Se agrega `<CorporateCartProvider>` envolviendo `AppShell`, mismo nivel que `<CartProvider>` ya existente.

### `src/app/(store)/corporativo/layout.tsx`
- Se quita `<CorporateCartProvider>` (sube al layout raíz).
- Se quitan `<CorporateAccountLink />` y `<CorporateCartButton />` (los reemplazan los íconos del Header global).

### `src/components/corporate/CorporateAccountLink.tsx` / `CorporateCartButton.tsx`
- Se reescriben de FAB `position: fixed` a botones ícono-only pensados para integrarse en el Header (mismo patrón visual `p-2 hover:bg-[#F5F5F7] rounded-full` que ya usa el Header para sus otros botones de acción). Mismo estado/lógica interna (sesión, contador de `useCorporateCart`), solo cambia el contenedor visual. `CorporateCartButton` sigue montando `CorporateCartDrawer`.

### `src/components/home/CorporateCTA.tsx`
- Se elimina el bloque `<Link href="/catalogo">` ("Compra Individual").
- El grid pasa de `grid-cols-1 md:grid-cols-2` a `grid-cols-1`; la card corporativa restante ajusta su ancho/padding si hace falta para verse bien a ancho completo.

### `src/components/layout/MegaMenu.tsx`
- El link de marca (`href={\`/catalogo?brand=${...}\`}`) cambia a `/corporativo?brand=${...}`.

### `src/components/home/BrandCarousel.tsx` / `src/app/(store)/marcas/BrandCard.tsx`
- Mismo cambio de link: `/catalogo?brand=` → `/corporativo?brand=`.

### `src/components/layout/Footer.tsx`
- Se quita el `<li>` con el link "Catálogo" de "Enlaces rápidos".

### `src/components/catalog/SetCatalogGrid.tsx` / `src/hooks/useSetFilter.ts`
- `SetCatalogGrid` (client component) lee `useSearchParams()` de `next/navigation` y pasa `searchParams.get('q')`/`searchParams.get('brand')` como segundo argumento opcional a `useSetFilter(sets, { initialSearch, initialBrandName })`.
- Dentro de `useSetFilter`, la resolución ocurre en el `useState<SetFilterState>` inicial (lazy initializer), reutilizando la misma derivación de `brandsMap` que ya construye `filterOptions` a partir de `sets` (ambas derivan de `sets`, ya disponible como argumento del hook — no hace falta esperar a que `filterOptions` se calcule primero): si `initialBrandName` viene informado, se busca en `sets` una marca cuyo `brandName` (case-insensitive) coincida, y se usa su `brandId`; si no hay coincidencia, `brandId` queda `null` (fallback silencioso, sin error visible).
- No se usa `useEffect` para esto — todo se resuelve en el valor inicial del `useState`, evitando un remount/flash de filtros vacíos seguido de un re-render con los filtros ya aplicados.

## Verificación

- `npm run build`, `npm run lint`, typecheck, `npm run test`.
- Manual: nav sin "Catálogo"; shopping bag individual ausente; íconos "Mi cuenta"/"Carrito corporativo" visibles y funcionales en TODAS las páginas públicas (home, `/corporativo`, `/marcas`, etc.), no solo dentro de `/corporativo`; buscador del header devuelve sets y redirige a `/corporativo?q=`; `/corporativo?q=texto` precarga la búsqueda; click en marca desde MegaMenu/BrandCarousel/BrandCard lleva a `/corporativo?brand=NOMBRE` con el filtro de marca ya aplicado; home con una sola card "Catálogo Corporativo" a ancho completo; Footer sin link "Catálogo"; `/catalogo` sigue existiendo y accesible por URL directa (no se rompe, solo se oculta de la navegación); `CartContext`/carrito individual sin cambios de comportamiento interno.

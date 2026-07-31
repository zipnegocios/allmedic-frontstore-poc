# Diseño — Reemplazar productos individuales por sets corporativos en la página de inicio

## Contexto

La home (`/`) muestra hoy dos secciones de productos individuales de retail:

1. **"Lo más solicitado"** (`FeaturedProductsSection`, inline en `src/legacy-pages/Home.tsx:194-241`) — grid simple de 8 productos con `isBestSeller=true`, vía `getFeaturedProducts()` (`src/lib/data-service.ts:406-422`).
2. **"Explora nuestro catálogo"** (`src/components/home/FilterableProductSection.tsx`) — catálogo completo con filtros jerárquicos, buscador y paginación, vía `getAllProducts()`.

El negocio quiere reorientar la home hacia la venta corporativa: ambas secciones deben mostrar **sets corporativos** en vez de productos individuales. `/corporativo` ya tiene una experiencia de catálogo de sets completa y funcional (filtros de color/precio/marca, buscador, paginación, `LayoutSwitcher`) — este cambio la reutiliza en vez de reconstruirla, extrayendo sus piezas reutilizables a componentes compartidos.

## Decisiones cerradas

1. **Alcance:** se reemplazan **ambas** secciones de productos individuales en home, no solo una.
2. **Sección corta ("destacados"):** usa sets con `isFeatured=true` (campo ya existente en el modelo, hoy solo pintaba el badge "Destacado" en la card). Se agrega soporte de filtro en la query — no existía antes.
3. **Sección larga ("catálogo"):** se embebe el catálogo completo de sets con filtros, búsqueda y paginación — la misma experiencia funcional que ya existe en `/corporativo`, extraída a un componente compartido. **Decisión explícita:** esto implica que `/` y `/corporativo` ofrecerán funcionalidad equivalente en paralelo (redundancia aceptada conscientemente, no un descuido).
4. **Código huérfano:** todo lo que quede sin consumidores tras el cambio se elimina (no se deja código muerto), verificando primero con grep que no lo use ningún otro archivo. `getAllProducts()` **no se toca** — la siguen usando `catalogo/page.tsx`, `p/[slug]/page.tsx` y `layout.tsx` (rutas fuera de este cambio). `getFeaturedProducts()`, `FilterableProductSection.tsx` y la función `FeaturedProductsSection` inline sí quedan huérfanas y se eliminan.
5. **Datos en vivo:** home pasa a depender de reglas de negocio (`priceVisibilityRules`, `minQuantity`), igual que `/corporativo`. Se añade `export const dynamic = 'force-dynamic'` a `src/app/(store)/page.tsx`, replicando el mismo criterio y comentario que ya existe en `src/app/(store)/corporativo/page.tsx:5-7` (evitar pre-renderizado en build-time cuando `DATABASE_URL` solo está disponible en runtime).

## Cambios de datos

**`src/lib/corporate-data-service.ts`** — `getActiveCorporateSets()` gana un parámetro opcional:

```ts
export async function getActiveCorporateSets(options?: { featuredOnly?: boolean }): Promise<CorporateSetSummary[]>
```

Cuando `options?.featuredOnly` es `true`, se añade `eq(corporateSetsTable.isFeatured, true)` a la condición `where` existente (junto a `isActive=true` y `deletedAt IS NULL`). Sin parámetro o `false`: comportamiento actual sin cambios (todos los sets activos). No se crea una función nueva — evita duplicar la query completa.

## Extracción de componentes reutilizables

**`src/components/catalog/SetGridCard.tsx`** (nuevo, exportado) — recorte literal de la función `SetGridCard`, hoy inline y no exportada en `src/app/(store)/corporativo/CorporativoContent.tsx:30-158`. Sin cambios de lógica ni de firma de props (`{ set: CorporateSetSummary; activeColorId: string | null; showPrices: boolean }`).

**`src/components/catalog/SetCatalogGrid.tsx`** (nuevo) — recorte del bloque de filtros + grid + paginación de `CorporativoContent.tsx:211-404` (todo lo que va dentro de `<section className="max-w-7xl mx-auto ...">`, sin el hero). Prop interface:

```ts
interface SetCatalogGridProps {
  sets: CorporateSetSummary[];
  priceVisibilityRules: BusinessRule[];
  minQuantity: number;
}
```

Internamente usa `useSetFilter`, `SetFilterSidebar`, `SetFilterButton`, `LayoutSwitcher`, `SetListItem`, y el nuevo `SetGridCard` — mismos imports que ya usa `CorporativoContent.tsx` hoy, sin cambios de lógica.

**`CorporativoContent.tsx`** se reduce a: hero "Catálogo Corporativo" (líneas 194-209 sin cambios) + `<SetCatalogGrid sets={sets} priceVisibilityRules={priceVisibilityRules} minQuantity={minQuantity} />`.

## Cambios en home

**`src/app/(store)/page.tsx`:**
- Se agrega `export const dynamic = 'force-dynamic';` (con el mismo comentario que `corporativo/page.tsx:5-6`).
- Reemplaza `getFeaturedProducts()` → `getActiveCorporateSets({ featuredOnly: true })`.
- Reemplaza `getAllProducts()` → `getActiveCorporateSets()`.
- Agrega `getAllBusinessRules()` + `resolveRules()` (mismo patrón que `corporativo/page.tsx:15-25`) para producir `priceVisibilityRules` y `minQuantity`.
- `getHeroSlides()`, `getStores()`, `getBrandsForNav()` no cambian.

**`src/legacy-pages/Home.tsx`:**
- Se elimina la función `FeaturedProductsSection` inline (líneas 194-241).
- Sección nueva de sets destacados: grid simple (mismo patrón visual — título de sección, grid responsive, botón "Ver todo" → `/corporativo`) usando el `SetGridCard` extraído, alimentado por los sets `featuredOnly`. El copy del título se ajusta de "Lo más solicitado" a algo coherente con sets corporativos (a definir en implementación, ej. "Sets destacados").
- Se reemplaza el uso de `<FilterableProductSection products={allProducts} />` por `<SetCatalogGrid sets={allSets} priceVisibilityRules={priceVisibilityRules} minQuantity={minQuantity} />`.
- Firma del componente `Home` se actualiza: sale `featuredProducts: Product[]` / `allProducts: Product[]`, entra `featuredSets: CorporateSetSummary[]` / `allSets: CorporateSetSummary[]` / `priceVisibilityRules: BusinessRule[]` / `minQuantity: number`.

## Limpieza de código huérfano

Tras el cambio, eliminar (previa verificación por grep de que no tienen otros consumidores):
- `getFeaturedProducts()` — `src/lib/data-service.ts:406-422`.
- `src/components/home/FilterableProductSection.tsx` (archivo completo).

No se toca `getAllProducts()` (`data-service.ts`) ni `src/lib/dummy-data.ts`.

## Fuera de alcance

- `CorporateCTA`, `QuickAccessCards`, `HeroCarousel`, `BrandCarousel` — sin cambios.
- `SetFilterSidebar`, `useSetFilter`, `resolveCardCover`, `ColorSwatch` — se reutilizan sin modificar.
- `/catalogo` (catálogo retail de productos individuales) — sigue existiendo tal cual, no se toca.
- No hay cambios de schema Drizzle ni migraciones — `isFeatured` ya existe en `corporate_sets`.

## Verificación

- `npm run build`, `npm run lint`, typecheck, `npm run test`.
- Manual: home (`/`) muestra sets en ambas secciones; sección destacados solo trae `isFeatured=true`; sección catálogo tiene filtros/búsqueda/paginación funcionando igual que `/corporativo`; `/corporativo` sigue funcionando igual que antes (mismo comportamiento, ahora vía `SetCatalogGrid`); `/catalogo` (retail) sin cambios; ningún import roto tras eliminar `getFeaturedProducts`/`FilterableProductSection`.

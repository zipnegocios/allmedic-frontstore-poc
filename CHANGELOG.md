# CHANGELOG - Allmedic Frontstore

## [1.0.0] - 2026-04-05 - Next.js Migration Complete

### Migration: React+Vite -> Next.js 16 App Router

**Stack anterior:** React 19 + Vite 7 + React Router v7 (client-only SPA)
**Stack nuevo:** Next.js 16 App Router + Prisma 5 + MySQL (SSR + API routes)

---

### Archivos eliminados (Vite cleanup)
| Archivo | Razon |
|---------|-------|
| `vite.config.ts` | Configuracion de Vite - reemplazada por `next.config.ts` |
| `index.html` | Entry point de Vite - Next.js usa `app/layout.tsx` |
| `src/main.tsx` | Bootstrap ReactDOM de Vite - Next.js auto-genera |
| `src/App.tsx` | BrowserRouter wrapper - reemplazado por App Router |
| `tsconfig.app.json` | Config TS de Vite - consolidado en `tsconfig.json` |
| `tsconfig.node.json` | Config TS de Vite para build - ya no necesario |
| `test-db-connection.js` | Script de test temporal - limpieza de seguridad |
| `src/legacy-pages/Catalog.tsx` | Reemplazado por `src/app/catalogo/page.tsx` |
| `src/legacy-pages/Brands.tsx` | Reemplazado por `src/app/marcas/page.tsx` |

### Archivos creados (Next.js)
| Archivo | Descripcion |
|---------|-------------|
| `next.config.ts` | Configuracion Next.js 16 con Turbopack |
| `src/app/layout.tsx` | Root layout con CartProvider y CSS global |
| `src/app/page.tsx` | Home page (SSG) |
| `src/app/catalogo/page.tsx` | Catalogo con filtros y Suspense boundary |
| `src/app/p/[slug]/page.tsx` | Detalle de producto (SSR dinamico) |
| `src/app/marcas/page.tsx` | Pagina de marcas (SSG) |
| `src/app/sucursales/page.tsx` | Pagina de sucursales (SSG) |
| `src/app/api/products/route.ts` | API REST - productos con Prisma |
| `src/app/api/leads/route.ts` | API REST - leads WhatsApp con Zod validation |
| `src/app/api/search/route.ts` | API REST - busqueda full-text con analytics |
| `src/lib/prisma.ts` | Singleton PrismaClient (dev/prod safe) |
| `src/lib/navigation.tsx` | Compatibility layer Link (next/link wrapper) |
| `src/context/NotificationContext.tsx` | Extraido de App.tsx (blocker resuelto) |
| `prisma/seed.ts` | Script de seed para MySQL |
| `CLAUDE.md` | Documentacion del proyecto para Claude Code |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `package.json` | name: allmedic-frontstore v1.0.0, scripts Next.js, removidos: vite, react-router-dom, @vitejs/plugin-react |
| `tsconfig.json` | Adaptado para Next.js (moduleResolution: node, incremental, esModuleInterop) |
| `eslint.config.js` | Removido reactRefresh.configs.vite, agregado globals.node |
| `.gitignore` | Agregado .next/, .vercel/, .turbo/, next-env.d.ts |
| `src/hooks/useProductFilter.ts` | Corregida violacion React: setState en useMemo -> useEffect |
| `src/context/CartContext.tsx` | Agregado 'use client', validacion de localStorage |
| `src/context/NotificationContext.tsx` | Agregado 'use client' |
| `src/lib/debug.ts` | import.meta.env.DEV -> process.env.NODE_ENV |

### Componentes migrados de react-router-dom a next/link
| Componente | Cambios |
|------------|---------|
| `components/layout/Header.tsx` | Link, useNavigate->useRouter, useLocation->usePathname |
| `components/layout/Footer.tsx` | Link to= -> href= |
| `components/layout/ScrollToTop.tsx` | useLocation -> usePathname |
| `components/layout/MegaMenu.tsx` | Link to= -> href= |
| `components/catalog/ProductCard.tsx` | Link to= -> href= |
| `components/catalog/LayoutSwitcher.tsx` | Link to= -> href= |
| `components/product/CrossSellCard.tsx` | Link to= -> href= |
| `components/home/BrandCarousel.tsx` | Link to= -> href= |
| `legacy-pages/Home.tsx` | Link to= -> href= |
| `legacy-pages/Product.tsx` | useParams + Link migrados a next/navigation |

### 'use client' directives agregadas (17 componentes)
- legacy-pages/Home.tsx, Product.tsx, Stores.tsx
- components/cart/CartDrawer.tsx
- components/catalog/FilterSidebar.tsx, ProductCard.tsx, QuickViewModal.tsx
- components/home/FilterableProductSection.tsx, HierarchicalFilter.tsx
- components/product/CountdownTimer.tsx, ImageGallery.tsx
- components/ui/carousel.tsx, CountdownBadge.tsx, input-otp.tsx, Modal.tsx, Toast.tsx, toggle-group.tsx

### Dependencias removidas
- `vite` ^7.2.4
- `@vitejs/plugin-react` ^5.1.1
- `react-router-dom` ^7.14.0
- `eslint-plugin-react-refresh` ^0.4.24
- `kimi-plugin-inspect-react` ^1.0.3

### Dependencias agregadas
- `next` ^16.2.2

### Seguridad
- 0 vulnerabilidades npm (npm audit fix aplicado)
- .env y .env.local en .gitignore (credenciales no expuestas)
- Zod validation en API /api/leads (input sanitization)
- PrismaClient singleton previene connection pool exhaustion
- poweredByHeader: false en next.config.ts
- WhatsApp number: +1 316 (testing) - produccion via env var

---

## Arquitectura Final

```
allmedic-frontstore v1.0.0
├── Framework: Next.js 16.2.2 (App Router + Turbopack)
├── Runtime: React 19.2 + TypeScript 5.9
├── ORM: Prisma 5.22 -> MySQL (Hostinger remoto)
├── Styling: Tailwind CSS 3.4 + shadcn/ui (~79 componentes)
├── Validation: Zod 4.3
├── State: Context API + localStorage
└── Build: Webpack fallback (CSS compatibility)

Rutas (9 total):
├── Static (SSG):
│   ├── /           -> Home con hero carousel + productos destacados
│   ├── /catalogo   -> Catalogo con filtros, busqueda, paginacion
│   ├── /marcas     -> Grid de marcas con conteo de productos
│   └── /sucursales -> Mapa de tiendas fisicas
├── Dynamic (SSR):
│   └── /p/[slug]   -> Detalle de producto con variantes color x talla
└── API Routes:
    ├── /api/products -> GET con filtros, paginacion, includes
    ├── /api/leads    -> POST con Zod validation, GET admin
    └── /api/search   -> GET full-text + analytics logging

Base de datos (12 modelos Prisma):
├── User, Brand, Collection, Color
├── Product, ProductVariant, ProductImage
├── Store, Lead, Banner
└── SearchLog, WhatsAppClick
```

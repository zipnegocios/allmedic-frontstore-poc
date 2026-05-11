# Allmedic Frontstore — Agent Guide

> This file is written for AI coding agents. It describes the project architecture, conventions, and commands you need to know before making changes.
> The project comments and documentation are in **Spanish**; user-facing copy is also in Spanish (Ecuador market).

---

## Project Overview

**Allmedic Frontstore** is a Next.js 16 e-commerce front-end for a medical-scrubs retailer based in Ecuador. It sells premium uniforms (scrubs) from brands like FIGS, Cherokee, Grey's Anatomy, WonderWink, Koi, Dickies, Skechers, and others.

The application was originally built with Vite + React Router and was **migrated to Next.js App Router** (completed 2026-04-05). Some legacy patterns remain (e.g., the `src/legacy-pages/` directory) but the runtime is fully Next.js.

Key characteristics:
- **No online payment processing** — the checkout flow generates a WhatsApp message to a hardcoded US number (`13164695701`).
- **Volume discounts** are hardcoded in the cart: 3+ units = 10 % off, 5+ = 15 %, 10+ = 20 %.
- **Target market:** Healthcare professionals in Ecuador (stores in Quito, Guayaquil, Cuenca).

---

## Technology Stack

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| Framework | Next.js (App Router) | 16.2.2 |
| React | React | 19.2.0 |
| Language | TypeScript | ~5.9.3, `strict: true` |
| Styling | Tailwind CSS | 3.4.19 |
| UI Components | shadcn/ui (New York style) | 50+ components in `src/components/ui/` |
| Primitives | Radix UI | Various packages (`@radix-ui/react-*`) |
| ORM | Prisma | 5.22.0 |
| Database | MySQL | Via `DATABASE_URL` env var |
| Forms | react-hook-form + zod | 7.70.0 / 4.3.5 |
| Icons | lucide-react | 0.562.0 |
| Build Tool | Turbopack (default) | `next dev` uses Turbopack |

---

## Project Structure

```
c:\zip\allmedic-frontstore-poc
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── leads/route.ts
│   │   │   ├── products/route.ts
│   │   │   └── search/route.ts
│   │   ├── catalogo/          # Catalog page (SSG)
│   │   │   ├── page.tsx
│   │   │   └── CatalogoContent.tsx
│   │   ├── marcas/            # Brands page (SSG)
│   │   ├── p/[slug]/          # Product detail (SSR)
│   │   ├── sucursales/        # Stores page (SSG)
│   │   ├── layout.tsx         # Root layout with providers
│   │   └── page.tsx           # Home page
│   ├── components/
│   │   ├── ui/                # shadcn/ui components (50+)
│   │   ├── layout/            # Header, Footer, AppShell, MegaMenu
│   │   ├── catalog/           # ProductCard, FilterSidebar, etc.
│   │   ├── product/           # ImageGallery, VariantSelector, etc.
│   │   ├── cart/              # CartDrawer, CartItem
│   │   └── home/              # BrandCarousel, Hero, etc.
│   ├── context/               # CartContext, NotificationContext
│   ├── hooks/                 # useProductFilter, useDebug, use-mobile
│   ├── legacy-pages/          # Reusable page content components
│   │   ├── Home.tsx
│   │   ├── Product.tsx
│   │   └── Stores.tsx
│   ├── lib/                   # Utilities, types, Prisma client, data service
│   │   ├── data-service.ts    # Single source of truth for data fetching
│   │   ├── dummy-data.ts      # Legacy fallback data (still referenced in some places)
│   │   ├── prisma.ts          # PrismaClient singleton
│   │   ├── types.ts           # Frontend type definitions
│   │   ├── utils.ts           # `cn()` helper (clsx + tailwind-merge)
│   │   ├── whatsapp.ts        # WhatsApp message generation & lead registration
│   │   └── navigation.tsx     # Navigation links
│   ├── App.css                # App-specific styles
│   └── index.css              # Tailwind directives + CSS variables
├── prisma/
│   ├── schema.prisma          # Database schema (12 models)
│   └── seed.ts                # Seed script with demo data
├── public/images/             # Static assets (products, brands, heroes)
├── .next/                     # Next.js build output
├── dist/                      # Legacy Vite build artifact (can be removed)
└── .claude/                   # Claude Code docs, skills, audits
```

### Path Aliases

`tsconfig.json` maps `@/*` to `./src/*`. Always use `@/components`, `@/lib`, etc.

---

## Build & Development Commands

All commands are defined in `package.json`:

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Next.js dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint check (`eslint .`) |
| `npm run prisma:migrate` | Run Prisma migrations (`prisma migrate dev`) |
| `npm run prisma:seed` | Seed the database (`tsx prisma/seed.ts`) |
| `npm run db:push` | Push schema without migration (`prisma db push`) |
| `npm run db:studio` | Open Prisma Studio |

### Environment Variables

The app expects these environment variables (defined in `.env` / `.env.local`, both gitignored):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | MySQL connection string for Prisma |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | No | WhatsApp number (falls back to hardcoded `13164695701`) |

`next.config.ts` also references `VITE_WHATSAPP_NUMBER` as a fallback for backward compatibility.

---

## Code Organization Patterns

### Server Components by Default

Pages in `src/app/` are **Server Components** unless they need client interactivity. Client components are marked with `'use client'` at the top. There are approximately 27 client components.

### Data Fetching

All database access goes through **`src/lib/data-service.ts`**. This file:
- Exports async functions like `getAllProducts()`, `getProductBySlug()`, `getFeaturedProducts()`, etc.
- Transforms Prisma DB results into frontend `Product` types.
- Is imported by both Server Components (pages) and API routes.

**Do not import `@prisma/client` directly in pages** — always use `data-service.ts` or `prisma.ts`.

### Legacy Page Pattern

Reusable page content lives in `src/legacy-pages/` and is consumed by thin wrappers in `src/app/`:

```
src/app/page.tsx          -> imports Home from src/legacy-pages/Home.tsx
src/app/p/[slug]/page.tsx -> imports Product from src/legacy-pages/Product.tsx
src/app/sucursales/page.tsx -> imports Stores from src/legacy-pages/Stores.tsx
```

When adding new pages, prefer writing them directly in `src/app/` unless they need to be shared.

### Global State

- **`CartContext`** (`src/context/CartContext.tsx`) — persisted to `localStorage`. Contains volume discount logic.
- **`NotificationContext`** (`src/context/NotificationContext.tsx`) — toast/notification system.

Both are mounted in `src/app/layout.tsx` inside `AppShell`.

---

## Database Schema (Prisma + MySQL)

The schema defines 12 models across 5 domains:

| Domain | Models |
|--------|--------|
| **Auth** | `User` (roles: `SUPER_ADMIN`, `CATALOG_MANAGER`) |
| **Catalog** | `Brand`, `Collection`, `Color`, `Product`, `ProductVariant`, `ProductImage` |
| **Stores** | `Store` |
| **Leads/Orders** | `Lead` (statuses: `SENT`, `CONTACTED`, `CONVERTED`, `CANCELLED`) |
| **CMS** | `Banner` |
| **Analytics** | `SearchLog`, `WhatsAppClick` |

### Key Product Fields

- `slug` (unique), `name`, `description`, `sku`, `category`, `productType`, `gender` (`HOMBRE`/`MUJER`/`UNISEX`)
- Pricing: `priceNormal` (Decimal), `priceSale` (Decimal), `discountPct`, `discountEnd`
- Flags: `isNew`, `isBestSeller`, `isActive`
- Relations: `brand`, `collection`, `variants[]`, `images[]`
- JSON arrays: `features`, `careInstructions`, `styles`
- Full-text index on `[name, description]` (Prisma preview feature)

### PrismaClient Singleton

`src/lib/prisma.ts` exports a single PrismaClient instance. In development it is attached to the global object to prevent multiple instances during hot reload.

---

## API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/products` | GET | Paginated product list with optional search/category/brand filters |
| `/api/search` | GET | Full-text product search; logs query to `SearchLog` |
| `/api/leads` | POST, GET | Create lead from cart (POST); list leads admin-only (GET) |

All API routes return JSON. The GET `/api/leads` route has a `// TODO: Add auth check` comment.

---

## Code Style Guidelines

### TypeScript

- `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- Target: ES2020, module: ESNext, moduleResolution: bundler
- Always use explicit types for function parameters and return values when not inferred.

### ESLint

Flat config (`eslint.config.js`):
- `@eslint/js` recommended
- `typescript-eslint` recommended
- `eslint-plugin-react-hooks` recommended
- Ignores: `dist`, `.next`, `node_modules`

### Naming Conventions

- **Components**: PascalCase (`ProductCard.tsx`, `CartDrawer.tsx`)
- **Hooks**: camelCase starting with `use` (`useCart`, `useNotificationContext`)
- **Utilities/Types**: camelCase (`data-service.ts`, `types.ts`)
- **CSS classes**: Tailwind utility classes; use `cn()` from `@/lib/utils` for conditional classes

### Styling

- Tailwind CSS with CSS variables in `src/index.css`
- Dark mode supported via `.dark` class (toggle via `next-themes`)
- Custom colors use HSL values mapped to CSS variables (`--primary`, `--background`, etc.)
- shadcn/ui components use the New York style

### Comments & Language

- Code comments are in **Spanish** (e.g., `// ---- CATALOGO ----`, `// Seeding colors...`).
- User-facing strings are in **Spanish**.
- When adding new comments or UI copy, continue using Spanish.

---

## Testing

**No test framework is currently configured.** There are zero `*.test.*` or `*.spec.*` files. No Jest, Vitest, Playwright, or Cypress in dependencies.

If you add tests, the convention would be to place them next to the files they test or in a `__tests__` directory.

---

## Deployment

### Target: Hostinger Node.js

- Build command: `npm run build && npm start`
- Images are **unoptimized** (`images.unoptimized: true` in `next.config.ts`) for static-hosting compatibility.
- `poweredByHeader: false` for security.

### Required Environment Variables on Server

- `DATABASE_URL`
- `NEXT_PUBLIC_WHATSAPP_NUMBER` (optional, fallback hardcoded)

There is **no CI/CD, Docker, or GitHub Actions** configured. Deployment is manual.

---

## Security Considerations

1. **No authentication on API routes** — GET `/api/leads` has a `// TODO: Add auth check` comment.
2. **WhatsApp number is hardcoded** in `src/lib/whatsapp.ts` (`13164695701`).
3. **Environment files are gitignored** — `.env` and `.env.local` contain secrets.
4. **Prisma queries are parameterized** — no raw SQL injection risk.
5. **Zod validation** is used on the `/api/leads` POST endpoint.

---

## Known Issues & Migration Debt

1. **README.md is outdated** — still references Vite + React Router. Use this `AGENTS.md` or `.claude/MIGRATION_SUMMARY.md` for accurate info.
2. **`src/lib/dummy-data.ts` still exists** and is referenced in some hooks (`useProductFilter.ts`, `Header.tsx` search fallback). Prefer `data-service.ts` for all new work.
3. **`components.json` has `"rsc": false`** — this was set during the Vite era. New shadcn/ui components may need manual adjustment for Next.js App Router.
4. **`dist/` folder** is a leftover Vite build artifact and can be removed.

---

## Useful Reference

| File | Purpose |
|------|---------|
| `src/lib/types.ts` | Frontend type definitions (`Product`, `CartItem`, `Store`, etc.) |
| `src/lib/data-service.ts` | All data-fetching functions |
| `src/lib/utils.ts` | `cn()` helper for Tailwind class merging |
| `src/lib/whatsapp.ts` | WhatsApp message generation and lead registration |
| `prisma/schema.prisma` | Database schema |
| `prisma/seed.ts` | Demo data seed script |
| `.claude/MIGRATION_SUMMARY.md` | Full Vite to Next.js migration report |
| `.claude/TECHNICAL_AUDIT.md` | Production readiness audit |

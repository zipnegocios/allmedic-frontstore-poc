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
| ORM | Drizzle ORM | 0.45.2 |
| Database | PostgreSQL | Via `DATABASE_URL` env var (pgvector para RAG) |
| Forms | react-hook-form + zod | 7.70.0 / 4.3.5 |
| Icons | lucide-react | 0.562.0 |
| Auth | NextAuth.js | 5.0.0-beta.31 |
| Build Tool | Turbopack (default) | `next dev` uses Turbopack |

---

## Project Structure

```
c:\dev\allmedic-frontstore-poc
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (store)/           # Public store routes group
│   │   │   ├── page.tsx       # Home page
│   │   │   ├── catalogo/      # Product catalog
│   │   │   ├── p/[slug]/      # Product detail (SSR)
│   │   │   ├── marcas/        # Brands page
│   │   │   ├── sucursales/    # Stores page
│   │   │   └── layout.tsx     # Store layout with providers
│   │   ├── admin/             # Protected admin routes (NextAuth)
│   │   │   ├── login/         # Admin login
│   │   │   └── (dashboard)/   # Protected dashboard routes
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # NextAuth endpoints
│   │   │   ├── products/      # Product CRUD
│   │   │   ├── admin/         # Admin endpoints
│   │   │   ├── leads/         # Lead submission
│   │   │   └── search/        # Search endpoint
│   │   └── layout.tsx         # Root layout with metadata
│   ├── components/
│   │   ├── ui/                # shadcn/ui components (50+)
│   │   ├── layout/            # Header, Footer, AppShell, MegaMenu
│   │   ├── catalog/           # ProductCard, FilterSidebar, etc.
│   │   ├── product/           # ImageGallery, VariantSelector, etc.
│   │   ├── cart/              # CartDrawer, CartItem
│   │   └── home/              # BrandCarousel, Hero, etc.
│   ├── context/               # CartContext, NotificationContext
│   ├── hooks/                 # useProductFilter, useDebug, use-mobile, useNotification
│   ├── legacy-pages/          # Legacy page content (migration in progress)
│   │   ├── Home.tsx
│   │   ├── Product.tsx
│   │   └── Stores.tsx
│   ├── lib/                   # Utilities, types, data service
│   │   ├── data-service.ts    # Single source of truth for data fetching
│   │   ├── types.ts           # Frontend type definitions
│   │   ├── utils.ts           # `cn()` helper (clsx + tailwind-merge)
│   │   ├── whatsapp.ts        # WhatsApp integration
│   │   ├── uuid.ts            # UUID generation
│   │   ├── navigation.tsx     # Navigation links
│   │   └── rules-engine/      # Business rules motor (NEW - Fase 1)
│   ├── db/                    # Database & ORM (Drizzle + PostgreSQL)
│   │   ├── schema/            # Drizzle schema definitions
│   │   │   ├── index.ts       # Re-exports all schemas
│   │   │   ├── products.ts    # Products, brands, colors, collections
│   │   │   ├── auth.ts        # Users, accounts, sessions (NextAuth)
│   │   │   ├── commerce.ts    # Orders, cart items (NEW - Fase 1)
│   │   │   ├── corporate.ts   # Corporate catalogs (NEW - Fase 1)
│   │   │   ├── chats.ts       # Chat history
│   │   │   └── rag.ts         # RAG documents, embeddings
│   │   ├── migrations/        # Auto-generated Drizzle migrations
│   │   ├── seed.ts            # Database seeding script
│   │   ├── migrate.ts         # Migration runner
│   │   └── index.ts           # Database connection
│   ├── App.css                # App-specific styles
│   └── index.css              # Tailwind directives + CSS variables
├── public/images/             # Static assets
├── .next/                     # Next.js build output
├── .claude/                   # Claude Code docs, skills
├── drizzle.config.ts          # Drizzle ORM configuration
└── next.config.ts             # Next.js configuration
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
| `npm run db:generate` | Generate Drizzle migration files (`drizzle-kit generate`) |
| `npm run db:push` | Push schema to database (`drizzle-kit push`) |
| `npm run db:migrate` | Run migrations if needed (`tsx src/db/migrate.ts`) |
| `npm run db:seed` | Seed the database (`tsx src/db/seed.ts`) |
| `npm run db:studio` | Open Drizzle Studio (web UI for database) |

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

## Database Schema (Drizzle ORM + PostgreSQL)

The schema is defined across multiple files in `src/db/schema/`:

| Domain | Tables | File |
|--------|--------|------|
| **Auth** | `users`, `accounts`, `sessions`, `verificationTokens` | `auth.ts` |
| **Catalog** | `brands`, `collections`, `colors`, `products`, `productVariants` | `products.ts` |
| **Commerce** | `orders`, `orderItems`, `volumeDiscounts`, `cartItems` | `commerce.ts` |
| **Corporate** | `setGroups`, `corporateSets`, `setItems`, `businessRules`, `corporateAccounts`, `corporateCarts`, `quoteRequests`, `quoteStatusHistory`, `quoteAttachments` | `corporate.ts` (NEW - Fase 1) |
| **Stores** | `stores` | `products.ts` |
| **RAG/Chat** | `documents`, `embeddings`, `chats` | `rag.ts`, `chats.ts` |

### Key Tables

**`products`** — Product master
- `id`, `slug` (unique), `name`, `description`, `sku`, `category`, `gender`
- Pricing: `priceNormal`, `priceSale`, `discountPct`, `discountEnd`
- NEW (Fase 1): `priceWholesale`, `priceWholesaleSale`, `visibility` (`INDIVIDUAL`|`GROUPS`|`BOTH`)
- Relations: `brand`, `variants[]`, `collections[]`

**`productVariants`** — Size/color combinations
- `id`, `productId`, `size`, `color`, `sku`, `stock`, `imageUrl`

**`businessRules`** (NEW - Fase 1) — Business logic engine
- `id`, `name`, `ruleType`, `scope`, `scopeId`, `config` (JSONB), `isActive`, `priority`, `validFrom`, `validTo`
- Supports: `MIN_QUANTITY`, `SIZE_MODE`, `PRICE_VISIBILITY`, `INVENTORY_MODE`, `VOLUME_SCALE`, `PROMO`, etc.

### Database Connection

`src/db/index.ts` exports a Drizzle client. Use it via `data-service.ts` or API routes. Direct database queries go through `drizzle-orm` query builder.

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

1. **README.md is outdated** — still references Vite + React Router. Use this `AGENTS.md` for accurate info.
2. **`src/lib/dummy-data.ts` still exists** and may be referenced in legacy code. Prefer `data-service.ts` for all new work.
3. **`src/legacy-pages/` directory** contains old page implementations. Gradually migrate to `src/app/` structure.
4. **Admin routes structure is evolving** — `/admin` dashboard is being built out (products, brands, colors, stores, banners, leads management).
5. **Drizzle schema in evolution** — `corporate.ts` and `business_rules` will be added in Fase 1 of the corporate catalog feature.

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

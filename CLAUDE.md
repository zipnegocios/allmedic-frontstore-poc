# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Allmedic Frontend Store POC** — React 19 + Vite catalog application with contact-to-WhatsApp conversion flow. **Currently migrating to Next.js 14 App Router with MySQL/Prisma backend.**

- **Status:** Phase 1 - Foundation setup (as of April 5, 2026)
- **Current Stack:** React 19 + Vite 7 + React Router v7
- **Target Stack:** Next.js 14 App Router + Prisma 5 + MySQL (Hostinger remote)
- **Timeline:** 6-week migration plan (Phases 0-3)

## Key Architecture

### Current (Vite + React)

```
Frontend: React 19 + TypeScript 5.9
Routing: react-router-dom v7 (BrowserRouter - client-only)
State: Context API + localStorage
Database: None (dummy-data.ts with 8 hardcoded products)
API: None
Styling: Tailwind CSS 3.4 + shadcn/ui (~79 components, 57 are shadcn/ui directly portable)
```

### Target (Next.js 14)

```
Framework: Next.js 14 App Router
Backend: Server Components + Server Actions + Route Handlers
ORM: Prisma 5 (MySQL)
Database: Hostinger remote MySQL (u742656042_amudata)
Auth: NextAuth.js v5 (admin only - NOT for storefront users)
API: /api/products, /api/search, /api/leads, etc.
Styling: Same Tailwind + shadcn/ui (no changes needed)
```

### Prisma Schema (12 Models)

```prisma
- User (roles: SUPER_ADMIN, CATALOG_MANAGER)
- Brand (with logo, sortOrder, isActive)
- Collection (per brand)
- Color (hex values for variant filtering)
- Product (with FULLTEXT index for search)
- ProductVariant (color × size matrix)
- ProductImage (hero + color-specific images)
- Store (physical locations)
- Lead (WhatsApp conversions: name, city, phone, cart snapshot)
- Banner (CMS content)
- SearchLog (analytics)
- WhatsAppClick (analytics)
```

**Connection:** `DATABASE_URL="mysql://u742656042_amuname:...@srv1505.hstgr.io:3306/u742656042_amudata"`

## Common Development Commands

```bash
# Development
npm run dev          # Start Vite dev server (localhost:5173)
npm run dev:debug   # Dev with debug output

# Building
npm run build       # TypeScript check + Vite build to dist/
npm run preview     # Preview production build locally

# Linting
npm run lint        # ESLint on all files

# Database
npx prisma migrate dev --name <name>  # Create + run migration
npx prisma studio                     # Open Prisma Studio (GUI)
npx prisma generate                   # Regenerate PrismaClient
```

## Project Structure

```
src/
├── pages/              # Vite page routes (will become app/ in Next.js)
│   ├── Home.tsx
│   ├── Product.tsx     # 566 lines - COMPLEX (needs refactor for SSR)
│   ├── Catalog.tsx     # 408 lines - COMPLEX (filter consolidation needed)
│   ├── Cart.tsx
│   └── ...
├── components/
│   ├── header/         # Header.tsx - 396 lines (acoplado a react-router)
│   ├── product/        # Product cards, detail
│   ├── filters/        # HierarchicalFilter + FilterSidebar (DUPLICATE - consolidate)
│   ├── cart/           # Cart components
│   ├── ui/             # shadcn/ui components (79 total, 57 are shadcn)
│   └── ...
├── hooks/
│   ├── useProductFilter.ts  # DEAD CODE - remove (contains React violation: setState in useMemo)
│   ├── useCart.ts
│   └── ...
├── context/
│   ├── CartContext.tsx      # localStorage + Context (needs Zod validation)
│   ├── NotificationContext  # NEEDS EXTRACTION - currently in App.tsx (blocks Next.js)
│   └── ...
├── lib/
│   ├── whatsapp.ts          # WhatsApp integration (testing number: +1 316 - LEAVE AS-IS in dev)
│   ├── types.ts             # Type definitions (CatalogFilters has duplicate fields - consolidate)
│   ├── dummy-data.ts        # REPLACE with API calls to /api/products
│   └── ...
├── App.tsx                  # Root component (contains NotificationContext - EXTRACT before migration)
└── main.tsx                 # Entry point

prisma/
├── schema.prisma            # MySQL schema with 12 models
└── migrations/              # Auto-created by Prisma migrations

public/
├── images/
│   ├── brands/              # 15 brand logos (✅ verified present)
│   ├── products/            # Category + hero images (✅ 86 total assets verified)
│   └── ...
```

## Critical Issues to Fix BEFORE Migration

### 1. **NotificationContext in App.tsx** (BLOCKER)
- Currently: `src/App.tsx` defines NotificationContext, imported as `@/App` in `Product.tsx`
- Problem: Next.js App Router doesn't export from App.tsx
- **Action:** Extract to `src/context/NotificationContext.tsx`, create provider in layout

### 2. **useProductFilter Dead Code** (CLEANUP)
- `src/hooks/useProductFilter.ts` — violates React (setState inside useMemo + uncleared setTimeout)
- Next.js Strict Mode will flag this
- **Action:** Delete entirely (no longer used in render tree)

### 3. **Duplicate Filter Implementations** (CONSOLIDATION)
- `HierarchicalFilter.tsx` and `FilterSidebar.tsx` solve the same problem differently
- `CatalogFilters` type has duplicate fields (singular & plural names)
- **Action:** Pick one, unify interface before migration

### 4. **WhatsApp Number** (TESTING VALUE)
- Currently: `+1 316` (Kansas, USA) — **INTENTIONAL for testing/dev**
- Production should be: `+593` (Ecuador)
- **Action:** LEAVE as-is in development. Change via environment variable for production.

### 5. **CartContext Validation** (SECURITY)
- localStorage + Context have no schema validation
- Zod is already in dependencies but unused
- **Action:** Wrap localStorage reads with `CartItemSchema.parse()`

## Migration Phases

### Phase 0 (COMPLETED ✅)
- ✅ Install Prisma 5
- ✅ Create MySQL schema (12 models)
- ✅ Connect to Hostinger remote database
- ✅ Verify image assets exist

### Phase 1 (MVP Storefront - Weeks 1-2)
- [ ] Extract NotificationContext from App.tsx
- [ ] Delete useProductFilter.ts (dead code)
- [ ] Consolidate filter implementations
- [ ] Seed MySQL with real products (from dummy-data.ts)
- [ ] Create API routes: `/api/products`, `/api/products/[id]`, `/api/search`
- [ ] Create `/api/leads` for WhatsApp conversions
- [ ] Replace dummy-data imports with API calls
- [ ] Add Zod validation to CartContext
- [ ] Test MVP in production environment

### Phase 2 (Next.js Migration - Weeks 3-4)
- [ ] Install Next.js 14 + create-next-app
- [ ] Copy 57 portable shadcn/ui components
- [ ] Migrate Catalog → app/catalog/page.tsx (Server Component with client filters)
- [ ] Migrate Product → app/products/[slug]/page.tsx (SSR with getProduct server action)
- [ ] Migrate Home → app/page.tsx
- [ ] Implement NextAuth.js v5 (admin auth only)
- [ ] Configure database queries as Server Components + Server Actions
- [ ] Remove react-router-dom entirely

### Phase 3 (Admin + Optimization - Weeks 5-6)
- [ ] Admin dashboard: `/admin/products` (CRUD)
- [ ] Image upload + variant matrix (size × color)
- [ ] Store management
- [ ] MySQL FULLTEXT search optimization
- [ ] SEO: metadata, sitemap, structured data
- [ ] Performance: Image optimization, ISR, Edge caching

## Code Patterns & Decisions

### Server vs Client Components (Next.js)

```typescript
// SERVER COMPONENT (default in app/ layout)
// ✅ Database queries, Server Actions, async rendering
export default async function CatalogPage() {
  const products = await db.product.findMany()
  return <CatalogClient products={products} />
}

// CLIENT COMPONENT (for interactivity)
'use client'
export default function CatalogClient({ products }) {
  const [filters, setFilters] = useState(...)
  return (...)
}
```

- **Rule:** Server by default; client only for interactivity (filters, cart, modals)
- **Why:** Reduces bundle size, enables database queries in components
- **Exception:** All shadcn/ui components are client (they use hooks) — wrap in 'use client'

### Cart Strategy

Current: localStorage + React Context
Next.js: Keep localStorage for fast UX, validate with Zod on read, sync via Server Action before checkout

### WhatsApp Conversion

- Trigger: User adds to cart + clicks "Contact via WhatsApp"
- Flow: Create Lead record (name, city, cart snapshot) → POST to /api/leads → Redirect to WhatsApp URL
- Analytics: Track via WhatsAppClick model

## Common Gotchas

1. **Prisma + Next.js cold starts** — use `@prisma/client` in API routes, not `$queryRaw`
2. **Image paths** — `/public/images/` becomes accessible at `/images/` in both Vite and Next.js
3. **Environment variables** — Prefix with `NEXT_PUBLIC_` in Next.js if needed in browser
4. **react-router-dom paths** — Many Header/Product/Catalog imports (`useNavigate`, `useParams`) don't exist in Next.js. Replace with `useRouter` from `next/router` (App Router)

## Testing & Quality

- **Type checking:** `tsc -b` before commits
- **Linting:** ESLint on all changes (run locally: `npm run lint`)
- **Database:** Always test migrations in dev database first
- **Images:** Verify all new image paths in `/public/images/` exist

## Skills Available

These Claude skills are available for this project:
- **OWASP Security:** Use when implementing auth, API routes, form handling
- **UI/UX Guide:** Use when redesigning components for Next.js
- **Product Manager Skills:** Use for roadmap/phase prioritization via RICE scoring
- **Linear Skill:** Integration with Linear for issue tracking
- **CSV Data Summarizer:** For data analysis/reporting

## Next Action

Start Phase 1: Fix critical blockers (NotificationContext, dead code, duplicate filters) before touching Next.js. This unblocks Phase 2 and reduces migration risk.

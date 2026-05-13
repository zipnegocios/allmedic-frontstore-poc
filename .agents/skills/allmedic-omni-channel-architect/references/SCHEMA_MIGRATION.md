# SCHEMA_MIGRATION.md — MySQL → PostgreSQL + Drizzle ORM

> Guía para migrar la base de datos de Allmedic de Prisma/MySQL a Drizzle ORM/PostgreSQL + pgvector.

---

## 1. Mapeo de Tipos: Prisma → Drizzle + PostgreSQL

| Prisma (MySQL) | Drizzle (PostgreSQL) | Notas |
|----------------|----------------------|-------|
| `String` | `text` | PG usa `text` por defecto |
| `String @db.Text` | `text` | Equivalente directo |
| `String @unique` | `text("...").unique()` | PG soporta UNIQUE en text |
| `Int` | `integer` | Directo |
| `Boolean` | `boolean` | ⚠️ Migrar `TINYINT(1)` → `true`/`false` |
| `DateTime` | `timestamp({ withTimezone: true })` | Usar timezone |
| `Decimal @db.Decimal(10,2)` | `decimal({ precision: 10, scale: 2 })` | Idéntico |
| `Json` | `jsonb` | PG `jsonb` es indexable con GIN |
| `Enum` | `pgEnum(...)` | Drizzle genera enum nativo |
| `Unsupported("vector(1536)")` | `vector("embedding", { dimensions: 1536 })` | Requiere `drizzle-orm/pg-core` + pgvector |

---

## 2. Estructura Modular del Schema Drizzle

```
src/db/schema/
├── index.ts          # Re-exporta todo
├── auth.ts           # Users, accounts, sessions, verificationTokens
├── products.ts       # Products, variants, images, colors, brands, collections
├── commerce.ts       # Leads, stores, banners, searchLogs, whatsappClicks
├── chats.ts          # Conversations, messages, messageEmbeddings
└── vector.ts         # Helpers para pgvector (opcional)
```

### 2.1 `src/db/schema/products.ts`

```typescript
import { pgTable, text, integer, boolean, decimal, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core"; // o extensión custom

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sku: text("sku"),
  brandId: uuid("brand_id").references(() => brands.id),
  category: text("category").notNull(),
  gender: text("gender").notNull(), // 'HOMBRE' | 'MUJER' | 'UNISEX'
  priceNormal: decimal("price_normal", { precision: 10, scale: 2 }).notNull(),
  priceSale: decimal("price_sale", { precision: 10, scale: 2 }),
  discountPct: integer("discount_pct"),
  discountEnd: timestamp("discount_end", { withTimezone: true }),
  isNew: boolean("is_new").default(false),
  isBestSeller: boolean("is_best_seller").default(false),
  isActive: boolean("is_active").default(true),
  features: jsonb("features"),       // string[]
  careInstructions: jsonb("care_instructions"), // string[]
  styles: jsonb("styles"),           // string[]
  embedding: vector("embedding", { dimensions: 1536 }), // pgvector
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  colorId: uuid("color_id").notNull(),
  size: text("size").notNull(),
  fit: text("fit"),
  sku: text("sku").notNull().unique(),
  status: text("status").notNull().default("AVAILABLE"), // AVAILABLE | BACKORDER | OUT_OF_STOCK
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const productImages = pgTable("product_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  colorId: uuid("color_id"),
  url: text("url").notNull(),
  alt: text("alt"),
  sortOrder: integer("sort_order").default(0),
});

export const colors = pgTable("colors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  hex: text("hex").notNull(),
});
```

### 2.2 `src/db/schema/chats.ts`

```typescript
import { pgTable, text, integer, boolean, timestamp, jsonb, uuid, index } from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: text("channel").notNull(), // 'whatsapp' | 'instagram'
  externalId: text("external_id").notNull(), // WA chat ID o IG thread ID
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerIgHandle: text("customer_ig_handle"),
  status: text("status").notNull().default("OPEN"), // OPEN | PENDING | CLOSED
  assignedTo: uuid("assigned_to"), // User ID del agente
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_conversations_channel_external").on(table.channel, table.externalId),
  index("idx_conversations_status").on(table.status),
]);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // 'whatsapp' | 'instagram_dm' | 'instagram_comment'
  direction: text("direction").notNull(), // 'inbound' | 'outbound'
  content: text("content").notNull(),
  mediaUrl: text("media_url"), // Para imágenes/videos
  metadata: jsonb("metadata"), // { waMessageId, igCommentId, etc. }
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_messages_conversation").on(table.conversationId),
  index("idx_messages_created_at").on(table.createdAt),
]);
```

### 2.3 `src/db/schema/auth.ts` (Auth.js v5 + Drizzle)

```typescript
import { pgTable, text, timestamp, uuid, primaryKey, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  password: text("password"), // Hashed con bcrypt
  role: text("role").notNull().default("CATALOG_MANAGER"), // SUPER_ADMIN | CATALOG_MANAGER
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const accounts = pgTable("accounts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (account) => [
  primaryKey({ columns: [account.provider, account.providerAccountId] }),
]);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").notNull().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
}, (vt) => [
  primaryKey({ columns: [vt.identifier, vt.token] }),
]);
```

---

## 3. Configuración de Drizzle

### `src/db/index.ts`

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
export type DB = typeof db;
```

### `drizzle.config.ts`

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

## 4. Instalación de Dependencias

```bash
# Drizzle ORM + PostgreSQL
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg

# pgvector support
npm install pgvector

# Auth.js v5 + Drizzle Adapter
npm install next-auth@beta @auth/drizzle-adapter

# Para ETL MySQL → PostgreSQL
npm install mysql2
```

---

## 5. Comandos de Migración

```bash
# Generar migración
npx drizzle-kit generate

# Aplicar migración
npx drizzle-kit migrate

# Push schema (dev)
npx drizzle-kit push

# Studio visual
npx drizzle-kit studio
```

---

## 6. Notas de Migración Críticas

1. **pgvector extension**: Ejecutar `CREATE EXTENSION vector;` en PostgreSQL antes de aplicar migraciones.
2. **Full-text search**: Reemplazar `@@fulltext` de Prisma por índices GIN en PG:
   ```sql
   CREATE INDEX idx_products_fts ON products USING GIN (to_tsvector('spanish', name || ' ' || COALESCE(description, '')));
   ```
3. **Boolean migration**: MySQL `TINYINT(1)` → PostgreSQL `boolean`. Validar que no haya valores distintos de 0/1.
4. **UUID vs CUID**: Drizzle usa `uuid` con `defaultRandom()` (generado por PG). Los IDs existentes de Prisma (`cuid()`) son strings compatibles con `text` o `varchar`.
5. **JSONB vs JSON**: Usar `jsonb` siempre. Es más eficiente y permite índices GIN.

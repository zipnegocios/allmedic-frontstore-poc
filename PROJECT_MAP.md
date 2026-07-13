# PROJECT_MAP.md — Mapeo Técnico de Allmedic Frontstore

> **Fecha de generación:** 2026-05-11  
> **Versión del proyecto:** Next.js 16.2.2 + React 19.2.0 + Prisma 5.22.0  
> **Autor:** CTO / Arquitecto de Software (Análisis automatizado del código fuente)  
> **Propósito:** Fuente de verdad sobre el funcionamiento actual de la aplicación antes de añadir nuevas funcionalidades (especialmente IA).

---

## Tabla de Contenidos

1. [Mapeo del Frontend y UX](#1-mapeo-del-frontend-y-ux)
2. [Inventario de APIs y Datos](#2-inventario-de-apis-y-datos)
3. [Gestión de Activos y Media](#3-gestión-de-activos-y-media)
4. [Dashboard y Lógica de Negocio](#4-dashboard-y-lógica-de-negocio)
5. [Puntos de Inyección para IA](#5-puntos-de-inyección-para-ia)
6. [Apéndices](#6-apéndices)

---

## 1. Mapeo del Frontend y UX

### 1.1 Páginas Principales (`src/app/`)

| Ruta | Archivo(s) | Tipo | Descripción y Componentes Consumidos |
|------|-----------|------|--------------------------------------|
| `/` (Home) | `src/app/page.tsx` | Server Component | Página de inicio. Consume `Home` desde `src/legacy-pages/Home.tsx` y `Footer` desde `src/components/layout/Footer.tsx`. Obtiene datos vía `getFeaturedProducts()`, `getHeroSlides()`, `getStores()`. |
| `/catalogo` | `src/app/catalogo/page.tsx` + `CatalogoContent.tsx` | Server + Client | Catálogo completo con filtros, búsqueda, ordenamiento y paginación. `page.tsx` obtiene datos con `getAllProducts()`, `getBrandNames()`, `getColors()`, `getStores()`. `CatalogoContent.tsx` es un Client Component que consume: `ProductCard`, `FilterSidebar`, `LayoutSwitcher`, `ProductListItem`. |
| `/marcas` | `src/app/marcas/page.tsx` | Server Component | Página de marcas. Muestra grid de marcas con logo, conteo de productos y link al catálogo filtrado. Consume `Footer`. Usa `getBrands()`, `getStores()`. |
| `/p/[slug]` | `src/app/p/[slug]/page.tsx` | Server Component (ruta dinámica) | Página de detalle de producto. Consume `Product` desde `src/legacy-pages/Product.tsx` y `Footer`. Obtiene producto vía `getProductBySlug(slug)`, y busca producto complementario con `getAllProducts()`. |
| `/sucursales` | `src/app/sucursales/page.tsx` | Server Component | Página de tiendas/sucursales. Consume `Stores` desde `src/legacy-pages/Stores.tsx` y `Footer`. Usa `getStores()`. |
| *(layout global)* | `src/app/layout.tsx` | Server Component (RootLayout) | Layout raíz que monta los providers globales: `NotificationProvider` → `CartProvider` → `AppShell`. Obtiene `products`, `brands`, `stores` vía `getAllProducts()`, `getBrandNames()`, `getStores()` y los pasa al `AppShell`. |

#### Jerarquía de Providers (en `layout.tsx`)

```
<html>
  <body>
    <NotificationProvider>
      <CartProvider>
        <AppShell products={...} brands={...} stores={...}>
          {children}   <-- páginas específicas
        </AppShell>
      </CartProvider>
    </NotificationProvider>
  </body>
</html>
```

---

### 1.2 Hooks Personalizados (`src/hooks/`)

| Archivo | Hook(s) | Propósito Funcional |
|---------|---------|---------------------|
| `use-mobile.ts` | `useIsMobile()` | Detecta si el viewport es móvil (`window.innerWidth < 768`). Usa un `useEffect` con listener de `resize`. Retorna booleano. |
| `useDebug.ts` | `useDebug(componentName)` | Hook de desarrollo para debuggear renders y cambios de estado de componentes. Expone: `log()`, `state()`, y trackea `renderCount` vía `useRef`. |
| `useDebug.ts` | `usePerformance(componentName)` | Mide performance de operaciones específicas usando `measurePerformance` de `@/lib/debug`. |
| `useDebug.ts` | `usePropsDebug(componentName, props)` | Compara props actuales vs previas e imprime en consola cuáles cambiaron. |
| `useNotification.ts` | `useNotification()` | Hook **standalone** (no usa contexto) para manejar notificaciones/toasts locales. Mantiene array de `Notification[]`, auto-elimina después de `duration` (default 3000ms). Expone: `showSuccess`, `showError`, `showWarning`, `showInfo`, `addNotification`, `removeNotification`. |
| `useProductFilter.ts` | `useProductFilter(itemsPerPage, products?)` | Hook de filtrado de catálogo. Recibe productos (o usa `DEFAULT_PRODUCTS` de dummy-data). Maneja estado de filtros (`CatalogFilters`), paginación, ordenamiento, búsqueda en grid, y conteo de filtros activos. Expone: `filters`, `filterOptions`, `paginatedProducts`, `currentPage`, `totalPages`, `totalProducts`, `isLoading`, `hasActiveFilters`, `activeFilterCount`, `applyFilters`, `resetFilters`, `goToPage`. |

> **Nota importante:** Hay **dos sistemas de notificación**:
> - `useNotification.ts` → hook standalone para uso local.
> - `useNotificationContext()` → del `NotificationContext` (global, vía React Context). Ambos coexisten.

---

### 1.3 Contextos Globales

#### A. `src/context/CartContext.tsx` — Carrito de Compras

| Aspecto | Detalle |
|---------|---------|
| **Estados globales** | `items: CartItem[]` — lista de items en el carrito. |
| **Persistencia** | ✅ **localStorage** bajo la clave `'cart'`. Se carga en el `useState` inicializador (con validación de estructura) y se guarda en un `useEffect` cada vez que `items` cambia. |
| **Datos computados** | `totalItems` (suma de cantidades), `totalPrice` (suma de precios × cantidad), `subtotal` (igual a totalPrice). |
| **Descuentos por volumen** | `VOLUME_DISCOUNTS` hardcodeado: 3+ unidades = 10%, 5+ = 15%, 10+ = 20%. `getActiveVolumeDiscount()` devuelve el descuento aplicable según `totalItems`. `getNextVolumeTier()` indica cuántos faltan para el siguiente nivel. |
| **Métodos/actions** | `addItem(product, variantId, color, size, fit, quantity)` — agrega o incrementa cantidad si ya existe la misma variante/color/talla. `removeItem(itemId)` — elimina item. `updateQuantity(itemId, quantity)` — actualiza cantidad (si ≤ 0, elimina). `clearCart()` — vacía el carrito. |
| **Hook expuesto** | `useCart()` — lanza error si se usa fuera de `CartProvider`. |
| **Montaje** | En `src/app/layout.tsx`, envuelve a `AppShell`. |

**Estructura de un `CartItem`:**
```ts
{
  id: string;           // generado con Date.now() + random
  productId: string;
  variantId: string;
  name: string;
  brand: string;
  slug: string;
  color: ProductColor;
  size: Size;
  fit?: Fit;
  sku: string;
  price: number;        // priceSale || priceNormal
  quantity: number;
  image: string;        // primera imagen de la variante
}
```

#### B. `src/context/NotificationContext.tsx` — Sistema de Notificaciones/Toasts

| Aspecto | Detalle |
|---------|---------|
| **Estados globales** | `toasts: ToastItem[]` — array de toasts activos. |
| **Persistencia** | ❌ No persiste en localStorage. Estado puramente en memoria. |
| **Estructura ToastItem** | `{ id, message, type: ToastType, duration, isVisible }` |
| **Tipos de toast** | `'success'`, `'error'`, `'warning'`, `'info'` |
| **Métodos/actions** | `showSuccess(message, duration?)` → retorna `id` del toast. `showError(message, duration?)`. `showWarning(message, duration?)`. `showInfo(message, duration?)`. También hay `addToast()` y `removeToast()` internos. |
| **Duración default** | 3000ms (configurable por toast). |
| **Renderizado** | Los toasts se renderizan **al final del provider** (fuera de `{children}`), lo que garantiza que floten sobre todo el contenido. Usa el componente `<Toast />` de `@/components/ui/Toast`. |
| **Hook expuesto** | `useNotificationContext()` — lanza error si se usa fuera de `NotificationProvider`. |
| **Montaje** | En `src/app/layout.tsx`, es el **provider más externo**, envuelve a `CartProvider`. |

---

### 1.4 Arquitectura de Componentes Clave

#### `AppShell` (`src/components/layout/AppShell.tsx`)
- Client Component que orquesta el layout global.
- Mantiene estado `isCartOpen` para el `CartDrawer`.
- Renderiza: `<Header onCartClick={...} />` + `<CartDrawer />` + `{children}`.

#### `Header` (`src/components/layout/Header.tsx`)
- Client Component. Usa `useCart()` para mostrar badge de items.
- Features: scroll detection (cambia estilo), búsqueda debounced (200ms), mobile menu drawer, mega menu toggle.
- Navegación: Inicio, Catálogo, Marcas, Tiendas + botón "Explorar" que abre `MegaMenu`.
- Búsqueda: filtra en `products` (si disponible) o usa `defaultSearchProducts` de dummy-data.

#### `CartDrawer` (`src/components/cart/CartDrawer.tsx`)
- Client Component. Usa `useCart()`.
- Drawer lateral derecho con overlay. Muestra items, subtotal, descuentos por volumen, y CTA "Enviar por WhatsApp".
- **Checkout flow**: abre modal que pide nombre, ciudad, teléfono → llama `registerLead()` (API) → genera mensaje WhatsApp → `openWhatsApp()` → limpia carrito.

---

### 1.5 Dependencias entre Capas

```
layout.tsx (Server)
  ├── NotificationProvider (Context)
  ├── CartProvider (Context + localStorage)
  └── AppShell (Client)
        ├── Header (useCart, búsqueda, navegación)
        ├── CartDrawer (useCart, checkout WhatsApp)
        └── {children} (páginas específicas)
              ├── page.tsx (Home) → Home.tsx (legacy) → ProductCard, BrandCarousel, FilterableProductSection
              ├── catalogo/page.tsx → CatalogoContent.tsx → ProductCard, FilterSidebar, LayoutSwitcher
              ├── p/[slug]/page.tsx → Product.tsx (legacy) → ImageGallery, VariantSelector, PriceDisplay, etc.
              ├── marcas/page.tsx → (inline)
              └── sucursales/page.tsx → Stores.tsx (legacy)
```

---

## 2. Inventario de APIs y Datos

### 2.1 Endpoints en `src/app/api/`

#### `POST /api/leads` + `GET /api/leads`

| Aspecto | Detalle |
|---------|---------|
| **Métodos** | `POST`, `GET` |
| **Body (POST)** | Validado con Zod (`CreateLeadSchema`):<br>- `customerName`: `string` (mín. 2 chars)<br>- `customerCity`: `string` (mín. 2 chars)<br>- `customerPhone`: `string` (opcional)<br>- `items`: array de `{ name: string, quantity: number, price: number }`<br>- `totalItems`: `number` (positivo, entero)<br>- `subtotal`: `number` (positivo) |
| **Respuesta POST** | `{ success: true, leadId: string, message: "Lead created successfully" }` (201) |
| **Lógica POST** | Valida el body, crea un registro en `prisma.lead` (status=`SENT`), crea un `WhatsAppClick` (sin `productId`), y devuelve el `leadId`. |
| **Respuesta GET** | `{ leads: Lead[] }` (200) |
| **Lógica GET** | Devuelve los últimos 100 leads ordenados por `createdAt` desc. **⚠️ TODO: falta auth check.** |

#### `GET /api/products`

| Aspecto | Detalle |
|---------|---------|
| **Métodos** | `GET` |
| **Query params** | `page` (default: 1), `limit` (default: 12), `search` (opcional, busca en `name` y `description`), `category` (opcional), `brand` (opcional, filtra por `brand.slug`) |
| **Respuesta** | `{ products: Product[], pagination: { page, limit, total, pages } }` |
| **Lógica** | Construye un `where` dinámico con `isActive: true`, aplica filtros opcionales, hace `findMany` con `include: { brand, collection, variants: { include: { color } }, images }`, paginación (`skip`/`take`), y devuelve total count. |

#### `GET /api/search`

| Aspecto | Detalle |
|---------|---------|
| **Métodos** | `GET` |
| **Query params** | `q`: `string` (mín. 2 caracteres, requerido) |
| **Respuesta** | `{ query: string, results: Product[], count: number }` |
| **Lógica** | Busca productos activos donde `name`, `description`, `category` o `sku` contengan el query. Incluye `brand` y la primera imagen (`images: { take: 1 }`). **Registra la búsqueda en `prisma.searchLog`** (query + número de resultados). Máximo 20 resultados. |

---

### 2.2 Funciones Maestras de `src/lib/data-service.ts`

| Función | Parámetros | Retorno | Modelos Prisma | Descripción |
|---|---|---|---|---|
| `getAllProducts` | — | `Product[]` | `product.findMany` (where: `isActive: true`, include: `brand`, `variants`→`color`, `images`) | Todos los productos activos, ordenados por `createdAt` desc. |
| `getProductBySlug` | `slug: string` | `Product \| undefined` | `product.findUnique` (include idem) | Producto por slug. |
| `getFeaturedProducts` | — | `Product[]` | `product.findMany` (where: `isActive: true, isBestSeller: true`, take: 8) | Productos destacados (máx. 8). |
| `getProductsByBrand` | `brandSlug: string` | `Product[]` | `product.findMany` (where: `brand.slug`) | Productos de una marca. |
| `searchProductsDb` | `query: string` | `Product[]` | `product.findMany` (OR: `name`, `description`, `category`, `brand.name` contains query, take: 20) | Búsqueda en DB (no loguea analytics). |
| `getBrands` | — | `{ name, slug, description, logoUrl, productCount }[]` | `brand.findMany` (where: `isActive: true`, include: `_count.products`) | Lista marcas activas con conteo de productos. |
| `getBrandNames` | — | `string[]` | `brand.findMany` (select: `name`) | Solo nombres de marcas. |
| `getColors` | — | `ProductColor[]` | `color.findMany` | Todos los colores. |
| `getStores` | — | `Store[]` | `store.findMany` (where: `isActive: true`) | Tiendas activas. |
| `getHeroSlides` | — | `{ id, image, title, subtitle?, cta, ctaLink }[]` | `banner.findMany` (where: `isActive: true`) | Banners para el hero slider. |
| `filterProducts` | `filters: { gender?, categories?, brands?, colors?, sizes?, fits?, priceMin?, priceMax? }` | `Product[]` | `product.findMany` (where dinámico por género, categoría, marca, rango de precio) | Filtra productos. Género mapea a enum DB y permite `UNISEX`. Colores, tallas y fits se filtran en cliente (post-query). |

**Función interna clave:** `transformProduct` — convierte un producto crudo de Prisma al tipo `Product` del frontend, agrupando colores únicos, imágenes por color, tallas, fits y mapeando `gender` de enum DB a string.

---

### 2.3 Tipos Principales (`src/lib/types.ts`)

| Tipo / Interface | Valores / Campos principales |
|---|---|
| `Size` | `'XXS' \| 'XS' \| 'S' \| 'M' \| 'L' \| 'XL' \| 'XXL' \| '2XL' \| '3XL' \| '4XL' \| '5XL' \| 'OS'` |
| `Fit` | `'Petite' \| 'Regular' \| 'Tall' \| 'Short'` |
| `Gender` | `'Mujer' \| 'Hombre' \| 'Unisex'` |
| `VariantStatus` | `'AVAILABLE' \| 'BACKORDER' \| 'OUT_OF_STOCK'` |
| `Category` | `'Camisas' \| 'Pantalones' \| 'Chaquetas' \| 'Conjuntos' \| 'Accesorios' \| 'Batas'` |
| `ProductColor` | `id, name, code, hex` |
| `ProductVariant` | `id, sku, colorId, size, fit?, images[], status` |
| `VolumeDiscount` | `quantity, minQty, discount, discountPct, label, itemsNeeded?` |
| `Product` | `id, slug, name, brand, category, gender, description, features[], careInstructions[], priceNormal, priceSale?, discountPct?, discountEnd?, colors[], availableSizes[], availableFits?, variants[], isNew, isBestSeller, complementaryProduct?, volumeDiscounts?` |
| `CartItem` | `id, productId, variantId, name, brand, slug, color, size, fit?, sku, price, quantity, image` |
| `CatalogFilters` | `gender, categories, category?, brands, brand?, colors, color?, sizes, size?, fits, fit?, collection?, collections?, style?, styles?, priceMin, priceMax` |
| `Store` | `id, name, address, phone, hours, isMain, mapUrl?` |

---

## 3. Gestión de Activos y Media (Media Library / Cloudflare R2)

> Reemplaza por completo el almacenamiento anterior en `public/images/` (ver historial de git para la versión previa de esta sección). Migración ejecutada vía `scripts/migrate-media-to-r2.ts`.

### 3.1 Arquitectura

Todas las imágenes (productos, sets corporativos, marcas, banners, activos de sitio) viven en **Cloudflare R2** (`media.allmedicuniforms.com`) y se referencian desde Postgres a través de dos tablas normalizadas (`src/db/schema/media.ts`), fuente única de verdad — **ya no existen** columnas de texto tipo `url`/`logoUrl`/`imageDesktop`/`imageUrl` en las tablas de dominio:

```ts
// media_assets — el archivo físico + SEO base
media_assets: id, storage_key (único), file_name, folder (PRODUCTS|SETS|BRANDS|BANNERS|SITE),
  mime_type, size_bytes, width, height, checksum_sha256, alt_text, title, caption, created_by, created_at, updated_at

// media_links — vínculo polimórfico entidad↔asset, con SEO contextual y rol
media_links: id, asset_id (FK RESTRICT), entity_type (PRODUCT|SET|BRAND|BANNER), entity_id,
  color_id (solo PRODUCT, para galería por color), role (GALLERY|LOGO|DESKTOP|MOBILE|COVER),
  sort_order, alt_override, title_override, caption_override
  UNIQUE(entity_type, entity_id, color_id, role, asset_id)

// además: media_tags, media_asset_tags, media_comments, media_audit
```

**Regla de resolución de URL:** `resolveMediaUrl(storageKey)` en `src/lib/media.ts` arma `${R2_PUBLIC_URL}/${storageKey}`.
**Regla de resolución de SEO:** `link.alt_override ?? asset.alt_text` (ídem título/caption) — el override contextual del vínculo gana sobre el valor base del asset.

| Entidad | Rol(es) usados | Ejemplo de lectura |
|---|---|---|
| Producto (por color) | `GALLERY` | `data-service.ts` → join `media_links`+`media_assets` filtrando `entityType=PRODUCT, role=GALLERY` |
| Set corporativo | `COVER` | `corporate-data-service.ts::getCoverImageMap()` |
| Marca | `LOGO` | `data-service.ts::getBrands()` |
| Banner | `DESKTOP`, `MOBILE` | `data-service.ts::getHeroSlides()` |

### 3.2 Subida y transformación de imágenes

- **Subida:** URLs prefirmadas (`presignPut` en `src/lib/r2.ts`, SDK `@aws-sdk/client-s3`) — el navegador sube directo a R2 vía `useMediaUpload` (`src/hooks/useMediaUpload.ts`), sin pasar el binario por el servidor Next.
- **Normalización cliente:** `src/lib/client-image-utils.ts` redimensiona a máx. 2400px y comprime antes de subir; calcula checksum SHA-256 (idempotencia).
- **Optimización de entrega:** Cloudflare Image Transformations vía loader custom de `next/image` (`src/lib/cloudflare-image-loader.ts`, registrado en `next.config.ts` como `images.loader: 'custom'`). Genera URLs `/cdn-cgi/image/width=...,quality=...,format=auto/...`. **`images.unoptimized` ya NO se usa** — el optimizador nativo de Next está reemplazado por este loader.
- **Panel admin:** `/admin/biblioteca` (Biblioteca) — galería con filtros, subida drag&drop, detalle con SEO/renombrado/comentarios/auditoría/eliminación (bloqueada si el medio está en uso). Componente `<MediaPicker>` (`src/components/admin/media/MediaPicker.tsx`) es la única puerta de entrada de imágenes en los formularios de productos, sets, marcas y banners — ya no hay inputs de texto para URLs.
- **API:** `/api/admin/media/*` (`presign`, `confirm`, listado, detalle/edición/borrado, comentarios, `links`, `tags`), todas protegidas por `requireAdmin()`.

### 3.3 Logos del sitio (excepción)

`allmedic_logo_black.png` y `allmedic_logo_white.png` son los **únicos** archivos que permanecen en `public/images/` (usados directo por `Header`/`Footer` vía `<img>`, sin pasar por R2 ni next/image) — excluidos deliberadamente de la migración.

---

## 4. Dashboard y Lógica de Negocio

### 4.1 Dashboard Administrativo

| Aspecto | Estado |
|---------|--------|
| **¿Existe dashboard?** | ❌ **No existe.** No hay páginas, rutas ni componentes dedicados a administración en `src/app/` ni `src/components/`. |
| **Única referencia a "admin"** | En `src/app/api/leads/route.ts` existe un endpoint `GET /api/leads` marcado con `// TODO: Add auth check here`, pero **no tiene autenticación implementada**. |
| **Componentes shadcn/ui para visualización** | El proyecto tiene instalados **muchos componentes shadcn/ui** (`table`, `card`, `chart`, `badge`, `dialog`, `drawer`, `tabs`), pero **ninguno se usa para un dashboard de admin**. Se usan activamente en el catálogo y producto (ej: `Badge` en `PriceDisplay`, `table` en `VolumeDiscountTable`). |
| **Autenticación** | ❌ **No implementada.** El modelo `User` existe en Prisma con roles `SUPER_ADMIN` y `CATALOG_MANAGER`, pero no hay `middleware.ts`, páginas de login, ni rutas protegidas. |

---

### 4.2 Flujo de Leads

#### ¿Cómo se Crean?
Los leads se generan desde el **carrito de compras (`CartDrawer`)** cuando el usuario hace clic en "Enviar por WhatsApp":

1. Usuario agrega productos al carrito → selecciona color, talla, fit, cantidad.
2. Abre el carrito → clic en "Enviar por WhatsApp".
3. Modal de checkout → ingresa nombre, ciudad y número de WhatsApp.
4. Al confirmar → se ejecuta `handleCheckout()` en `CartDrawer.tsx`.

#### Datos Guardados (Modelo `Lead` en Prisma)

```prisma
model Lead {
  id            String     @id @default(cuid())
  customerName  String
  customerCity  String
  customerPhone String?
  items         Json       // CartItem[]
  totalItems    Int
  subtotal      Decimal    @db.Decimal(10, 2)
  status        LeadStatus @default(SENT)
  createdAt     DateTime   @default(now())
}

enum LeadStatus {
  SENT
  CONTACTED
  CONVERTED
  CANCELLED
}
```

#### Registro del Lead (`src/lib/whatsapp.ts`)

```typescript
export async function registerLead(data: WhatsAppMessageData): Promise<void> {
  console.log('Registering lead:', data);
  return new Promise(resolve => setTimeout(resolve, 500));
}
```

> **⚠️ Observación:** La función `registerLead()` actualmente **solo simula el registro** (`console.log` + `setTimeout`). **No hace llamada real a la API `/api/leads`**. Esto representa una deuda técnica crítica: la API POST existe y funciona, pero el cliente no la consume.

#### API `/api/leads`
- **POST**: Valida con Zod y crea el lead en Prisma + registra un `WhatsAppClick`.
- **GET**: Lista los últimos 100 leads (sin autenticación).

#### Generación del Mensaje de WhatsApp

```typescript
// src/lib/whatsapp.ts
function generateWhatsAppMessage(data): string
```

Genera un mensaje formateado con:
- Lista de productos (nombre, SKU, color, talla, cantidad)
- Datos del cliente (nombre, ciudad, teléfono)
- Se abre en `https://wa.me/13164695701?text=...`

**Número de WhatsApp destino:** Hardcodeado en `src/lib/whatsapp.ts` como `13164695701`.

---

### 4.3 Descuentos por Volumen en el Carrito

#### ¿Dónde está Implementada la Lógica?
**Centralizada en `src/context/CartContext.tsx`**.

#### Umbrales y Porcentajes (Hardcoded)

```typescript
const VOLUME_DISCOUNTS: VolumeDiscount[] = [
  { quantity: 3, minQty: 3,  discount: 10, discountPct: 10, label: '3+ unidades' },
  { quantity: 5, minQty: 5,  discount: 15, discountPct: 15, label: '5+ unidades' },
  { quantity: 10, minQty: 10, discount: 20, discountPct: 20, label: '10+ unidades' },
];
```

| Umbral (items totales) | Descuento |
|------------------------|-----------|
| 3+                     | 10%       |
| 5+                     | 15%       |
| 10+                    | 20%       |

#### Cálculo
- **`getActiveVolumeDiscount()`**: Encuentra el mayor descuento cuyo `minQty` sea <= `totalItems` del carrito.
- **`getNextVolumeTier()`**: Encuentra el siguiente tier al que el usuario puede llegar.
- El descuento se aplica sobre el **subtotal** del carrito:
  ```typescript
  const discountAmount = activeDiscount ? subtotal * (activeDiscount.discountPct / 100) : 0;
  const finalTotal = subtotal - discountAmount;
  ```

#### Visualización al Usuario (en `CartDrawer.tsx`)
1. **Si hay descuento activo**: Muestra banner verde "Descuento X% aplicado".
2. **Si hay siguiente tier**: Muestra banner naranja "Agrega N más y ahorra X%".
3. **En el footer del carrito**: Muestra subtotal, monto de descuento, y total estimado.

#### Tabla de Descuentos por Producto
En la página de producto (`src/components/product/VolumeDiscountTable.tsx`) se muestra una tabla con los precios unitarios por tier, pero estos descuentos vienen del campo `product.volumeDiscounts` (que en `data-service.ts` **no se está poblando desde la base de datos** — los productos de Prisma no tienen esta relación).

---

### 4.4 Flujo de Checkout / Pago

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. Agregar al  │────▶│  2. Abrir       │────▶│  3. Completar   │
│     carrito     │     │    carrito      │     │    datos        │
│  (producto +    │     │  (revisar items │     │  (nombre,       │
│   variantes)    │     │   y descuentos) │     │   ciudad, tel)  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                              ┌──────────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │ 4. Generar      │
                    │    mensaje      │
                    │    WhatsApp     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌─────────┐   ┌─────────┐   ┌─────────┐
        │Registrar│   │ Abrir   │   │ Limpiar │
        │lead en  │   │WhatsApp │   │ carrito │
        │ Prisma  │   │ (wa.me) │   │         │
        └─────────┘   └─────────┘   └─────────┘
```

**No hay pagos online.** El flujo completo termina en la apertura de WhatsApp con un mensaje preformateado.

---

## 5. Puntos de Inyección para IA

### 5.1 Layout y Estructura HTML

#### Metadata Actual (`src/app/layout.tsx`)
- **Estado:** Muy básico. Solo exporta:
  - `title: 'Allmedic Frontstore'`
  - `description: 'Catálogo de productos médicos Allmedic'`
  - `icons: '/favicon.ico'`
- **Faltante crítico:** No hay OpenGraph, Twitter Cards, JSON-LD, schema.org, ni canonical URLs.
- **Estructura `<head>`:** Next.js 16 maneja el `<head>` automáticamente, pero no hay inyección de datos estructurados en ninguna parte del proyecto.

#### Componentes SEO Reutilizables
- **No existen.** No hay carpeta `src/components/seo/` ni componentes como `<SEO />`, `<ProductSchema />`, `<BreadcrumbSchema />`, etc.
- El único componente relacionado es `src/components/ui/breadcrumb.tsx`, pero es puramente visual (UI), no genera datos estructurados.

#### 🔧 Recomendaciones de Inyección IA-SEO

| Archivo | Acción | Prioridad |
|---|---|---|
| `src/app/layout.tsx` | Agregar `openGraph`, `twitter`, `metadataBase`, `robots` | 🔴 Alta |
| Crear `src/components/seo/StructuredData.tsx` | Componente reutilizable para inyectar `<script type="application/ld+json">` | 🔴 Alta |
| Crear `src/components/seo/ProductSchema.tsx` | Generar `Product` schema.org con ofertas, disponibilidad, ratings | 🔴 Alta |
| Crear `src/components/seo/BreadcrumbSchema.tsx` | Generar `BreadcrumbList` schema.org | 🟡 Media |
| Crear `src/components/seo/OrganizationSchema.tsx` | Generar `Organization` / `LocalBusiness` para Allmedic | 🟡 Media |

---

### 5.2 Búsqueda

#### Implementación Actual

**Header Search (`src/components/layout/Header.tsx`):**
- Búsqueda **client-side** con debounce de 200ms.
- Filtra el array `products` (pasado desde layout) usando `.filter()` con `.includes()` en `name`, `brand`, `category`, `colors[].name`.
- Muestra máximo 6 resultados en dropdown.
- Al hacer submit, redirige a `/catalogo?q={query}`.

**API Search (`src/app/api/search/route.ts`):**
- Endpoint `GET /api/search?q=query`
- Usa Prisma con `contains` (LIKE) en `name`, `description`, `category`, `sku`.
- Incluye `brand` e `images`.
- Limita a 20 resultados.
- **Loguea búsquedas** en tabla `SearchLog` (analítica básica).

**Catálogo Search (`src/app/catalogo/CatalogoContent.tsx`):**
- Aplica filtros client-side sobre `initialProducts`.
- Dos niveles de búsqueda:
  1. `searchQuery` (desde URL `?q=...`) → filtra por name, brand, category, colors.
  2. `gridSearchQuery` (input local) → filtra por name, brand, category, description, colors, sizes, SKU.

#### Tipo de Búsqueda
- **100% full-text básico (LIKE/contains).** No hay búsqueda semántica, vectorial, ni embeddings.
- Prisma tiene `previewFeatures = ["fullTextIndex"]` en el schema, pero no se usa en las queries actuales.

#### 🔧 Recomendaciones de Inyección Búsqueda Semántica

| Ubicación | Acción | Detalle |
|---|---|---|
| **Crear `src/app/api/search/semantic/route.ts`** | Nuevo endpoint | Recibe query, genera embedding (OpenAI/Coherent), hace cosine similarity sobre tabla `ProductEmbedding`. |
| **Prisma Schema** | Agregar modelo `ProductEmbedding` | `id, productId, embedding (vector), updatedAt` |
| **`src/components/layout/Header.tsx`** | Modificar efecto de búsqueda | Llamar a `/api/search/semantic` cuando query > 2 chars; fallback a búsqueda actual si no hay resultados semánticos. |
| **`src/app/catalogo/CatalogoContent.tsx`** | Agregar toggle "Búsqueda inteligente" | Permitir al usuario alternar entre búsqueda literal y semántica. |
| **`src/lib/data-service.ts`** | Agregar `searchProductsSemantic()` | Función server-side para SSR de resultados semánticos. |

**Flujo ideal de búsqueda semántica:**
```
Usuario escribe "ropa cómoda para hospitales"
  → Header llama /api/search/semantic?q=...
  → Backend genera embedding de la query
  → Hace cosine similarity con embeddings de productos
  → Retorna productos relacionados semánticamente (scrubs, batas, etc.)
  → Inyecta resultados en el dropdown + redirige a catálogo
```

---

### 5.3 Páginas de Producto (`p/[slug]/page.tsx`)

#### Generación Actual
- **Archivo:** `src/app/p/[slug]/page.tsx`
- **Tipo:** SSR (Server Component async)
- **Data fetching:** `getProductBySlug(slug)` → Prisma → transformProduct
- **No exporta `generateMetadata`**. Cada producto comparte el mismo título/description genérico del layout.
- **No hay JSON-LD / schema.org** en la página.

#### Componente Visual
- `src/legacy-pages/Product.tsx` es un Client Component que renderiza:
  - Breadcrumb (visual, no estructurado)
  - Galería de imágenes
  - Selector de variantes (color, talla, fit)
  - Precio, descuentos, countdown
  - Cross-sell (producto complementario basado en `crossSellId`)
  - Acordeones: Descripción, Características, Guía de tallas, Cuidados

#### 🔧 Recomendaciones de Inyección IA-SEO en Producto

| Archivo | Acción | Código sugerido |
|---|---|---|
| `src/app/p/[slug]/page.tsx` | Exportar `generateMetadata` dinámico | `title: ${product.name} \| ${product.brand}`, `description: product.description.slice(0,160)`, `openGraph.images: product.images` |
| `src/app/p/[slug]/page.tsx` | Inyectar `<StructuredData>` | Pasar `product` a componente que genere schema.org `Product` + `Offer` + `AggregateRating` |
| `src/legacy-pages/Product.tsx` | Agregar FAQ schema | Las preguntas en acordeones (Descripción, Características, Cuidados) pueden exponerse como `FAQPage` schema |
| **Nuevo campo en DB** | `aiDescription` o `semanticTags` | Campo generado por IA para enriquecer descripción con términos de búsqueda semántica |

**Schema.org Product recomendado:**
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "FIGS Casma Three-Pocket Scrub Top",
  "brand": { "@type": "Brand", "name": "FIGS" },
  "description": "...",
  "image": ["..."],
  "offers": {
    "@type": "Offer",
    "price": "38.00",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  }
}
```

---

### 5.4 Catálogo (`/catalogo`)

#### Funcionamiento Actual
- **Page:** `src/app/catalogo/page.tsx` (Server Component)
- **Content:** `src/app/catalogo/CatalogoContent.tsx` (Client Component con Suspense)
- **Data:** `getAllProducts()` trae TODO el catálogo a la página, luego filtra client-side
- **Filtros disponibles:** Género, Categorías, Marcas, Colores, Tallas, Fits, Rango de precio ($0-$200)
- **Ordenamiento:** Relevancia, Precio ↑↓, Más recientes
- **Paginación:** Client-side con 12-20 items por página

#### 🔧 Recomendaciones por IA

| Ubicación | Acción | Detalle |
|---|---|---|
| **`src/app/catalogo/page.tsx`** | Agregar `generateMetadata` dinámica | Según filtros activos: "Scrubs para mujer \| Allmedic", "FIGS \| Allmedic" |
| **`src/app/catalogo/CatalogoContent.tsx`** | Sección "Recomendados para ti" | Usar embeddings del historial de búsqueda (`SearchLog`) + productos vistos |
| **`src/components/catalog/ProductCard.tsx`** | Agregar "Productos similares" tooltip | Quick preview con recomendaciones semánticas basadas en embedding del producto |
| **Nuevo componente** | `AIRecommendations` | Sección debajo de filtros que muestre: "También te puede interesar..." basado en cosine similarity |

**Flujo de recomendaciones por IA:**
```
1. Usuario visita /catalogo?gender=Mujer&category=Camisas
2. Backend calcula embedding del contexto (filtros + query)
3. Encuentra productos con embeddings más cercanos
4. Inyecta "Recomendaciones IA" como primera fila del grid
   (con badge "Para ti" o "Descubre")
```

---

### 5.5 Priorización de Implementación para IA

| Prioridad | Tarea | Justificación |
|---|---|---|
| 🔴 **Alta** | Crear componentes SEO (`StructuredData`, `ProductSchema`) + `generateMetadata` en `p/[slug]/page.tsx` | Impacto inmediato en indexación por motores de búsqueda e IA (ChatGPT, Perplexity, etc.) |
| 🔴 **Alta** | Crear endpoint `/api/search/semantic` + tabla `ProductEmbedding` | Habilita búsqueda por intención, no solo por keywords |
| 🟡 **Media** | Integrar búsqueda semántica en Header dropdown | Mejora UX de descubrimiento de productos |
| 🟡 **Media** | Agregar recomendaciones IA en catálogo | Aumenta conversión y ticket promedio |
| 🟢 **Baja** | FAQ schema, Organization schema, breadcrumb structured data | Buenas prácticas SEO, menor impacto directo en conversión |

---

### 5.6 Stack Tecnológico Recomendado para IA

| Capa | Tecnología | Justificación |
|---|---|---|
| **Embeddings** | OpenAI `text-embedding-3-small` o `text-embedding-3-large` | Costo-efectivo, 1536 dims |
| **Vector DB** | Prisma + MySQL (con extensión vector) o Pinecone/Weaviate | Si MySQL no soporta vectors, usar tabla con JSON + cosine similarity en app layer |
| **Cosine Similarity** | Implementar en TypeScript o usar `pgvector` si migran a Postgres | Función simple: `dot(a,b) / (norm(a)*norm(b))` |
| **Metadata dinámica** | Next.js `generateMetadata` | Nativo, SSR-friendly |
| **Schema.org** | Componentes React con `<script type="application/ld+json">` | Fácil de mantener, testeable |

---

## 6. Apéndices

### Apéndice A: Hallazgos Clave y Deuda Técnica

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Dashboard admin | ❌ No existe | Modelo `User` y roles existen pero sin uso |
| Autenticación | ❌ No implementada | No hay `middleware.ts`, login, ni rutas protegidas |
| Registro real de leads | ⚠️ Parcial | API POST existe, pero `registerLead()` en cliente no la llama |
| Descuentos por volumen | ✅ Funcional | Hardcoded: 3/5/10 items = 10/15/20% |
| Checkout/pago | ✅ Solo WhatsApp | Sin pasarela de pago online |
| Base de datos | ✅ Prisma + MySQL | Modelos completos, 12 tablas |
| Productos desde DB | ✅ Migrado | `data-service.ts` es la fuente de verdad |
| Imágenes | ✅ Cloudflare R2 + Media Library | Ver sección 3; `next/image` con loader custom de Cloudflare Images |
| SEO / Metadata | ❌ Muy básico | Sin OpenGraph, schema.org, ni JSON-LD |
| Búsqueda | ⚠️ Básica | Solo LIKE/contains; sin full-text ni semántica |
| Dummy data | ⚠️ Residual | `dummy-data.ts` aún se referencia en algunos fallbacks |
| `dist/` folder | ⚠️ Residual | Artefacto de build Vite, puede eliminarse |

### Apéndice B: Modelos Prisma Utilizados

| Modelo | Usado en |
|---|---|
| `Product` | `data-service.ts` (todas las funciones de producto), `products/route.ts`, `search/route.ts` |
| `Brand` | `data-service.ts`, `products/route.ts`, `search/route.ts` |
| `ProductVariant` | `data-service.ts`, `products/route.ts` |
| `Color` | `data-service.ts`, `products/route.ts` |
| `ProductImage` | `data-service.ts`, `products/route.ts`, `search/route.ts` |
| `Store` | `data-service.ts` |
| `Banner` | `data-service.ts` |
| `Lead` | `leads/route.ts` |
| `WhatsAppClick` | `leads/route.ts` |
| `SearchLog` | `search/route.ts` |
| `Collection` | `products/route.ts` (include) |
| `User` | Schema definido pero **sin uso en código** |

### Apéndice C: Archivos Clave para Referencia Rápida

| Archivo | Propósito |
|---------|-----------|
| `src/lib/types.ts` | Frontend type definitions (`Product`, `CartItem`, `Store`, etc.) |
| `src/lib/data-service.ts` | All data-fetching functions (fuente de verdad) |
| `src/lib/utils.ts` | `cn()` helper for Tailwind class merging |
| `src/lib/whatsapp.ts` | WhatsApp message generation and lead registration |
| `prisma/schema.prisma` | Database schema (12 models) |
| `prisma/seed.ts` | Demo data seed script |
| `.claude/MIGRATION_SUMMARY.md` | Full Vite to Next.js migration report |
| `.claude/TECHNICAL_AUDIT.md` | Production readiness audit |

---

> **Fin del documento.** Este `PROJECT_MAP.md` debe mantenerse actualizado cada vez que se realicen cambios arquitectónicos significativos en la aplicación.

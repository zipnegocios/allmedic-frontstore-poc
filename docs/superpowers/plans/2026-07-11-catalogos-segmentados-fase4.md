# Catálogos Segmentados — Correcciones y Fase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los pendientes reales encontrados en la auditoría de `.claude/pre-plans/PLAN-catalogos-segmentados.md` (deuda documental + Fase 4 completa: gestión interna de cotizaciones, panel del motor de reglas, migración de descuentos, carritos abandonados).

**Architecture:** Extiende el sistema ya construido (Drizzle/Postgres, `rules-engine/` puro, `admin-data-service.ts`, patrón de presigned uploads a R2 ya usado por Media Library) sin romper Fases 1–3, que están verificadas y funcionando.

**Tech Stack:** Next.js App Router (Server Components + API routes), Drizzle ORM/PostgreSQL, react-hook-form + zod, shadcn/ui, Resend (email), Cloudflare R2 (`@aws-sdk/client-s3` presigned URLs), Vitest.

## Global Constraints

- Todo copy de usuario/UI en español (Ecuador).
- Regla de oro del proyecto: toda validación de negocio y cálculo de precios corporativos se re-ejecuta en servidor; el cliente solo previsualiza.
- No romper el flujo individual (`/catalogo`, `CartContext`) ni las Fases 1–3 ya verificadas.
- Cada tarea deja el sistema compilando (`npm run build`) y con `npm run lint` limpio.
- Snapshots inmutables: cambios en catálogo/reglas no alteran cotizaciones ya enviadas.
- Reutilizar patrones existentes: `src/lib/admin-data-service.ts` para queries admin, `src/lib/r2.ts` (`presignPut`) para subir archivos, `src/lib/email/` (`sendEmail` + `src/lib/email/templates.ts`) para correo, `src/lib/rules-engine/` (módulo puro, sin DB) para cualquier lógica de reglas.

---

### Task 1: Limpiar referencias residuales a Prisma/MySQL en AGENTS.md

**Files:**
- Modify: `AGENTS.md:138,155,158,302,313,325-326`

**Interfaces:** N/A (solo documentación).

- [ ] **Step 1: Corregir la tabla de variables de entorno**

En `AGENTS.md:138`, reemplazar:
```
| `DATABASE_URL` | Yes | MySQL connection string for Prisma |
```
por:
```
| `DATABASE_URL` | Yes | PostgreSQL connection string for Drizzle |
```

- [ ] **Step 2: Corregir la sección "Data Fetching"**

En `AGENTS.md:155` y `:158`, reemplazar:
```
- Transforms Prisma DB results into frontend `Product` types.
...
**Do not import `@prisma/client` directly in pages** — always use `data-service.ts` or `prisma.ts`.
```
por:
```
- Transforms Drizzle DB results into frontend `Product` types.
...
**Do not import the Drizzle `db` client directly in pages** — always use `data-service.ts` (or `admin-data-service.ts` for admin queries).
```

- [ ] **Step 3: Corregir la mención de seguridad en línea 302**

Buscar `AGENTS.md:302` ("Prisma queries are parameterized — no raw SQL injection risk.") y reemplazar por:
```
Drizzle queries are parameterized — no raw SQL injection risk (avoid `sql.raw` with untrusted input).
```

- [ ] **Step 4: Corregir la nota desactualizada de evolución del schema (línea 313)**

Reemplazar el párrafo que dice que `corporate.ts` y `business_rules` "se agregarán en Fase 1" por una nota de estado real:
```
`corporate.ts` (set_groups, corporate_sets, set_items, business_rules, corporate_accounts,
corporate_carts, quote_requests, quote_status_history, quote_attachments) ya está implementado
y exportado desde `src/db/schema/index.ts`. Ver `.claude/pre-plans/PLAN-catalogos-segmentados.md`
para el diseño original del motor de reglas.
```

- [ ] **Step 5: Eliminar referencias a `prisma/schema.prisma` y `prisma/seed.ts`**

En `AGENTS.md:325-326`, esos paths no existen en el repo. Reemplazar por los reales:
```
- Schema Drizzle: `src/db/schema/*.ts` (uno por dominio: products.ts, auth.ts, commerce.ts, corporate.ts, chats.ts, media.ts, rag.ts)
- Seeds: `src/db/seed.ts` (catálogo base) y `src/db/seed-corporate.ts` (reglas globales + sets corporativos de ejemplo)
```

- [ ] **Step 6: Verificar que no queden más menciones sueltas**

Run: `grep -rniE "prisma|mysql" AGENTS.md`
Expected: sin resultados (0 coincidencias).

- [ ] **Step 7: Commit**

```bash
git add AGENTS.md
git commit -m "docs: eliminar referencias residuales a Prisma/MySQL en AGENTS.md"
```

---

### Task 2: Migrar los descuentos por volumen del catálogo individual al motor de reglas

**Objetivo:** que `VOLUME_DISCOUNT_RETAIL` (ya soportado por el motor, sección 2.2 del plan original) reemplace los valores hardcodeados de `src/context/CartContext.tsx:25-29`, manteniendo el comportamiento actual como seed/fallback.

**Files:**
- Create: `src/db/seed-volume-discount-retail.ts` (o agregar al seed corporativo existente `src/db/seed-corporate.ts`)
- Create: `src/app/api/rules/volume-discount-retail/route.ts` (GET público, sin auth — es información de precios visible)
- Modify: `src/context/CartContext.tsx:1-29`
- Test: `src/lib/rules-engine/__tests__/rules-engine.test.ts` (agregar caso GLOBAL `VOLUME_DISCOUNT_RETAIL`)

**Interfaces:**
- Consumes: `resolveRules(allRules, context, now): ResolvedRules` de `src/lib/rules-engine/resolve.ts` — usa `resolved.volumeDiscountRetail: VolumeDiscountRetailConfig | null` (ya definido en `types.ts:76-78`).
- Produces: `GET /api/rules/volume-discount-retail` → `{ tiers: VolumeDiscountRetailTier[] }`, usado por `CartContext.tsx`.

- [ ] **Step 1: Seed de la regla global por defecto**

En `src/db/seed-corporate.ts`, agregar (junto a las otras reglas globales existentes) una fila `business_rules` que reproduzca exactamente los valores actuales de `CartContext.tsx`:

```ts
{
  name: "Descuento por volumen — catálogo individual (default)",
  ruleType: "VOLUME_DISCOUNT_RETAIL",
  scope: "GLOBAL",
  scopeId: null,
  config: {
    tiers: [
      { minItems: 3, pct: 10 },
      { minItems: 5, pct: 15 },
      { minItems: 10, pct: 20 },
    ],
  },
  isActive: true,
  priority: 0,
}
```

- [ ] **Step 2: API route pública de solo lectura**

Crear `src/app/api/rules/volume-discount-retail/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { businessRules } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveRules } from "@/lib/rules-engine";

export async function GET() {
  const rules = await db
    .select()
    .from(businessRules)
    .where(and(eq(businessRules.ruleType, "VOLUME_DISCOUNT_RETAIL"), eq(businessRules.isActive, true)));

  const resolved = resolveRules(rules as any, {}, new Date());
  const tiers = resolved.volumeDiscountRetail?.tiers ?? [
    { minItems: 3, pct: 10 },
    { minItems: 5, pct: 15 },
    { minItems: 10, pct: 20 },
  ];
  return NextResponse.json({ tiers });
}
```

- [ ] **Step 3: Consumir la regla en `CartContext.tsx` con fallback**

Reemplazar el arreglo `VOLUME_DISCOUNTS` estático (`CartContext.tsx:25-29`) por estado cargado desde la API, con los valores actuales como fallback si el fetch falla (mismo comportamiento visible, cero regresión si la API cae):

```tsx
const DEFAULT_VOLUME_DISCOUNTS: VolumeDiscount[] = [
  { quantity: 3, minQty: 3, discount: 10, discountPct: 10, label: '3+ unidades' },
  { quantity: 5, minQty: 5, discount: 15, discountPct: 15, label: '5+ unidades' },
  { quantity: 10, minQty: 10, discount: 20, discountPct: 20, label: '10+ unidades' },
];

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [volumeDiscounts, setVolumeDiscounts] = useState<VolumeDiscount[]>(DEFAULT_VOLUME_DISCOUNTS);

  useEffect(() => {
    fetch('/api/rules/volume-discount-retail')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.tiers?.length) {
          setVolumeDiscounts(
            data.tiers.map((t: { minItems: number; pct: number }) => ({
              quantity: t.minItems, minQty: t.minItems,
              discount: t.pct, discountPct: t.pct,
              label: `${t.minItems}+ unidades`,
            }))
          );
        }
      })
      .catch(() => {}); // fallback silencioso, ya hay defaults
  }, []);
  // ... resto del provider usa `volumeDiscounts` en vez de `VOLUME_DISCOUNTS`
```

Actualizar `getActiveVolumeDiscount` / `getNextVolumeTier` para leer de `volumeDiscounts` (closure/estado) en vez de la constante del módulo.

- [ ] **Step 4: Test del motor de reglas**

Agregar a `src/lib/rules-engine/__tests__/rules-engine.test.ts`:

```ts
it("resuelve VOLUME_DISCOUNT_RETAIL desde una regla GLOBAL", () => {
  const rules: BusinessRule[] = [{
    id: "1", name: "test", ruleType: "VOLUME_DISCOUNT_RETAIL", scope: "GLOBAL", scopeId: null,
    config: { tiers: [{ minItems: 3, pct: 10 }] }, isActive: true, priority: 0,
  }];
  const resolved = resolveRules(rules, {}, new Date());
  expect(resolved.volumeDiscountRetail?.tiers).toEqual([{ minItems: 3, pct: 10 }]);
});
```

Run: `npx vitest run --no-file-parallelism src/lib/rules-engine`
Expected: todos los tests (los 18 previos + el nuevo) en verde.

- [ ] **Step 5: Verificación manual**

Levantar `npm run dev`, agregar 3 items al carrito individual, confirmar que el 10% de descuento se sigue aplicando igual que antes (mismo resultado visual, ahora servido por la regla).

- [ ] **Step 6: Commit**

```bash
git add src/db/seed-corporate.ts src/app/api/rules/volume-discount-retail/route.ts src/context/CartContext.tsx src/lib/rules-engine/__tests__/rules-engine.test.ts
git commit -m "feat: migrar descuentos por volumen del catálogo individual al motor de reglas"
```

---

### Task 3: Edición de precios reales e historial de estados en cotizaciones (admin)

**Objetivo:** que ventas pueda escribir `quotedItems`/`quotedTotal`, cambiar `status` con historial (`quote_status_history`) y agregar `internalNotes` desde `/admin/quotes/[id]`.

**Files:**
- Modify: `src/lib/admin-data-service.ts` (agregar `updateQuote`, `getQuoteStatusHistory`)
- Create: `src/app/api/admin/quotes/[id]/route.ts` (PATCH)
- Modify: `src/app/admin/(dashboard)/quotes/[id]/page.tsx` (convertir la sección de totales/estado en un client component editable)
- Create: `src/components/admin/QuoteEditPanel.tsx`

**Interfaces:**
- Consumes: `quoteRequests`, `quoteStatusHistory` de `src/db/schema/corporate.ts`; `quote.status` valores `RECEIVED | IN_REVIEW | QUOTED | SENT | APPROVED | REJECTED | CLOSED`.
- Produces: `PATCH /api/admin/quotes/:id` body `{ quotedItems?, quotedTotal?, status?, internalNotes?, note? }` → `{ quote, historyEntry }`, consumido por `QuoteEditPanel`.

- [ ] **Step 1: Data-service — actualizar cotización + registrar historial**

En `src/lib/admin-data-service.ts`, agregar después de `getAdminQuoteById` (línea 796):

```ts
export async function updateQuote(
  id: string,
  changes: {
    quotedItems?: unknown;
    quotedTotal?: string;
    status?: string;
    internalNotes?: string;
  },
  changedBy: string,
  note?: string
) {
  const [current] = await db.select().from(quoteRequestsTable).where(eq(quoteRequestsTable.id, id)).limit(1);
  if (!current) return null;

  const [updated] = await db
    .update(quoteRequestsTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(quoteRequestsTable.id, id))
    .returning();

  let historyEntry = null;
  if (changes.status && changes.status !== current.status) {
    [historyEntry] = await db
      .insert(quoteStatusHistoryTable)
      .values({ quoteId: id, fromStatus: current.status, toStatus: changes.status, changedBy, note })
      .returning();
  }

  return { quote: updated, historyEntry };
}

export async function getQuoteStatusHistory(quoteId: string) {
  return db
    .select()
    .from(quoteStatusHistoryTable)
    .where(eq(quoteStatusHistoryTable.quoteId, quoteId))
    .orderBy(desc(quoteStatusHistoryTable.createdAt));
}
```

(Importar `quoteStatusHistory as quoteStatusHistoryTable` desde `@/db/schema` al inicio del archivo, junto a los imports existentes de `quoteRequests`/`corporateAccounts`.)

- [ ] **Step 2: API route PATCH con auth de admin**

Crear `src/app/api/admin/quotes/[id]/route.ts` siguiendo el mismo patrón de auth que `src/app/api/admin/corporate-accounts/[id]/route.ts` (sesión + rol admin):

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { updateQuote } from "@/lib/admin-data-service";
import { sendEmail, quoteStatusChangedEmail } from "@/lib/email";
import { getAdminQuoteById } from "@/lib/admin-data-service";

const patchSchema = z.object({
  quotedItems: z.unknown().optional(),
  quotedTotal: z.string().optional(),
  status: z.enum(["RECEIVED", "IN_REVIEW", "QUOTED", "SENT", "APPROVED", "REJECTED", "CLOSED"]).optional(),
  internalNotes: z.string().optional(),
  note: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = patchSchema.parse(await req.json());
  const { note, ...changes } = body;

  const result = await updateQuote(id, changes, session.user.id!, note);
  if (!result) return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });

  if (changes.status && result.historyEntry) {
    const quote = await getAdminQuoteById(id);
    const customerData = quote!.customerData as { email: string; contactName: string };
    await sendEmail(quoteStatusChangedEmail(customerData.email, customerData.contactName, quote!.code, changes.status));
  }

  return NextResponse.json(result);
}
```

- [ ] **Step 3: Plantilla de correo de cambio de estado**

En `src/lib/email/templates.ts`, agregar siguiendo el estilo de `accountApprovedEmail`/`accountRejectedEmail` ya existentes:

```ts
const STATUS_MESSAGES: Record<string, string> = {
  IN_REVIEW: "Tu solicitud está siendo revisada por nuestro equipo de ventas.",
  QUOTED: "Ya tenemos una cotización lista para ti. Revisa los detalles en tu portal.",
  SENT: "Te hemos enviado la cotización formal.",
  APPROVED: "¡Tu cotización fue aprobada! Nuestro equipo se pondrá en contacto para coordinar la entrega.",
  REJECTED: "Tu solicitud de cotización no pudo ser procesada. Contáctanos para más detalles.",
  CLOSED: "Tu solicitud ha sido cerrada.",
};

export function quoteStatusChangedEmail(to: string, contactName: string, code: string, newStatus: string) {
  return {
    to,
    subject: `Actualización de tu cotización ${code} — AllMedic Uniforms`,
    html: `<p>Hola ${contactName},</p><p>${STATUS_MESSAGES[newStatus] ?? "El estado de tu solicitud cambió."}</p><p>Código de solicitud: <strong>${code}</strong></p>`,
  };
}
```

- [ ] **Step 4: `QuoteEditPanel.tsx` (client component)**

Crear `src/components/admin/QuoteEditPanel.tsx`: selector de `status` (mismo `STATUS_LABELS` que ya existe en `src/app/admin/(dashboard)/quotes/page.tsx:24-32`, reexportarlo desde un módulo compartido si hace falta), textarea de `internalNotes`, textarea de `note` para el historial, botón "Guardar" que hace `PATCH /api/admin/quotes/${id}`, y debajo un timeline de `quote_status_history` (fetch a un nuevo endpoint `GET /api/admin/quotes/[id]/history` o incluido en la respuesta de `getAdminQuoteById` — extender esa función para traer `history: await getQuoteStatusHistory(id)`).

- [ ] **Step 5: Montar el panel en la página de detalle**

Modificar `src/app/admin/(dashboard)/quotes/[id]/page.tsx` para renderizar `<QuoteEditPanel quote={quote} history={quote.history} />` debajo de la card de "Totales" (línea ~102).

- [ ] **Step 6: Verificación manual**

`npm run dev` → `/admin/quotes/[id]` de una cotización de prueba → cambiar estado a `QUOTED`, escribir nota → confirmar que aparece en el historial y (si `RESEND_API_KEY` está configurado) llega el correo; si no, confirmar el log de fallback silencioso.

- [ ] **Step 7: Commit**

```bash
git add src/lib/admin-data-service.ts src/app/api/admin/quotes/[id]/route.ts src/lib/email/templates.ts src/components/admin/QuoteEditPanel.tsx "src/app/admin/(dashboard)/quotes/[id]/page.tsx"
git commit -m "feat: edicion de precios reales, historial de estados y notificaciones en cotizaciones"
```

---

### Task 4: Adjuntos PDF en cotizaciones (subida admin + descarga en portal)

**Contexto:** `quote_attachments` existe en el schema y el portal (`/corporativo/mi-cuenta`) ya renderiza una sección de descarga, pero **nada inserta filas en esa tabla** — no hay ruta de subida. Reutilizar el patrón de presigned upload de `src/lib/r2.ts` (`presignPut`), ya probado en Media Library.

**Files:**
- Modify: `src/lib/admin-data-service.ts` (agregar `addQuoteAttachment`, `getQuoteAttachments`)
- Create: `src/app/api/admin/quotes/[id]/attachments/route.ts` (POST: pide presigned URL + crea el registro)
- Create: `src/components/admin/QuoteAttachmentUpload.tsx`
- Modify: `src/app/admin/(dashboard)/quotes/[id]/page.tsx` (montar el uploader)

**Interfaces:**
- Consumes: `presignPut(key, mimeType, sizeBytes): Promise<string>` de `src/lib/r2.ts:29`.
- Produces: `POST /api/admin/quotes/:id/attachments` body `{ fileName, mimeType, sizeBytes, type }` → `{ uploadUrl, fileUrl, attachment }`.

- [ ] **Step 1: Data-service**

```ts
export async function addQuoteAttachment(
  quoteId: string,
  data: { type: string; fileName: string; fileUrl: string; uploadedBy: string }
) {
  const [attachment] = await db.insert(quoteAttachmentsTable).values({ quoteId, ...data }).returning();
  return attachment;
}

export async function getQuoteAttachments(quoteId: string) {
  return db.select().from(quoteAttachmentsTable).where(eq(quoteAttachmentsTable.quoteId, quoteId)).orderBy(desc(quoteAttachmentsTable.createdAt));
}
```

- [ ] **Step 2: API route de subida (presign + registro)**

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { presignPut } from "@/lib/r2";
import { addQuoteAttachment } from "@/lib/admin-data-service";

const bodySchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.literal("application/pdf"),
  sizeBytes: z.number().max(15 * 1024 * 1024), // 15MB máx
  type: z.enum(["COTIZACION", "FACTURA", "NOTA_ENTREGA", "OTRO"]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const { fileName, mimeType, sizeBytes, type } = bodySchema.parse(await req.json());

  const key = `quotes/${id}/${Date.now()}-${fileName}`;
  const uploadUrl = await presignPut(key, mimeType, sizeBytes);
  const fileUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

  const attachment = await addQuoteAttachment(id, { type, fileName, fileUrl, uploadedBy: session.user.id! });
  return NextResponse.json({ uploadUrl, fileUrl, attachment });
}
```

Validar contra el `.env` real: confirmar que `R2_PUBLIC_URL` ya existe como variable (usada por Media Library) antes de asumir el nombre exacto — revisar `src/lib/media.ts` para el patrón de armado de URL pública y reusar la misma función/constante en vez de duplicarla.

- [ ] **Step 3: Componente de subida en el admin**

`QuoteAttachmentUpload.tsx`: input de archivo restringido a `.pdf`, selector de `type`, al enviar hace `POST` a la ruta de arriba para obtener `uploadUrl`, luego `PUT` directo a R2 con el archivo (mismo patrón XHR que `MediaUploadPanel` — reusar esa lógica de progreso si aplica), y al terminar refresca la lista de adjuntos.

- [ ] **Step 4: Montar en la página de detalle**

Agregar sección "Adjuntos" en `quotes/[id]/page.tsx` con `QuoteAttachmentUpload` + lista de `quote.attachments` (extender `getAdminQuoteById` para incluir `attachments: await getQuoteAttachments(id)`).

- [ ] **Step 5: Verificación manual**

Subir un PDF de prueba desde `/admin/quotes/[id]`, confirmar que aparece en la lista del admin y luego, logueado como el cliente corporativo dueño de esa cotización, confirmar que aparece descargable en `/corporativo/mi-cuenta`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin-data-service.ts "src/app/api/admin/quotes/[id]/attachments/route.ts" src/components/admin/QuoteAttachmentUpload.tsx "src/app/admin/(dashboard)/quotes/[id]/page.tsx"
git commit -m "feat: subida de adjuntos PDF a cotizaciones (cotizacion, factura, nota de entrega)"
```

---

### Task 5: Panel CRUD del motor de reglas (`/admin/rules`)

**Objetivo:** que el admin cree/edite/active reglas sin tocar la base de datos directamente, con formularios específicos por `ruleType` (no JSON crudo), tal como pide el punto 2 de la Fase 4 original.

**Files:**
- Create: `src/app/admin/(dashboard)/rules/page.tsx` (lista + filtro por tipo/ámbito)
- Create: `src/app/admin/(dashboard)/rules/new/page.tsx` y `.../rules/[id]/page.tsx`
- Create: `src/components/admin/RuleForm.tsx` (formulario dinámico según `ruleType`)
- Create: `src/app/api/admin/rules/route.ts` (GET lista, POST crear) y `src/app/api/admin/rules/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/lib/admin-data-service.ts` (agregar `getAdminRules`, `createRule`, `updateRule`, `deleteRule`)
- Modify: `src/components/admin/AdminSidebar.tsx:23-36` (agregar item `{ href: '/admin/rules', label: 'Motor de Reglas', icon: Settings }`)

**Interfaces:**
- Consumes: `RuleType`, `RuleScope` y todas las `*Config` interfaces de `src/lib/rules-engine/types.ts:4-78` — el formulario debe cubrir los 10 tipos ahí definidos.
- Produces: CRUD estándar sobre `business_rules`, reusado por `resolveRules` en todos los puntos donde ya se consulta (`corporate-data-service.ts`, `computeCartPricing`, la nueva ruta de Task 2).

- [ ] **Step 1: Data-service CRUD**

```ts
export async function getAdminRules(filters?: { ruleType?: string; scope?: string }) {
  const conditions = [];
  if (filters?.ruleType) conditions.push(eq(businessRulesTable.ruleType, filters.ruleType));
  if (filters?.scope) conditions.push(eq(businessRulesTable.scope, filters.scope));
  return db.select().from(businessRulesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(businessRulesTable.priority), desc(businessRulesTable.createdAt));
}

export async function createRule(data: {
  name: string; ruleType: string; scope: string; scopeId: string | null;
  config: unknown; priority?: number; validFrom?: Date | null; validTo?: Date | null;
}) {
  const [rule] = await db.insert(businessRulesTable).values(data).returning();
  return rule;
}

export async function updateRule(id: string, changes: Partial<{
  name: string; config: unknown; isActive: boolean; priority: number;
  validFrom: Date | null; validTo: Date | null;
}>) {
  const [rule] = await db.update(businessRulesTable).set({ ...changes, updatedAt: new Date() })
    .where(eq(businessRulesTable.id, id)).returning();
  return rule;
}

export async function deleteRule(id: string) {
  await db.delete(businessRulesTable).where(eq(businessRulesTable.id, id));
}
```

- [ ] **Step 2: API routes admin (auth + zod por `ruleType`)**

Definir en la ruta un `configSchemaByType: Record<RuleType, z.ZodType>` que valide cada `config` según el tipo (usando los shapes de `types.ts`: `MinQuantityConfig`, `MultiplesOnlyConfig`, etc.) antes de guardar — así el panel nunca puede persistir una config con la forma incorrecta para el tipo elegido.

- [ ] **Step 3: `RuleForm.tsx` — formulario dinámico**

Selector de `ruleType` (10 opciones con nombre legible: "Cantidad mínima", "Solo múltiplos", "Rango de cantidad", "Modo de tallas", "Visibilidad de precios", "Modo de inventario", "Escala por volumen", "Promoción", "Restricción por color", "Descuento por volumen (individual)"), selector de `scope` (GLOBAL/BRAND/SET_GROUP/SET/PRODUCT) con un buscador condicional de `scopeId` (marca, grupo, set o producto según el scope elegido — reusar los selectores ya existentes en `SetForm`/`ProductForm` para brand/set), y un sub-formulario específico por tipo que arma el `config` JSON (ej.: para `MIN_QUANTITY` → input numérico `min` + radio `SETS`/`PIECES`; para `VOLUME_SCALE`/`VOLUME_DISCOUNT_RETAIL` → lista editable de tiers `{minQty/minItems, pct}`).

- [ ] **Step 4: Lista con filtros y activar/desactivar rápido**

`rules/page.tsx`: tabla con columnas Nombre, Tipo, Ámbito, Prioridad, Vigencia, Activa (toggle inline vía `PATCH .../rules/[id]` con `{isActive}`), Acciones (Editar/Eliminar).

- [ ] **Step 5: Verificación manual**

Crear una regla `MIN_QUANTITY` con `scope: SET` para un set específico, mínimo distinto a 12, confirmar en `/corporativo/s/[slug]` que ese set exige el nuevo mínimo mientras los demás siguen en 12 (jerarquía SET > GLOBAL funcionando desde la UI, no solo desde tests).

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/(dashboard)/rules" src/components/admin/RuleForm.tsx src/app/api/admin/rules src/lib/admin-data-service.ts src/components/admin/AdminSidebar.tsx
git commit -m "feat: panel CRUD del motor de reglas de negocio"
```

---

### Task 6: Aplicar y probar las reglas avanzadas (PROMO, COLOR_RESTRICTION, MULTIPLES_ONLY) end-to-end

**Hallazgo de la auditoría:** `COLOR_RESTRICTION` y `MULTIPLES_ONLY` ya se validan en `src/lib/rules-engine/validate.ts` y tienen tests, pero **`PROMO` (`N_PLUS_ONE`) no se aplica en ningún lado** — `computeCartPricing` (`src/lib/rules-engine/pricing.ts`) no lee `resolved.promos`.

**Files:**
- Modify: `src/lib/rules-engine/types.ts:168-175` (agregar `promoDiscountAmount` a `PricingResult`)
- Modify: `src/lib/rules-engine/pricing.ts`
- Modify: `src/lib/rules-engine/__tests__/rules-engine.test.ts`

**Interfaces:**
- Consumes: `resolved.promos: PromoConfig[]` (ya existe en `ResolvedRules`, `types.ts:111`).
- Produces: `PricingResult.promoDiscountAmount: number`, restado del `total` junto al descuento por volumen.

- [ ] **Step 1: Test que exige el comportamiento (falla primero)**

```ts
it("aplica promo N_PLUS_ONE: cada 13 unidades de un set, 1 gratis", () => {
  const rules: BusinessRule[] = [{
    id: "1", name: "promo", ruleType: "PROMO", scope: "SET", scopeId: "set-1",
    config: { kind: "N_PLUS_ONE", buy: 13, free: 1 }, isActive: true, priority: 0,
  }];
  const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 26 }] }] };
  const prices = { "set-1": { pricePerSet: 10, hasMissingPrices: false } };
  const result = computeCartPricing(cart, prices, rules);
  // 26 unidades, promo 13+1 aplica 2 veces -> 2 gratis -> descuento de 2*10 = 20
  expect(result.promoDiscountAmount).toBe(20);
  expect(result.total).toBe(26 * 10 - 20);
});
```

Run: `npx vitest run --no-file-parallelism src/lib/rules-engine`
Expected: FAIL (`promoDiscountAmount` no existe / es `undefined`).

- [ ] **Step 2: Implementar en `pricing.ts`**

Agregar tras el cálculo de `volumeDiscountAmount` (línea 51):

```ts
let promoDiscountAmount = 0;
for (const item of cart.items) {
  const itemQty = item.lines.reduce((sum, l) => sum + l.quantity, 0);
  const unitPrice = setPrices[item.setId]?.pricePerSet ?? 0;
  const setPromos = resolved.promos; // MVP: promos GLOBAL/SET ya resueltas por resolveRules para el contexto del cart
  for (const promo of setPromos) {
    if (promo.kind === "N_PLUS_ONE" && promo.buy > 0) {
      const cycles = Math.floor(itemQty / promo.buy);
      promoDiscountAmount += cycles * promo.free * unitPrice;
    }
  }
}
promoDiscountAmount = round2(promoDiscountAmount);

const total = round2(subtotalBeforeDiscount - volumeDiscountAmount - promoDiscountAmount);
```

Actualizar el `return` para incluir `promoDiscountAmount`.

> Nota de diseño: `resolveRules` hoy se llama una sola vez con `{}` (contexto vacío, línea 40) para resolver reglas GLOBAL. Para que una promo `scope: SET` aplique solo a su set, `computeCartPricing` necesita resolver reglas **por cada `item.setId`** pasando `{ setId: item.setId }` como contexto — igual que ya hace `validateCorporateCart`. Ajustar el loop para llamar `resolveRules(allRules, { setId: item.setId }, now)` dentro de cada iteración en vez de usar el `resolved` global para promos.

- [ ] **Step 3: Actualizar `PricingResult` en `types.ts`**

```ts
export interface PricingResult {
  lines: PricingLineResult[];
  subtotalBeforeDiscount: number;
  volumeDiscountPct: number;
  volumeDiscountAmount: number;
  promoDiscountAmount: number;
  total: number;
  hasMissingPrices: boolean;
}
```

- [ ] **Step 4: Correr los tests**

Run: `npx vitest run --no-file-parallelism src/lib/rules-engine`
Expected: PASS (19 + tests previos, todos en verde).

- [ ] **Step 5: Exponer el descuento de promo en la UI del carrito corporativo**

En el componente que consume `computeCartPricing` (drawer/página del carrito corporativo — localizar el consumidor de `CorporateCartContext`), mostrar una línea "Descuento por promoción: -$X" cuando `promoDiscountAmount > 0`, igual que ya se muestra el descuento por volumen.

- [ ] **Step 6: Commit**

```bash
git add src/lib/rules-engine
git commit -m "feat: aplicar regla PROMO (N_PLUS_ONE) en el calculo de precios del carrito corporativo"
```

---

### Task 7: Vista de carritos corporativos activos/abandonados (admin)

**Files:**
- Create: `src/app/admin/(dashboard)/corporate-carts/page.tsx`
- Modify: `src/lib/admin-data-service.ts` (agregar `getAdminCorporateCarts`)
- Modify: `src/components/admin/AdminSidebar.tsx` (agregar item)

**Interfaces:**
- Consumes: `corporateCarts` join `corporateAccounts` de `src/db/schema/corporate.ts:118-128`.
- Produces: página de solo lectura, sin nueva API pública.

- [ ] **Step 1: Data-service**

```ts
export async function getAdminCorporateCarts() {
  return db
    .select({
      id: corporateCartsTable.id,
      accountId: corporateCartsTable.accountId,
      items: corporateCartsTable.items,
      updatedAt: corporateCartsTable.updatedAt,
      razonSocial: corporateAccountsTable.razonSocial,
      contactName: corporateAccountsTable.contactName,
      email: corporateAccountsTable.email,
    })
    .from(corporateCartsTable)
    .innerJoin(corporateAccountsTable, eq(corporateCartsTable.accountId, corporateAccountsTable.id))
    .orderBy(desc(corporateCartsTable.updatedAt));
}
```

- [ ] **Step 2: Página admin**

`corporate-carts/page.tsx` (Server Component): tabla con Empresa, Contacto, Cantidad de sets en carrito (`sum` de `items[].lines[].quantity`), "Última actividad" (`updatedAt`), y una etiqueta "Abandonado" si `updatedAt` tiene más de 7 días — calcular en el servidor con `Date.now() - new Date(row.updatedAt).getTime() > 7 * 24 * 60 * 60 * 1000`. Sin acciones en esta versión (es visibilidad, no gestión).

- [ ] **Step 3: Verificación manual**

Armar un carrito corporativo logueado, confirmar que aparece en `/admin/corporate-carts` con el conteo correcto de sets.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(dashboard)/corporate-carts" src/lib/admin-data-service.ts src/components/admin/AdminSidebar.tsx
git commit -m "feat: vista admin de carritos corporativos activos y abandonados"
```

---

## Self-Review

**Cobertura del hallazgo original (auditoría previa):**
- AGENTS.md → Task 1.
- Migración de `VOLUME_DISCOUNT_RETAIL` → Task 2.
- Módulo de cotizaciones (precios reales, historial, adjuntos, emails de transición) → Tasks 3–4.
- Panel CRUD del motor de reglas → Task 5.
- Reglas avanzadas (promo 13+1) expuestas y probadas → Task 6. (`COLOR_RESTRICTION`/`MULTIPLES_ONLY` ya estaban validadas — Task 5 las expone en el panel, no requieren cambios de lógica).
- Carritos activos/abandonados → Task 7.
- Botón de envío bloqueado en el carrito corporativo — **no requiere tarea nueva**: la validación (`validateCorporateCart` → `canSubmit`) ya existe en `CorporateCartContext`; confirmar en Task 6 Step 5 que el consumidor del contexto efectivamente deshabilita el botón (si no lo hace, es un fix de una línea, no una tarea aparte).
- Rol `CORPORATE_CLIENT` como texto libre — es el patrón preexistente del proyecto (ningún otro rol es enum); no se incluye como tarea correctiva, se documenta como mejora opcional abajo.

---

## Estrategias de mejora (más allá de cerrar pendientes)

No son tareas comprometidas — son opciones a decidir antes de convertirlas en plan. Ordenadas por relación costo/impacto:

**Negocio / conversión**
1. **Recordatorio de carrito corporativo abandonado por correo** — una vez existe Task 7 (visibilidad), el siguiente paso natural es un cron/endpoint que dispare un correo automático a cuentas con carrito >3 días sin actividad y sin cotización enviada, usando el mismo `src/lib/email/` ya construido.
2. **Exportar cotización a PDF autogenerado** — hoy los adjuntos son subidos a mano por ventas (Task 4). Si el volumen crece, generar el PDF de la cotización referencial automáticamente (ej. `@react-pdf/renderer`) ahorra el paso manual para el caso más común.
3. **KPIs de cotizaciones en el dashboard** (`/admin`) — tiempo promedio en cada estado (usando `quote_status_history` de Task 3), tasa de conversión RECEIVED→APPROVED, top sets solicitados. Barato una vez existe el historial.

**Producto / UX del catálogo**
4. **Buscador/filtro adicional en `/corporativo`** por rango de precio referencial y disponibilidad de tallas, igual al catálogo individual.
5. **Guardar cotizaciones favoritas/comparar sets** antes de armar el carrito — reduce fricción para compradores institucionales que evalúan varias opciones.

**Técnico / mantenibilidad**
6. **Convertir `role` y `status` (de `users`, `corporate_accounts`, `quote_requests`) de `text` libre a `pgEnum`** — hoy cualquier string pasa la validación de base de datos; un typo en un `UPDATE` manual no lo detectaría nadie. Es un cambio de bajo riesgo (Drizzle soporta migrar `text` a `enum` con `USING`) pero toca varias tablas, mejor como su propio plan pequeño.
7. **Tests de integración del flujo corporativo completo** (registro → aprobación → login → carrito → cotización) con Playwright o similar — hoy la verificación es manual vía Chrome DevTools; automatizar el camino feliz evita regresiones silenciosas cuando se toque `rules-engine` o el schema.
8. **Rate limiting en `/api/corporate/quotes` y `/api/corporate/register`** — son endpoints públicos sin auth que escriben en BD y disparan correos; sin límite de tasa son un vector de abuso/spam de cotizaciones falsas.

**Seguridad**
9. **Auditoría de quién sube/borra adjuntos** — `quote_attachments.uploadedBy` ya registra el usuario (Task 4), pero no hay endpoint de borrado; si se agrega, debe quedar en el mismo historial que los cambios de estado.
10. **Validar `mimeType`/tamaño real del archivo en R2**, no solo en el body del POST — hoy Task 4 confía en lo que declara el cliente antes de presignar; un `HeadObjectCommand` (ya importado en `src/lib/r2.ts:1`) después del PUT puede confirmar el tipo real antes de exponer el `fileUrl` en el portal del cliente.

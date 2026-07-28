# Atributos EAV como eje de variante — Fase 1: Schema + API de `usageMode` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar la columna `usage_mode` a `product_type_attributes` (`'INFORMATIVE' | 'VARIANT'`, default `'INFORMATIVE'`) y exponerla en el endpoint de asociación tipo-de-producto↔atributo, sin cambiar ningún comportamiento visible todavía.

**Architecture:** Migración Drizzle aditiva (columna con default, sin backfill necesario porque el default preserva el comportamiento actual). El servicio `addProductTypeAttribute`/`getProductTypeAttributes` en `src/lib/admin-data-service.ts` y el endpoint `src/app/api/admin/product-types/[id]/attributes/route.ts` se extienden para leer/escribir el campo. No se toca ninguna UI en esta fase — es puramente backend, verificable con curl/Postman o el propio `/admin/tipos-producto` (que seguirá funcionando exactamente igual, ignorando el campo nuevo).

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, PostgreSQL, Zod.

## Global Constraints

- Nunca ejecutar `git commit`, `git push`, ni crear PRs/Releases — solo sugerir el mensaje de commit al final (regla del proyecto, `CLAUDE.md`).
- Las migraciones se generan con `npm run db:generate` (Drizzle Kit) y se aplican manualmente contra la base vía el patrón ya usado en la sesión (`drizzle-kit push` falla por drift no relacionado en `collections`; usar un script Node/`pg` puntual para ejecutar el SQL generado, exactamente como se hizo para `products.created_by`/`updated_by`).
- No modificar `attributes`, `attributeValues`, `variantAttributeValues`, ni el pipeline `src/lib/attributes-payload/` — quedan fuera de esta fase.
- Validar con build + lint + typecheck antes de dar la fase por terminada (no hay tests automatizados para esta capa en el proyecto).

---

### Task 1: Columna `usage_mode` en `product_type_attributes`

**Files:**
- Modify: `src/db/schema/products.ts:115-123` (tabla `productTypeAttributes`)

**Interfaces:**
- Produces: campo `usageMode: 'INFORMATIVE' | 'VARIANT'` en el tipo inferido de `productTypeAttributes` (consumido por Task 2 y por la Fase 2 del proyecto completo).

- [ ] **Step 1: Agregar la columna al schema**

En `src/db/schema/products.ts`, dentro de la definición de `productTypeAttributes` (línea 115-123), agregar la columna `usageMode` junto a `isRequired`/`sortOrder`:

```ts
export const productTypeAttributes = pgTable("product_type_attributes", {
  id: pgUuid("id").primaryKey().$defaultFn(() => uuid()),
  productTypeId: pgUuid("product_type_id").notNull().references(() => productTypes.id, { onDelete: "cascade" }),
  attributeId: pgUuid("attribute_id").notNull().references(() => attributes.id, { onDelete: "cascade" }),
  isRequired: boolean("is_required").default(false),
  sortOrder: integer("sort_order").default(0),
  // 'INFORMATIVE' = valor único global al producto, mostrado como dato de ficha
  // (comportamiento histórico). 'VARIANT' = eje más de la matriz de generación de
  // variantes (junto a color/talla): cada valor activo genera su propia fila de
  // product_variants, seleccionable por el comprador al armar el pedido.
  usageMode: text("usage_mode").notNull().default("INFORMATIVE"),
}, (table) => [
  unique("uq_product_type_attributes").on(table.productTypeId, table.attributeId),
]);
```

- [ ] **Step 2: Generar la migración**

Run: `npm run db:generate`
Expected: nuevo archivo en `src/db/migrations/00XX_<nombre>.sql` con contenido equivalente a:
```sql
ALTER TABLE "product_type_attributes" ADD COLUMN "usage_mode" text DEFAULT 'INFORMATIVE' NOT NULL;
```

- [ ] **Step 3: Aplicar la migración contra la base**

Leer el `.sql` generado en el Step 2 y confirmar que contiene únicamente el `ALTER TABLE` de arriba (sin statements no relacionados — si `drizzle-kit generate` arrastra drift de otras tablas pendientes, aislar manualmente solo la línea de `product_type_attributes` antes de ejecutar). Aplicar con un script puntual `pg`/Node que lea `DATABASE_URL` de `.env.local` y ejecute el/los statement(s), siguiendo el mismo patrón ya usado en esta sesión para la migración de `products.created_by`/`updated_by` (ver `scripts/_tmp_apply_migration.mjs` de esa tarea — recrear el script, ejecutar, y borrarlo al terminar).

Expected: `ALTER TABLE` ejecuta sin error; `SELECT usage_mode FROM product_type_attributes LIMIT 1` (si hay filas) devuelve `'INFORMATIVE'` para todas las filas existentes.

- [ ] **Step 4: Verificar con typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos relacionados a `products.ts` o `admin-data-service.ts` (los 2 errores preexistentes de `schema.test.ts`/`docs.test.ts` documentados en sesiones previas pueden seguir apareciendo, son ajenos a este cambio).

- [ ] **Step 5: Commit**

```bash
git add src/db/schema/products.ts src/db/migrations/
git commit -m "feat(atributos): agregar campo usage_mode a product_type_attributes (INFORMATIVE|VARIANT)"
```

---

### Task 2: Exponer `usageMode` en el servicio de datos admin

**Files:**
- Modify: `src/lib/admin-data-service.ts:2287-2327` (`getProductTypeAttributes`, `addProductTypeAttribute`)

**Interfaces:**
- Consumes: columna `productTypeAttributesTable.usageMode` (Task 1).
- Produces:
  - `getProductTypeAttributes(productTypeId: string)` — cada fila del array resultante incluye `usageMode: string`.
  - `addProductTypeAttribute(productTypeId: string, attributeId: string, isRequired: boolean, sortOrder: number, usageMode: 'INFORMATIVE' | 'VARIANT')` — nueva firma con un 5º parámetro `usageMode`.

- [ ] **Step 1: Extender `getProductTypeAttributes` para seleccionar `usageMode`**

En `src/lib/admin-data-service.ts`, dentro de `getProductTypeAttributes` (línea 2287-2303), agregar `usageMode` al `select`:

```ts
export async function getProductTypeAttributes(productTypeId: string) {
  return db
    .select({
      id: productTypeAttributesTable.id,
      productTypeId: productTypeAttributesTable.productTypeId,
      attributeId: productTypeAttributesTable.attributeId,
      isRequired: productTypeAttributesTable.isRequired,
      sortOrder: productTypeAttributesTable.sortOrder,
      usageMode: productTypeAttributesTable.usageMode,
      attributeName: attributesTable.name,
      attributeSlug: attributesTable.slug,
      displayType: attributesTable.displayType,
    })
    .from(productTypeAttributesTable)
    .innerJoin(attributesTable, eq(productTypeAttributesTable.attributeId, attributesTable.id))
    .where(eq(productTypeAttributesTable.productTypeId, productTypeId))
    .orderBy(asc(productTypeAttributesTable.sortOrder));
}
```

- [ ] **Step 2: Extender `addProductTypeAttribute` para aceptar y persistir `usageMode`**

Reemplazar la función en línea 2312-2327:

```ts
export async function addProductTypeAttribute(
  productTypeId: string,
  attributeId: string,
  isRequired: boolean,
  sortOrder: number,
  usageMode: 'INFORMATIVE' | 'VARIANT' = 'INFORMATIVE'
) {
  const [link] = await db
    .insert(productTypeAttributesTable)
    .values({ productTypeId, attributeId, isRequired, sortOrder, usageMode })
    .onConflictDoUpdate({
      target: [productTypeAttributesTable.productTypeId, productTypeAttributesTable.attributeId],
      set: { isRequired, sortOrder, usageMode },
    })
    .returning();
  return link;
}
```

- [ ] **Step 3: Verificar con typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos. Si `addProductTypeAttribute` tiene otros call-sites que no pasan el 5º parámetro, deben seguir compilando por el default `'INFORMATIVE'`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/admin-data-service.ts
git commit -m "feat(atributos): propagar usageMode en getProductTypeAttributes/addProductTypeAttribute"
```

---

### Task 3: Aceptar `usageMode` en el endpoint de asociación

**Files:**
- Modify: `src/app/api/admin/product-types/[id]/attributes/route.ts`

**Interfaces:**
- Consumes: `addProductTypeAttribute(productTypeId, attributeId, isRequired, sortOrder, usageMode)` (Task 2).
- Produces: `POST /api/admin/product-types/[id]/attributes` acepta `usageMode?: 'INFORMATIVE' | 'VARIANT'` en el body (default `'INFORMATIVE'` si se omite, vía Zod); `GET` devuelve `usageMode` en cada elemento de `attributes[]`.

- [ ] **Step 1: Extender el schema Zod del POST**

En `src/app/api/admin/product-types/[id]/attributes/route.ts`, modificar `AssociateAttributeSchema` (línea 12-16):

```ts
const AssociateAttributeSchema = z.object({
  attributeId: z.string().min(1),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().default(0),
  usageMode: z.enum(['INFORMATIVE', 'VARIANT']).default('INFORMATIVE'),
});
```

- [ ] **Step 2: Pasar `usageMode` a `addProductTypeAttribute` en el handler POST**

Modificar el handler `POST` (línea 32-49):

```ts
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { attributeId, isRequired, sortOrder, usageMode } = AssociateAttributeSchema.parse(body);
    const link = await addProductTypeAttribute(id, attributeId, isRequired, sortOrder, usageMode);
    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

El handler `GET` no necesita cambios de código — ya hace `SELECT *`-equivalente vía `getProductTypeAttributes`, que ahora incluye `usageMode` (Task 2, Step 1).

- [ ] **Step 3: Verificación manual del endpoint**

Con el servidor de desarrollo corriendo (`npm run dev`), ejecutar contra un tipo de producto real existente (obtener su `id` desde `GET /api/admin/product-types` o la UI de `/admin/tipos-producto`):

```bash
# Reemplazar {productTypeId} y {attributeId} por valores reales de tu base
curl -X POST http://localhost:3000/api/admin/product-types/{productTypeId}/attributes \
  -H "Content-Type: application/json" \
  -H "Cookie: <cookie de sesión admin autenticada>" \
  -d '{"attributeId":"{attributeId}","isRequired":false,"sortOrder":0,"usageMode":"VARIANT"}'
```

Expected: `201` con el objeto `link` incluyendo `"usageMode":"VARIANT"`.

```bash
curl http://localhost:3000/api/admin/product-types/{productTypeId}/attributes \
  -H "Cookie: <cookie de sesión admin autenticada>"
```

Expected: `attributes[]` incluye la asociación recién creada/actualizada con `"usageMode":"VARIANT"`.

Nota: si obtener una cookie de sesión válida por curl es incómodo, verificar en su lugar navegando a `/admin/tipos-producto`, abriendo el panel "Estilos" de un tipo de producto y confirmando en las DevTools (pestaña Network) que la respuesta de `GET .../attributes` ya trae `usageMode` en cada fila — la UI todavía no lo usa ni lo muestra (eso es la Fase 2), pero el campo debe viajar en la respuesta JSON.

- [ ] **Step 4: Verificar con build completo**

Run: `npm run build`
Expected: build exitoso, sin errores de tipos ni de rutas.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/product-types/[id]/attributes/route.ts
git commit -m "feat(atributos): aceptar y devolver usageMode en API de asociacion tipo-producto/atributo"
```

---

## Fin de Fase 1

Al completar las 3 tareas: la base de datos y la API soportan `usageMode` de punta a punta, con `'INFORMATIVE'` como comportamiento por defecto para todas las asociaciones existentes (cero regresión visible). La UI de `/admin/tipos-producto` sigue sin mostrar el campo — eso es el inicio de la Fase 2 (admin: Tipos de Producto + ficha de Producto), que se planea por separado.

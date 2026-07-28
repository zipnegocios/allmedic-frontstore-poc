# Atributos EAV como eje de variante — Fase 2: Admin (Tipos de Producto + Ficha de Producto) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir al admin marcar una asociación Tipo de Producto ↔ Atributo como "Variante" desde `/admin/tipos-producto`, y hacer que la ficha de Producto genere variantes reales cruzando color × talla × valores de atributos `VARIANT`, mientras los atributos `INFORMATIVE` siguen funcionando exactamente como hoy.

**Architecture:** Depende de la Fase 1 (columna `usage_mode` + API ya completas). Esta fase es 100% frontend admin: un toggle nuevo en `/admin/tipos-producto`, y una reestructuración de `AttributeMatrixSection`/`AttributeStyleSection`/`ProductForm.tsx` para separar atributos por `usageMode` en dos flujos distintos (valor único global vs. eje de matriz). El backend de guardado de producto (`createProductWithRelations`/`updateProductWithRelations`, `variant_attribute_values`) no cambia — ya acepta `attributeValueIds` arbitrarios por variante.

**Tech Stack:** Next.js 15 App Router (client components), React Hook Form + Zod, Drizzle ORM (solo lectura en esta fase).

## Global Constraints

- Nunca ejecutar `git commit`, `git push`, ni crear PRs/Releases — solo sugerir el mensaje de commit al final.
- Requiere que la Fase 1 (`docs/superpowers/plans/2026-07-28-atributos-eje-variante-fase1-schema-api.md`) esté aplicada contra la base de datos en uso — `product_type_attributes.usage_mode` debe existir y la API debe aceptarlo/devolverlo.
- No tocar `withSyncedStyleAttributes` para atributos `VARIANT` de forma que pierdan sus valores por-variante — es el bug central que esta fase corrige (hoy copia el mismo valor a todas las filas).
- Mantener la doctrina "sin opción muerta" ya documentada en `useProductTypeAttributes.ts`: si un atributo no tiene valores activos, mostrar mensaje explicativo, no un selector vacío.
- Validar con build + lint + typecheck al final de cada tarea que toque código compilable.

---

### Task 1: Toggle Informativo/Variante en `/admin/tipos-producto`

**Files:**
- Modify: `src/app/admin/(dashboard)/tipos-producto/page.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/product-types/[id]/attributes` ahora acepta `usageMode` (Fase 1); `GET` del mismo endpoint devuelve `usageMode` en cada link.
- Produces: ninguna interfaz nueva para otras tareas — este componente es una hoja de la UI.

- [ ] **Step 1: Agregar `usageMode` a la interfaz local `ProductTypeAttributeLink`**

En `src/app/admin/(dashboard)/tipos-producto/page.tsx`, extender la interfaz (línea 34-43):

```ts
interface ProductTypeAttributeLink {
  id: string;
  productTypeId: string;
  attributeId: string;
  isRequired: boolean | null;
  sortOrder: number | null;
  usageMode: 'INFORMATIVE' | 'VARIANT';
  attributeName: string;
  attributeSlug: string;
  displayType: string;
}
```

- [ ] **Step 2: Agregar estado `selectedUsageMode` y pasarlo en `handleAssociate`**

Junto al estado existente `selectedRequired` (línea 61), agregar:

```ts
const [selectedUsageMode, setSelectedUsageMode] = useState<'INFORMATIVE' | 'VARIANT'>('INFORMATIVE');
```

En `openManageAttributes` (línea 132-143), resetear el nuevo estado junto a los existentes:

```ts
async function openManageAttributes(pt: ProductType) {
  setManagingType(pt);
  setSelectedAttributeId('');
  setSelectedRequired(false);
  setSelectedUsageMode('INFORMATIVE');
  setAttrDialogOpen(true);
  const [attrsRes, linksRes] = await Promise.all([
    fetch('/api/admin/attributes'),
    fetch(`/api/admin/product-types/${pt.id}/attributes`),
  ]);
  if (attrsRes.ok) setAllAttributes((await attrsRes.json()).attributes);
  if (linksRes.ok) setLinks((await linksRes.json()).attributes);
}
```

En `handleAssociate` (línea 151-167), incluir `usageMode` en el body y resetear el estado tras asociar:

```ts
async function handleAssociate() {
  if (!managingType || !selectedAttributeId) return;
  try {
    const res = await fetch(`/api/admin/product-types/${managingType.id}/attributes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attributeId: selectedAttributeId,
        isRequired: selectedRequired,
        sortOrder: links.length,
        usageMode: selectedUsageMode,
      }),
    });
    if (!res.ok) throw new Error('Failed to associate');
    toast.success('Estilo asociado');
    setSelectedAttributeId('');
    setSelectedRequired(false);
    setSelectedUsageMode('INFORMATIVE');
    await refreshLinks();
  } catch {
    toast.error('Error al asociar el estilo');
  }
}
```

- [ ] **Step 3: Mostrar el modo en cada link existente y agregar el selector al formulario de asociación**

Reemplazar el bloque que renderiza cada link (línea 334-344) para mostrar el modo:

```tsx
links.map((l) => (
  <div key={l.id} className="flex items-center justify-between gap-2 border rounded px-3 py-2">
    <div>
      <p className="text-sm font-medium">{l.attributeName}</p>
      <p className="text-xs text-gray-500">
        {l.isRequired ? 'Obligatorio' : 'Opcional'} · orden {l.sortOrder} ·{' '}
        {l.usageMode === 'VARIANT' ? 'Variante (seleccionable en compra)' : 'Informativo (ficha)'}
      </p>
    </div>
    <Button size="sm" variant="ghost" onClick={() => handleDissociate(l.attributeId)}>
      <X className="w-4 h-4 text-red-500" />
    </Button>
  </div>
))
```

Agregar el selector de modo al formulario de "Asociar nuevo estilo" (dentro del bloque `{availableToAssociate.length > 0 && (...)}`, línea 348-369), justo después del checkbox "Obligatorio":

```tsx
{availableToAssociate.length > 0 && (
  <div className="border-t pt-4 space-y-2">
    <Label>Asociar nuevo estilo</Label>
    <select
      className="w-full border rounded-md h-10 px-3 text-sm"
      value={selectedAttributeId}
      onChange={(e) => setSelectedAttributeId(e.target.value)}
    >
      <option value="">Selecciona un atributo...</option>
      {availableToAssociate.map((a) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </select>
    <div className="flex items-center gap-2">
      <input type="checkbox" checked={selectedRequired} onChange={(e) => setSelectedRequired(e.target.checked)} />
      <Label>Obligatorio</Label>
    </div>
    <div className="space-y-1">
      <Label className="text-xs text-gray-600">Comportamiento</Label>
      <select
        className="w-full border rounded-md h-10 px-3 text-sm"
        value={selectedUsageMode}
        onChange={(e) => setSelectedUsageMode(e.target.value as 'INFORMATIVE' | 'VARIANT')}
      >
        <option value="INFORMATIVE">Informativo — dato fijo de ficha, un solo valor por producto</option>
        <option value="VARIANT">Variante — el comprador elige un valor al armar el pedido</option>
      </select>
    </div>
    <Button size="sm" className="bg-[#111111]" onClick={handleAssociate} disabled={!selectedAttributeId}>
      Asociar
    </Button>
  </div>
)}
```

- [ ] **Step 4: Verificación manual en navegador**

Correr `npm run dev`, navegar a `/admin/tipos-producto`, abrir "Estilos" de un tipo de producto existente (ej. "Pantalón"), asociar un atributo con modo "Variante", y confirmar:
- El link recién creado muestra "Variante (seleccionable en compra)" en su descripción.
- Recargar la página y reabrir el panel — el modo persiste (confirma que se guardó en base de datos, no solo en estado local).
- Un link con modo "Informativo" (default, o cualquiera creado antes de este cambio) sigue mostrando "Informativo (ficha)".

Expected: comportamiento visible arriba, sin errores en consola del navegador.

- [ ] **Step 5: Verificar con typecheck y lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos (los 2 preexistentes documentados pueden seguir apareciendo).

Run: `npx eslint "src/app/admin/(dashboard)/tipos-producto/page.tsx"`
Expected: sin salida (limpio).

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/(dashboard)/tipos-producto/page.tsx"
git commit -m "feat(tipos-producto): agregar selector Informativo/Variante al asociar atributos"
```

---

### Task 2: Filtrar `styleAttributes` a solo atributos `INFORMATIVE` al sincronizar

**Files:**
- Modify: `src/components/admin/ProductForm.tsx:417-436` (`withSyncedStyleAttributes`)
- Modify: `src/components/admin/ProductForm.tsx:364-377` (derivación de carga de `styleAttributes`)

**Interfaces:**
- Consumes: `attributeLinks: ProductTypeAttributeLink[]` (ya disponible en `ProductForm.tsx` vía `useProductTypeAttributes`, ahora con `usageMode` poblado desde la Fase 1).
- Produces: `withSyncedStyleAttributes` ya no pisa `attributeValueIds` de atributos `VARIANT` al guardar — solo sincroniza los `INFORMATIVE`. Este es el cambio que desbloquea que la Task 3 (matriz cruzada) pueda persistir valores por-variante distintos entre filas.

- [ ] **Step 1: Escribir el caso de prueba manual que documenta el bug actual (antes de tocar código)**

Antes de modificar, confirmar en el navegador (`npm run dev`, editar un producto de tipo "Pantalón" con un atributo `VARIANT` ya asociado desde Task 1) que:
1. En la pestaña "Variantes y Medios", si se edita manualmente el `attributeValueIds` de una fila de variante (aún no hay UI para esto — se puede confirmar leyendo el estado del formulario vía React DevTools, o dejar esta verificación para el final de Task 3 cuando exista UI real).
2. Este paso es informativo: no hay un test automatizado a escribir aquí (el proyecto no tiene suite de tests para `ProductForm.tsx`); el criterio de éxito real se valida al final de la Task 3.

- [ ] **Step 2: Modificar `withSyncedStyleAttributes` para filtrar por `usageMode`**

En `src/components/admin/ProductForm.tsx`, reemplazar la función (línea 417-436):

```ts
// Los atributos "Estilo" en modo INFORMATIVE se eligen una sola vez en General
// (`styleAttributes`) y se copian a todas las variantes — comportamiento histórico
// sin cambios. Los atributos en modo VARIANT NO se copian aquí: su valor vive
// por-variante (`attributeValueIds` editado directamente en cada fila de la matriz,
// ver `AttributeMatrixSection`), y copiarlos aquí los pisaría con un único valor
// global, perdiendo la distinción entre variantes que es el propósito del modo VARIANT.
function withSyncedStyleAttributes(data: ProductFormData): ProductFormData {
  const informativeAttributeIds = new Set(
    attributeLinks.filter((link) => link.usageMode !== 'VARIANT').map((link) => link.attributeId)
  );
  const informativeValueIds = Object.entries(data.styleAttributes ?? {})
    .filter(([attributeId]) => informativeAttributeIds.has(attributeId))
    .map(([, valueId]) => valueId)
    .filter(Boolean);

  const synced: ProductFormData = {
    ...data,
    variants: data.variants.map((v) => ({
      ...v,
      // Conserva los valores VARIANT ya presentes en la fila (asignados por
      // AttributeMatrixSection o editados fila a fila) y les agrega los INFORMATIVE
      // vigentes — sin duplicar si ya estuvieran.
      attributeValueIds: Array.from(new Set([
        ...(v.attributeValueIds ?? []).filter((id) =>
          !informativeAttributeIds.has(
            attributeLinks.find((link) => valuesByAttribute[link.attributeId]?.some((opt) => opt.id === id))?.attributeId ?? ''
          )
        ),
        ...informativeValueIds,
      ])),
    })),
  };
  // Modo 'FIRST_VARIANT': la portada se hereda en vivo del primer color — no se
  // envían `cover`/`secondaryCover` (quedarían con `assetId: ''`, que el
  // backend rechazaría si se enviaran como objetos "presentes pero vacíos").
  if (synced.coverSource === 'FIRST_VARIANT') {
    const empty = { assetId: '', url: '', storageKey: '', mimeType: '', alt: '' };
    synced.cover = empty;
    synced.secondaryCover = empty;
  }
  return synced;
}
```

Nota sobre la lógica de filtrado dentro de `.map()`: se recalcula qué IDs de valor pertenecen a atributos `INFORMATIVE` buscando en `valuesByAttribute` cuál atributo contiene cada `id` existente en la fila — esto evita borrar valores `VARIANT` ya asignados a esa variante específica (que Task 3 empieza a poblar) mientras sigue reemplazando cualquier valor `INFORMATIVE` viejo por el vigente. Es intencionalmente conservador: si un id no matchea ningún atributo conocido (dato corrupto/legacy), se descarta.

- [ ] **Step 3: Ajustar la derivación de carga para no mezclar `VARIANT` en `styleAttributes`**

En `src/components/admin/ProductForm.tsx`, modificar el `useEffect` de derivación (línea 364-377) para que solo derive valores de atributos `INFORMATIVE`:

```ts
useEffect(() => {
  if (attributeLinks.length === 0) return;
  if (Object.keys(getValues('styleAttributes') || {}).length > 0) return;
  const variants = getValues('variants');
  const sourceVariant = variants.find((v) => (v.attributeValueIds || []).length > 0);
  if (!sourceVariant) return;
  const derived: Record<string, string> = {};
  for (const link of attributeLinks) {
    if (link.usageMode === 'VARIANT') continue; // su valor vive por-variante, no se colapsa a un único valor global
    const options = valuesByAttribute[link.attributeId] ?? [];
    const match = sourceVariant.attributeValueIds?.find((id) => options.some((o) => o.id === id));
    if (match) derived[link.attributeId] = match;
  }
  if (Object.keys(derived).length > 0) setValue('styleAttributes', derived);
}, [attributeLinks, valuesByAttribute, getValues, setValue]);
```

- [ ] **Step 4: Verificar con typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ProductForm.tsx
git commit -m "fix(productos): no sincronizar atributos VARIANT como valor unico global del producto"
```

---

### Task 3: `AttributeStyleSection` solo muestra atributos `INFORMATIVE`

**Files:**
- Modify: `src/components/admin/product-form/AttributeStyleSection.tsx`

**Interfaces:**
- Consumes: `links: ProductTypeAttributeLink[]` (prop existente, ahora con `usageMode` poblado).
- Produces: sin cambio de firma de props — el componente sigue aceptando el mismo `links` completo y filtra internamente, para no tener que tocar `ClassificationSection.tsx` (que lo invoca).

- [ ] **Step 1: Filtrar `links` a solo `INFORMATIVE` antes de renderizar**

En `src/components/admin/product-form/AttributeStyleSection.tsx`, dentro del componente `AttributeStyleSection` (línea 35-41), agregar el filtro justo después de la desestructuración de props y antes de los early-returns:

```ts
export function AttributeStyleSection({
  control,
  productTypeId,
  links: allLinks,
  valuesByAttribute,
  loading,
}: AttributeStyleSectionProps) {
  // Solo los atributos en modo INFORMATIVE se editan aquí como valor único global —
  // los VARIANT se editan en AttributeMatrixSection (matriz cruzada por variante).
  const links = allLinks.filter((link) => link.usageMode !== 'VARIANT');

  if (!productTypeId) {
```

El resto del componente (early-returns de `loading`, `links.length === 0`, y el render final) queda igual — ya usa `links` como nombre de variable, así que no requiere más cambios.

- [ ] **Step 2: Actualizar `getMissingRequiredStyleAttributes` para el mismo filtro**

En el mismo archivo, la función exportada `getMissingRequiredStyleAttributes` (línea 15-20) se usa desde `ProductForm.tsx` o `ClassificationSection.tsx` para advertencias de campos requeridos — debe ignorar atributos `VARIANT` (su obligatoriedad se valida en la matriz, no en `styleAttributes`):

```ts
export function getMissingRequiredStyleAttributes(
  links: ProductTypeAttributeLink[],
  styleAttributes: Record<string, string>
): ProductTypeAttributeLink[] {
  return links.filter(
    (link) => link.usageMode !== 'VARIANT' && link.isRequired && !styleAttributes[link.attributeId]
  );
}
```

- [ ] **Step 3: Verificar con typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/product-form/AttributeStyleSection.tsx
git commit -m "feat(productos): excluir atributos VARIANT de la ficha General (viven en la matriz)"
```

---

### Task 4: `AttributeMatrixSection` cruza atributos `VARIANT` junto a color × talla

**Files:**
- Modify: `src/components/admin/product-form/AttributeMatrixSection.tsx`
- Modify: `src/components/admin/product-form/VariantsMediaSection.tsx` (paso de nuevas props)
- Modify: `src/components/admin/ProductForm.tsx` (paso de nuevas props a `VariantsMediaSection`)

**Interfaces:**
- Consumes: `attributeLinks: ProductTypeAttributeLink[]`, `valuesByAttribute: Record<string, AttributeValueOption[]>` (ambos ya cargados en `ProductForm.tsx` vía `useProductTypeAttributes`, mismo hook que ya alimenta `ClassificationSection`).
- Produces: `AttributeMatrixSection` ahora recibe `attributeLinks`/`valuesByAttribute` en vez de (o además de) `styleAttributes`, y `generateMatrix()` cruza color × talla × valores activos de cada atributo `VARIANT`. Cada variante generada lleva su propio `attributeValueIds` (no un valor global copiado).

- [ ] **Step 1: Extender las props de `AttributeMatrixSection`**

En `src/components/admin/product-form/AttributeMatrixSection.tsx`, reemplazar la interfaz de props (línea 20-44) agregando `attributeLinks` y `valuesByAttribute`, y actualizando el comentario de diseño que ya no aplica:

```ts
// ─── Decisión de diseño (revisión Fase Atributos-como-Variante) ───
// Los atributos del Tipo de Producto en modo INFORMATIVE (ej. Modelo de Terminado en
// Camisa) se siguen eligiendo una sola vez en General (`AttributeStyleSection`) y se
// propagan tal cual vía `styleAttributes`. Los atributos en modo VARIANT (ej. Modelo de
// Corte en Pantalón) ahora son un eje más de este generador: se cruzan junto a
// color × talla, y cada combinación genera su propia fila con su propio
// `attributeValueIds` — el comprador podrá elegir entre ellas en el storefront.

interface AttributeMatrixSectionProps {
  productTypeId: string | undefined;
  /** Marca activa del producto en edición — se propaga al modal de color para que el
   * color recién creado se auto-vincule a ella (picker filtrado estricto por marca),
   * previa confirmación del admin. */
  brandId?: string;
  brandName?: string;
  /** Valores de "Atributos (Estilos)" INFORMATIVE elegidos en General
   * (attributeId -> valueId) — se copian sin cambios a `attributeValueIds` de cada
   * variante generada, junto a los valores VARIANT seleccionados en este componente. */
  styleAttributes: Record<string, string>;
  /** Atributos asociados al tipo de producto (todos los modos) — se filtra aquí a
   * solo `usageMode === 'VARIANT'` para ofrecerlos como eje de la matriz. */
  attributeLinks: ProductTypeAttributeLink[];
  valuesByAttribute: Record<string, AttributeValueOption[]>;
  colors: Color[];
  /** Tallas activas del catálogo global (`/admin/atributos` → Tallas), ya
   * ordenadas — reemplaza la lista fija que existía antes. */
  sizes: string[];
  variantFields: ProductFormData['variants'][number][];
  appendVariant: (value: Omit<ProductFormData['variants'][number], 'id'> & { id?: string }) => void;
  /** Se dispara al asociar (existente o recién creado) un color desde el diálogo
   * "Asociar Color" — el llamador (`ProductForm`) lo agrega a la lista de colores
   * disponibles en todo el formulario, no solo aquí. */
  onColorCreated?: (color: Color) => void;
  /** Se dispara al terminar de generar la matriz con al menos una variante nueva —
   * el llamador (`VariantsMediaSection`) lo usa para expandir automáticamente la
   * sección "Configuración por Color" del primer color recién generado. */
  onMatrixGenerated?: (colorIds: string[]) => void;
}
```

Agregar el import del tipo `ProductTypeAttributeLink`/`AttributeValueOption` junto al import existente de `./schema` (línea 8):

```ts
import type { ProductFormData, Color, ProductTypeAttributeLink, AttributeValueOption } from './schema';
```

- [ ] **Step 2: Agregar estado de selección por atributo `VARIANT` y reescribir `generateMatrix`**

En el cuerpo del componente (línea 46-58), desestructurar las nuevas props y agregar estado:

```ts
export function AttributeMatrixSection({
  productTypeId,
  brandId,
  brandName,
  styleAttributes,
  attributeLinks,
  valuesByAttribute,
  colors,
  sizes,
  variantFields,
  appendVariant,
  onColorCreated,
  onMatrixGenerated,
}: AttributeMatrixSectionProps) {
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [associateColorOpen, setAssociateColorOpen] = useState(false);
  // Valores seleccionados por atributo VARIANT (attributeId -> array de valueIds
  // activados para esta matriz) — a diferencia de styleAttributes (un solo valor),
  // aquí se pueden marcar VARIOS valores porque cada uno se convierte en un eje
  // distinto de la matriz (ej. activar "Petite" y "Regular" genera variantes para
  // ambos, no solo uno).
  const [selectedVariantValueIds, setSelectedVariantValueIds] = useState<Record<string, string[]>>({});

  const variantAxisLinks = attributeLinks.filter((link) => link.usageMode === 'VARIANT');

  function toggleVariantValue(attributeId: string, valueId: string) {
    setSelectedVariantValueIds((prev) => {
      const current = prev[attributeId] ?? [];
      const next = current.includes(valueId)
        ? current.filter((v) => v !== valueId)
        : [...current, valueId];
      return { ...prev, [attributeId]: next };
    });
  }
```

Reemplazar `generateMatrix` (línea 81-121) para cruzar también los atributos `VARIANT`:

```ts
  function generateMatrix() {
    if (selectedColorIds.length === 0 || selectedSizes.length === 0) {
      toast.error('Selecciona al menos un color y una talla para generar la matriz');
      return;
    }

    const informativeValueIds = Object.values(styleAttributes).filter(Boolean);

    // Ejes VARIANT con al menos un valor activado — si un atributo VARIANT no tiene
    // ningún valor marcado en este generador, se omite del cruce (no bloquea la
    // generación de color×talla "planas" para ese eje).
    const variantAxes = variantAxisLinks
      .map((link) => selectedVariantValueIds[link.attributeId] ?? [])
      .filter((values) => values.length > 0);

    // Producto cartesiano de todos los ejes VARIANT activos. Si no hay ningún eje
    // VARIANT con valores seleccionados, `combinations` queda como `[[]]` (una sola
    // combinación vacía) — preserva el comportamiento original de solo color×talla.
    let combinations: string[][] = [[]];
    for (const axisValues of variantAxes) {
      combinations = combinations.flatMap((combo) =>
        axisValues.map((valueId) => [...combo, valueId])
      );
    }

    const existingKeys = new Set(
      variantFields.map((v) => `${v.colorId}|${v.size}|${[...(v.attributeValueIds ?? [])].sort().join(',')}`)
    );

    let created = 0;
    for (const colorId of selectedColorIds) {
      for (const size of selectedSizes) {
        for (const variantCombo of combinations) {
          const attributeValueIds = [...informativeValueIds, ...variantCombo];
          const key = `${colorId}|${size}|${[...attributeValueIds].sort().join(',')}`;
          if (existingKeys.has(key)) continue;
          existingKeys.add(key);
          // Si el color ya tiene variantes (ej. se agrega una talla nueva a un color
          // existente), hereda su `colorSortOrder` actual — evita que la nueva fila
          // "salte" al inicio del acordeón por quedar en 0 por defecto.
          const existingColorSortOrder = variantFields.find((v) => v.colorId === colorId)?.colorSortOrder ?? 0;
          appendVariant({
            colorId,
            size,
            sku: '',
            status: 'AVAILABLE',
            colorSortOrder: existingColorSortOrder,
            attributeValueIds,
          });
          created += 1;
        }
      }
    }

    if (created === 0) {
      toast.info('No se generaron variantes nuevas (todas las combinaciones ya existían)');
    } else {
      toast.success(`${created} variante(s) generada(s)`);
      onMatrixGenerated?.(selectedColorIds);
    }
  }
```

- [ ] **Step 3: Renderizar el selector de valores por cada atributo `VARIANT`**

En el JSX del componente, agregar un bloque nuevo entre la sección "Tallas" (línea 182-198) y el botón "Generar Matriz de Variantes" (línea 200-203):

```tsx
          {/* Ejes de atributos VARIANT (ej. Modelo de Corte) */}
          {variantAxisLinks.map((link) => {
            const options = valuesByAttribute[link.attributeId] ?? [];
            const selected = selectedVariantValueIds[link.attributeId] ?? [];
            if (options.length === 0) {
              return (
                <p key={link.attributeId} className="text-[11px] text-gray-400">
                  {link.attributeName}: sin valores activos configurados en{' '}
                  <a href="/admin/atributos" className="underline">Atributos</a>.
                </p>
              );
            }
            return (
              <div key={link.attributeId} className="space-y-2">
                <Label className="text-xs font-semibold text-gray-700">
                  {link.attributeName} <span className="text-gray-400 font-normal">(elige los valores a ofrecer)</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleVariantValue(link.attributeId, opt.id)}
                      className={`text-xs border rounded-full px-2.5 py-1 ${
                        selected.includes(opt.id) ? 'border-[#111111] bg-gray-100' : 'border-gray-200 bg-white'
                      }`}
                    >
                      {opt.value}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

```

- [ ] **Step 4: Propagar `attributeLinks`/`valuesByAttribute` desde `VariantsMediaSection`**

En `src/components/admin/product-form/VariantsMediaSection.tsx`, extender `VariantsMediaSectionProps` (línea 57-99) agregando:

```ts
  attributeLinks: ProductTypeAttributeLink[];
  valuesByAttribute: Record<string, AttributeValueOption[]>;
```

(agregar el import correspondiente de `./schema` si no está ya presente en el archivo — verificar con `grep -n "^import" src/components/admin/product-form/VariantsMediaSection.tsx` antes de editar, para no duplicar imports).

Desestructurar ambas props en la firma del componente (línea 139-160) y pasarlas al `<AttributeMatrixSection>` (línea 504-515):

```tsx
      <AttributeMatrixSection
        productTypeId={productTypeId}
        brandId={brandId}
        brandName={brandName}
        styleAttributes={styleAttributes}
        attributeLinks={attributeLinks}
        valuesByAttribute={valuesByAttribute}
        colors={colors}
        sizes={sizes}
        variantFields={variantFields}
        appendVariant={appendVariant}
        onColorCreated={onColorCreated}
        onMatrixGenerated={(colorIds) => colorIds[0] && setExpandedColorId(colorIds[0])}
      />
```

- [ ] **Step 5: Propagar `attributeLinks`/`valuesByAttribute` desde `ProductForm.tsx`**

En `src/components/admin/ProductForm.tsx`, en ambos call-sites de `<VariantsMediaSection>` (línea 1030-1056 dentro del wizard mobile, y línea 1220-1247 dentro del tab desktop), agregar las dos props nuevas:

```tsx
                <VariantsMediaSection
                  control={control}
                  register={register}
                  watch={watch}
                  setValue={setValue}
                  colors={colors}
                  sizes={sizes}
                  codeMissing={codeMissing}
                  productTypeId={productTypeIdValue}
                  brandId={brandIdValue}
                  brandName={brandNameValue}
                  styleAttributes={styleAttributesValue}
                  attributeLinks={attributeLinks}
                  valuesByAttribute={valuesByAttribute}
                  variantFields={variantFields}
                  appendVariant={appendVariant}
                  removeVariant={removeVariant}
                  imageFields={imageFields}
                  removeImage={removeImage}
                  variantsErrors={errors.variants}
                  formErrors={errors}
                  onColorCreated={handleColorCreated}
                  onPickTarget={(target, colorId) => {
                    setPickerTargetIndex(target);
                    if (colorId) setPickerColorId(colorId);
                  }}
                />
```

(`attributeLinks` y `valuesByAttribute` ya existen como variables en `ProductForm.tsx` desde el `useProductTypeAttributes` de la línea 355-356 — no requieren fetch nuevo, solo pasarlas hacia abajo).

- [ ] **Step 6: Verificación manual en navegador**

Con `npm run dev` corriendo:
1. Ir a `/admin/tipos-producto`, confirmar que el tipo "Pantalón" (o el que corresponda) tiene un atributo (ej. "Modelo de corte") en modo `VARIANT` con al menos 2 valores activos en `/admin/atributos`.
2. Ir a `/admin/productos/nuevo` (o editar un producto existente de ese tipo), llegar a la pestaña "Variantes y Medios".
3. Confirmar que el generador de matriz muestra el bloque "Modelo de corte (elige los valores a ofrecer)" con botones por cada valor activo.
4. Seleccionar 1 color, 1 talla, y 2 valores del atributo VARIANT (ej. "Regular" y "Slim"). Click en "Generar Matriz de Variantes".
5. Expected: se generan **2 variantes** (mismo color+talla, un `attributeValueIds` distinto cada una) — no 1.
6. Guardar el producto. Recargar la ficha de edición. Confirmar que ambas variantes persisten con sus valores de atributo distintos (revisar en la sección de variantes, o confirmar indirectamente vía la columna "Atributos" de `/admin/productos` que ahora debería mostrar ambos valores del atributo agregados).

Expected: comportamiento descrito arriba, sin errores en consola.

- [ ] **Step 7: Verificar con typecheck, lint y build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

Run: `npx eslint src/components/admin/product-form/AttributeMatrixSection.tsx src/components/admin/product-form/VariantsMediaSection.tsx src/components/admin/ProductForm.tsx`
Expected: sin salida.

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/product-form/AttributeMatrixSection.tsx src/components/admin/product-form/VariantsMediaSection.tsx src/components/admin/ProductForm.tsx
git commit -m "feat(productos): cruzar atributos VARIANT en el generador de matriz color x talla"
```

---

## Fin de Fase 2

Al completar las 4 tareas: el admin puede marcar cualquier asociación tipo-de-producto↔atributo como "Variante" desde `/admin/tipos-producto`, y al armar la matriz de un producto de ese tipo, cada valor activado de ese atributo genera su propia fila de variante — persistida vía el mecanismo `variant_attribute_values` ya existente, sin cambios de schema adicionales. Los atributos `INFORMATIVE` siguen funcionando exactamente igual que antes de esta fase. La Fase 3 (PDP retail) y Fase 4 (PDP corporativo + carrito/cotización) se planean por separado y son las que hacen que el comprador pueda efectivamente elegir entre estas variantes en el storefront.

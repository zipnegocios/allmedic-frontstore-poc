# Tipografía y color swatches en cards de sets corporativos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Propagar los tokens tipográficos ya definidos en `tailwind.config.js` (usados hoy en `ProductCard.tsx`) a las dos cards de listado de sets corporativos, y agregar swatches de color interactivos que cambian la portada mostrada.

**Architecture:** Cambio puramente presentacional sobre dos client components ya existentes (`SetGridCard` inline en `CorporativoContent.tsx`, y `SetListItem.tsx`). Se reutiliza el componente `ColorSwatch` ya existente y el hook de estado/portada (`resolveCardCover`) ya usado por el filtro lateral — no se toca el schema, la query de datos, ni tipos.

**Tech Stack:** Next.js (App Router), React client components, Tailwind CSS, TypeScript. Sin librería de testing de componentes en este repo (la suite `vitest` del proyecto cubre solo lógica pura en `.test.ts`); verificación vía build/lint/typecheck + checklist manual, según spec.

## Global Constraints

- No se modifica `ColorSwatch.tsx`, `corporate-data-service.ts`, `corporate-types.ts`, ni el schema Drizzle (spec, sección "Archivos a modificar" / "Fuera de alcance").
- No se corrige la agregación de colores en modo `MIXED` (deuda documentada, fuera de alcance — spec, "Decisiones cerradas" punto 2).
- Alcance de tipografía: solo `font-sans` + tokens `body-*`/`tracking-badge`; no se tocan headings display, colores, ni layout más allá de lo que exige el cambio (spec, "Decisiones cerradas" punto 1).
- Swatches: máximo 5 visibles + contador `+N`, solo si `set.colors.length > 1` (spec, "Decisiones cerradas" punto 3).
- Swatches interactivos: click cambia la portada vía `resolveCardCover(set, activeColorId)`, con `preventDefault`/`stopPropagation` para no disparar el `<Link>` envolvente (spec, "Decisiones cerradas" punto 4).
- La selección de color del filtro lateral (`CorporativoContent`) debe primar sobre la selección local del swatch de la card, con el mismo patrón de sincronización "durante el render" (sin `useEffect`) que usa `ProductCard.tsx:38-46` (spec, sección "Swatches — comportamiento").
- Prohibido: `git commit`, `git push`, creación de PRs (CLAUDE.md del repo) — el trabajo queda en el working tree; al final se sugiere el mensaje de commit.
- No usar Chrome DevTools MCP para ninguna verificación (CLAUDE.md del repo).

---

## Contexto de archivos (no modificar, solo consumir)

**`src/components/catalog/ColorSwatch.tsx`** — ya existe, no se toca:
```tsx
interface ColorSwatchProps {
  color: ProductColor;
  isSelected?: boolean;
  isAvailable?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}
export function ColorSwatch({ color, isSelected, isAvailable, onClick, size, showTooltip }: ColorSwatchProps): JSX.Element
```

**`src/lib/resolve-card-cover.ts`** — ya existe, no se toca. Firma usada por ambas cards hoy:
```ts
function resolveCardCover(set: CorporateSetSummary, activeColorId: string | null): {
  cover: MediaItem | null;
  secondaryCover: MediaItem | null;
  isFallback: boolean;
}
```

**`src/lib/types.ts`** — `ProductColor` (no se toca):
```ts
export interface ProductColor {
  id: string;
  name: string;
  code: string;
  hex: string;
  kind: 'SOLID' | 'PATTERN';
  swatchUrl: string | null;
}
```

**`src/lib/corporate-types.ts`** — `CorporateSetSummary.colors: ProductColor[]` ya existe y ya llega a ambos componentes de card (no se toca).

---

### Task 1: Tipografía + swatches en `SetGridCard` (vista grid del catálogo de sets)

**Files:**
- Modify: `src/app/(store)/corporativo/CorporativoContent.tsx:29-122` (función `SetGridCard`)

**Interfaces:**
- Consumes: `ColorSwatch` (`src/components/catalog/ColorSwatch.tsx`), `resolveCardCover` (`src/lib/resolve-card-cover.ts`), `ProductColor` (`src/lib/types.ts`) — ya importados o importables sin cambios de firma.
- Produces: ningún export nuevo — `SetGridCard` sigue siendo función local no exportada, misma prop interface (`{ set: CorporateSetSummary; activeColorId: string | null; showPrices: boolean }`).

Este componente ya recibe `activeColorId` desde el padre (filtro lateral global). La card necesita distinguir entre "color activo por filtro global" y "color elegido localmente al clickear un swatch dentro de la card", con el filtro global primando si cambia.

- [ ] **Step 1: Añadir estado local de color y sincronización con la prop externa**

En `src/app/(store)/corporativo/CorporativoContent.tsx`, dentro de `SetGridCard` (después de la declaración de `isImageLoading`/`trackedCoverUrl`, antes del `return`), reemplazar el uso directo de la prop `activeColorId` en `resolveCardCover` por un estado local sincronizado:

```tsx
// Color elegido al clickear un swatch dentro de esta card. Si el filtro lateral
// (prop activeColorId) cambia, debe primar sobre la selección local — mismo patrón
// "durante el render" que ProductCard.tsx:38-46 (sin useEffect, evita el render
// en cascada de un setState síncrono dentro de un efecto).
const [localColorId, setLocalColorId] = useState<string | null>(activeColorId);
const [trackedFilterColor, setTrackedFilterColor] = useState(activeColorId);
if (activeColorId !== trackedFilterColor) {
  setTrackedFilterColor(activeColorId);
  setLocalColorId(activeColorId);
}

const effectiveColorId = localColorId;
const { cover, secondaryCover, isFallback } = resolveCardCover(set, effectiveColorId);
const fallbackColor = isFallback ? set.colors.find((c) => c.id === effectiveColorId) : undefined;
```

Eliminar la línea existente `const { cover, secondaryCover, isFallback } = resolveCardCover(set, activeColorId);` y `const fallbackColor = isFallback ? set.colors.find((c) => c.id === activeColorId) : undefined;` (quedan reemplazadas por el bloque de arriba).

- [ ] **Step 2: Aplicar tokens tipográficos al bloque de info**

Reemplazar el bloque `<div className="p-4">...</div>` (líneas ~99-118 actuales) por:

```tsx
<div className="p-4">
  {set.brandName && (
    <p className="font-sans text-body-sm uppercase tracking-badge text-gray-400 mb-1">{set.brandName}</p>
  )}
  <h3 className="font-sans text-body-md font-normal text-[#111111] mb-1">{set.name}</h3>
  <p className="font-sans text-body-sm text-gray-500 mb-3">
    {set.pieceCount} {set.pieceCount === 1 ? 'pieza' : 'piezas'}
  </p>
  {showPrices &&
    (set.referencePrice !== null ? (
      <div>
        <span className="font-sans text-body-md font-medium text-[#111111]">${set.referencePrice.toFixed(2)}</span>
        <span className="font-sans text-body-xs text-gray-400 ml-1">/ set referencial</span>
        {set.hasMissingPrices && (
          <span className="flex items-center gap-1 font-sans text-body-xs text-amber-600 mt-1">
            <AlertTriangle className="w-3 h-3" /> Precio parcial
          </span>
        )}
      </div>
    ) : (
      <span className="font-sans text-body-sm text-gray-400">Precio bajo cotización</span>
    ))}
  {set.colors.length > 1 && (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {set.colors.slice(0, 5).map(color => (
        <div
          key={color.id}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setLocalColorId(color.id);
          }}
        >
          <ColorSwatch color={color} size="sm" isSelected={effectiveColorId === color.id} />
        </div>
      ))}
      {set.colors.length > 5 && (
        <span className="font-sans text-body-xs text-gray-400 flex items-center">
          +{set.colors.length - 5}
        </span>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 3: Añadir el import de `ColorSwatch`**

En la cabecera de `src/app/(store)/corporativo/CorporativoContent.tsx`, junto a los demás imports de `@/components/catalog/*`:

```tsx
import { ColorSwatch } from '@/components/catalog/ColorSwatch';
```

- [ ] **Step 4: Typecheck y lint del archivo modificado**

Run: `npx tsc --noEmit` (o el script de typecheck del proyecto si existe uno específico — revisar `package.json` con `grep typecheck package.json` antes de correr)
Expected: sin errores nuevos relacionados a `CorporativoContent.tsx`.

Run: `npm run lint`
Expected: sin errores nuevos en `src/app/(store)/corporativo/CorporativoContent.tsx`.

- [ ] **Step 5: Commit**

No ejecutar el commit — solo dejar el mensaje sugerido al final de la tarea (regla del proyecto: nunca `git commit` automático). Mensaje sugerido:

```
feat(catalog): aplicar tokens tipograficos y agregar swatches de color a SetGridCard
```

---

### Task 2: Tipografía + swatches en `SetListItem` (vista lista del catálogo de sets)

**Files:**
- Modify: `src/components/catalog/SetListItem.tsx` (completo)

**Interfaces:**
- Consumes: `ColorSwatch` (`src/components/catalog/ColorSwatch.tsx`), `resolveCardCover` (ya importado), `ProductColor` (implícito vía `CorporateSetSummary.colors`).
- Produces: mismo export `SetListItem`, misma prop interface (`SetListItemProps`) sin cambios de firma pública.

- [ ] **Step 1: Añadir estado local de color y sincronización con `activeColorId` prop**

En `src/components/catalog/SetListItem.tsx`, después de la declaración de `isImageLoading`/`trackedCoverUrl` (línea ~28-33 actual), añadir el mismo patrón de sincronización que en Task 1:

```tsx
// Color elegido al clickear un swatch dentro de esta card. Si el filtro lateral
// (prop activeColorId) cambia, debe primar sobre la selección local — mismo patrón
// "durante el render" que ProductCard.tsx:38-46 (sin useEffect).
const [localColorId, setLocalColorId] = useState<string | null>(activeColorId);
const [trackedFilterColor, setTrackedFilterColor] = useState(activeColorId);
if (activeColorId !== trackedFilterColor) {
  setTrackedFilterColor(activeColorId);
  setLocalColorId(activeColorId);
}

const effectiveColorId = localColorId;
```

Reemplazar la línea existente `const { cover, secondaryCover, isFallback } = resolveCardCover(set, activeColorId);` por:

```tsx
const { cover, secondaryCover, isFallback } = resolveCardCover(set, effectiveColorId);
```

Y `const fallbackColor = isFallback ? set.colors.find((c) => c.id === activeColorId) : undefined;` por:

```tsx
const fallbackColor = isFallback ? set.colors.find((c) => c.id === effectiveColorId) : undefined;
```

Nota de orden: el bloque de `localColorId`/sincronización debe declararse **antes** de estas dos líneas, ya que ambas dependen de `effectiveColorId`.

- [ ] **Step 2: Aplicar tokens tipográficos al bloque de info**

Reemplazar el contenido de `<div className="flex-1 min-w-0 flex flex-col">...</div>` (líneas ~75-109 actuales) por:

```tsx
<div className="flex-1 min-w-0 flex flex-col">
  <div className="flex-1">
    {set.brandName && (
      <p className="font-sans text-body-sm uppercase tracking-badge text-gray-400 mb-1">{set.brandName}</p>
    )}
    <h3 className="font-sans text-body-md font-normal text-[#111111] mb-1 group-hover:underline line-clamp-2">
      {set.name}
    </h3>
    <p className="font-sans text-body-sm text-gray-500">
      {set.pieceCount} {set.pieceCount === 1 ? 'pieza' : 'piezas'}
    </p>
    {set.colors.length > 1 && (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {set.colors.slice(0, 5).map(color => (
          <div
            key={color.id}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setLocalColorId(color.id);
            }}
          >
            <ColorSwatch color={color} size="sm" isSelected={effectiveColorId === color.id} />
          </div>
        ))}
        {set.colors.length > 5 && (
          <span className="font-sans text-body-xs text-gray-400 flex items-center">
            +{set.colors.length - 5}
          </span>
        )}
      </div>
    )}
  </div>

  <div className="flex items-center justify-between mt-3">
    {showPrices ? (
      set.referencePrice !== null ? (
        <div>
          <span className="font-sans text-body-md font-medium text-[#111111]">${set.referencePrice.toFixed(2)}</span>
          <span className="font-sans text-body-xs text-gray-400 ml-1">/ set referencial</span>
          {set.hasMissingPrices && (
            <span className="flex items-center gap-1 font-sans text-body-xs text-amber-600 mt-1">
              <AlertTriangle className="w-3 h-3" /> Precio parcial
            </span>
          )}
        </div>
      ) : (
        <span className="font-sans text-body-sm text-gray-400">Precio bajo cotización</span>
      )
    ) : (
      <span />
    )}

    <span className="px-4 py-2 bg-[#111111] text-white text-sm font-medium rounded-full group-hover:opacity-80 transition-opacity">
      Ver set
    </span>
  </div>
</div>
```

Nota: el botón "Ver set" conserva `text-sm font-medium` sin cambios — es un CTA con fondo sólido, fuera de la jerarquía de texto plano que este cambio normaliza (spec, sección "Mapeo tipográfico", nota final).

- [ ] **Step 3: Añadir el import de `ColorSwatch`**

En la cabecera de `src/components/catalog/SetListItem.tsx`:

```tsx
import { ColorSwatch } from '@/components/catalog/ColorSwatch';
```

- [ ] **Step 4: Typecheck y lint del archivo modificado**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `SetListItem.tsx`.

Run: `npm run lint`
Expected: sin errores nuevos en `src/components/catalog/SetListItem.tsx`.

- [ ] **Step 5: Commit**

No ejecutar — solo mensaje sugerido:

```
feat(catalog): aplicar tokens tipograficos y agregar swatches de color a SetListItem
```

---

### Task 3: Validación completa del proyecto y checklist manual

**Files:** ninguno (solo validación).

**Interfaces:** N/A.

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build exitoso, sin errores de tipo ni de compilación relacionados a los archivos modificados.

- [ ] **Step 2: Lint completo**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Test suite**

Run: `npm run test`
Expected: todos los tests existentes siguen en verde (este cambio no toca ninguna lógica cubierta por la suite `.test.ts` actual — no se esperan tests nuevos ni fallos).

- [ ] **Step 5: Checklist manual (levantar `npm run dev` y revisar `/corporativo`)**

Verificar en navegador (sin Chrome DevTools MCP — prohibido por CLAUDE.md; usar el navegador normal del usuario):

- [ ] Vista grid: cards de sets muestran tipografía consistente con `ProductCard` (mismo tamaño/tracking en marca, nombre, precio).
- [ ] Vista lista: mismo mapeo tipográfico aplicado.
- [ ] Sets con más de 1 color: swatches visibles (máx. 5 + contador `+N` si corresponde).
- [ ] Click en un swatch cambia la portada mostrada al color elegido, sin navegar a la página del set.
- [ ] Cambiar el filtro lateral de color (`SetFilterSidebar`) sigue funcionando y prima sobre cualquier selección hecha con un swatch dentro de una card individual.
- [ ] Sets con un solo color: no se renderiza el bloque de swatches (comportamiento actual preservado).
- [ ] Admin (`/admin`) sin cambios visuales — no se tocó ningún archivo de esa área.

- [ ] **Step 6: Commit final (sugerido, no ejecutar)**

Si se prefiere un solo commit para ambas tareas en vez de dos separados:

```
feat(catalog): tipografia y color swatches en cards de sets corporativos

Propaga los tokens tipograficos ya definidos en tailwind.config.js
(usados en ProductCard) a SetGridCard y SetListItem, y agrega swatches
de color interactivos reutilizando ColorSwatch y resolveCardCover.
```

---

## Self-Review (completado por el autor del plan)

- **Cobertura de spec:** tipografía (Task 1 Step 2, Task 2 Step 2) ✓; swatches con truncamiento a 5 + contador (Task 1 Step 2, Task 2 Step 2) ✓; interactividad con `preventDefault`/`stopPropagation` (ambas tasks) ✓; sincronización filtro-global-prima-sobre-local (Task 1 Step 1, Task 2 Step 1) ✓; sin cambios de schema/query/tipos (ningún task los toca) ✓; deuda de agregación MIXED documentada como fuera de alcance (Global Constraints) ✓.
- **Placeholders:** ninguno — todo el código de cada step está completo y es pegable tal cual.
- **Consistencia de tipos:** `ColorSwatchProps`, `resolveCardCover`, `ProductColor`, `CorporateSetSummary` usados idénticamente a como están definidos hoy en el repo (no se inventan campos ni firmas nuevas). `effectiveColorId`/`localColorId` se nombran igual en ambas tasks.

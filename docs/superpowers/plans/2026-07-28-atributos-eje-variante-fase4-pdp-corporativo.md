# Atributos EAV como eje de variante — Fase 4: PDP Corporativo (Armador de Sets) + Carrito/Cotización — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un selector de atributo EAV en modo `VARIANT` (ej. "Modelo de corte") debajo del selector de talla de cada pieza en el armador de sets corporativo (`/corporativo/s/[slug]`, `SetDetailContent.tsx`), obligatorio igual que la talla, y propagar esa selección de forma sólida por todo el carrito corporativo y el flujo de cotización — sin perderla en el reload (localStorage) ni en el servidor (Zod strip).

**Architecture:** Se extiende el patrón de texto ya existente en `pieceSelections` (`{productId, size?, color?}` → `{productId, size?, color?, styles?: Record<string,string>}`), tal como se decidió en el spec — sin migrar a `variantId`. El campo es JSONB de punta a punta (cart y quote), así que no requiere migración de base de datos. El riesgo principal no es de datos sino de **puntos de fuga**: `migrateLine` (reconstruye objetos campo por campo en cada hidratación) y los schemas Zod de las dos rutas API (que descartan claves desconocidas por defecto) — ambos deben tocarse explícitamente o el atributo se pierde silenciosamente.

**Tech Stack:** Next.js 15 App Router (client components + API routes), React Context, Zod.

## Global Constraints

- Nunca ejecutar `git commit`, `git push`, ni crear PRs/Releases — solo sugerir el mensaje de commit al final.
- Requiere Fase 1 y Fase 2 completas.
- **No migrar a `variantId`** — decisión explícita del spec, mantener el patrón de texto.
- El campo nuevo se llama `styles?: Record<string, string>` (slug de atributo → valor), igual nomenclatura que `Product.availableStyles`/`CartItem.styles` de la Fase 3, para consistencia entre retail y corporativo.
- Todo objeto `pieceSelections[]` construido en cualquier punto del código debe usar el mismo orden de claves (`{ productId, size, color, styles }`) — `lineKey()` en `CorporateCartContext.tsx` es `JSON.stringify(pieceSelections)`, sensible al orden de claves.
- Validar con build + lint + typecheck al final.

---

### Task 1: Tipos compartidos — `PieceSelection` y disponibilidad de valores por pieza

**Files:**
- Modify: `src/lib/corporate-types.ts` (`SetPiece`)
- Create: nada nuevo — se extiende el tipo existente.

**Interfaces:**
- Produces: `SetPiece.availableStyles: Record<string, string[]>` (agregado de `variants[].styles` de esa pieza, mismo patrón que `Product.availableStyles` en retail). `SetPiece.styleLabels: Record<string, string>` (slug → nombre legible, mismo patrón que la Fase 3 Task 4).

- [ ] **Step 1: Confirmar que `SetPiece.variants` ya trae `styles` poblado**

Antes de editar, verificar en `src/lib/corporate-data-service.ts` (función que arma `SetPiece`, ya confirmada en investigación previa: línea ~585 mapea `styles: payload?.styles ?? {}` igual que retail) que efectivamente cada variante de cada pieza ya trae su `styles: Record<string,string>` poblado. Si es así (esperado, sin cambios de query necesarios), continuar al Step 2.

- [ ] **Step 2: Agregar `availableStyles`/`styleLabels` a `SetPiece`**

En `src/lib/corporate-types.ts`, extender la interfaz `SetPiece` (línea 5-20):

```ts
export interface SetPiece {
  /** Id de la fila `set_block_options` (opción de bloque) o `set_recommended_items` según el
   * arreglo donde aparezca esta pieza — no hay más un `set_items.id` único. */
  setItemId: string;
  productId: string;
  productName: string;
  productSlug: string;
  /** Presente solo en piezas que son opción de un bloque (ausente en `recommendedPieces`,
   * que no tienen cantidad propia — la cantidad la define el cliente en la PDP). */
  quantityPerSet?: number;
  priceWholesale: number | null;
  priceWholesaleSale: number | null;
  colors: ProductColor[];
  availableSizes: string[];
  /** Agregado EAV de `variants[].styles` de esta pieza (slug de atributo → valores únicos
   * presentes) — mismo patrón que `Product.availableStyles` en retail. Vacío `{}` si la
   * pieza no tiene ningún atributo en modo VARIANT. */
  availableStyles: Record<string, string[]>;
  /** Nombre legible de cada atributo en `availableStyles` (slug → nombre) — evita mostrar
   * el slug crudo en el selector de la PDP. */
  styleLabels: Record<string, string>;
  variants: ProductVariant[];
}
```

- [ ] **Step 3: Poblar los campos nuevos en `corporate-data-service.ts`**

Localizar la función que construye cada `SetPiece` (donde hoy se calcula `availableSizes: Array.from(sizeSet)`, según la investigación, línea ~600) y agregar el mismo agregado que `transformProduct` hace en `data-service.ts` (Fase 3, ya implementado ahí — reutilizar la misma lógica: iterar `mappedVariants`, acumular `payload.styles` en un `Map<string, Set<string>>`, convertir a `Record<string,string[]>`). Reutilizar también la resolución de `styleLabels` implementada en la Fase 3 Task 4 (mismo join/consulta a `attributes` por slug, o extraer un helper compartido si el código ya está en `data-service.ts` y es reutilizable desde aquí — evaluar en el momento si conviene extraer `buildStyleAggregates(variants)` a un módulo común en vez de duplicar).

- [ ] **Step 4: Verificar con typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: errores en cualquier código que construya un `SetPiece` sin los campos nuevos (deben completarse en el Step 3, no dejarse pendientes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/corporate-types.ts src/lib/corporate-data-service.ts
git commit -m "feat(corporativo): agregar availableStyles/styleLabels a SetPiece"
```

---

### Task 2: Estado y UI en `SetDetailContent.tsx` — selector debajo de talla, por pieza

**Files:**
- Modify: `src/app/(store)/corporativo/s/[slug]/SetDetailContent.tsx`

**Interfaces:**
- Consumes: `SetPiece.availableStyles`/`styleLabels` (Task 1).
- Produces: estado `stylesA: Record<string,string>` / `stylesB: Record<string,string>`; `currentSelectionsArray()` ahora incluye `styles` por pieza.

- [ ] **Step 1: Agregar estado `stylesA`/`stylesB` junto a `sizeA`/`sizeB`**

En `SetDetailContent.tsx`, junto a la declaración existente (línea 94-95):

```ts
  const [sizeA, setSizeA] = useState<string | undefined>(undefined);
  const [sizeB, setSizeB] = useState<string | undefined>(undefined);
  const [stylesA, setStylesA] = useState<Record<string, string>>({});
  const [stylesB, setStylesB] = useState<Record<string, string>>({});
```

- [ ] **Step 2: Resetear `stylesA`/`stylesB` al cambiar de pieza**

En `selectPieceA` (línea 127-131) y `selectPieceB` (línea 147-151), agregar el reset:

```ts
  function selectPieceA(productId: string) {
    setChoiceAId(productId);
    setSizeA(undefined);
    setStylesA({});
    setFocus({ side: 'A', index: 0 });
    setOffsetA(0);
    // ... resto sin cambios
  }
```

(mismo patrón en `selectPieceB` con `setStylesB({})`).

- [ ] **Step 3: Extender `CombinationRow` y `currentSelectionsArray()`**

Reemplazar el tipo local (línea 32-36):

```ts
interface CombinationRow {
  id: string;
  quantity: number;
  pieceSelections: Array<{ productId: string; size?: string; color?: string; styles?: Record<string, string> }>;
}
```

Reemplazar `currentSelectionsArray()` (línea 215-220):

```ts
  function currentSelectionsArray() {
    return [
      { productId: pieceA.productId, size: sizeA, color: colorForPiece(pieceA.productId), styles: stylesA },
      { productId: pieceB.productId, size: sizeB, color: colorForPiece(pieceB.productId), styles: stylesB },
    ];
  }
```

Nota de orden de claves: `{ productId, size, color, styles }` — este orden debe repetirse en Task 3 (`CorporateCartContext.tsx`, `migrateLine`) y en cualquier otro punto que construya un objeto de selección "desde cero", para no romper `lineKey()` (`JSON.stringify` es sensible a orden de inserción de claves).

- [ ] **Step 4: Gate de obligatoriedad — `comboReady` y `handleAddCombination`**

Extender `comboReady` (línea 222-226) para exigir que, si una pieza tiene ejes `VARIANT` disponibles, todos estén elegidos:

```ts
  function pieceStylesReady(piece: SetPiece, styles: Record<string, string>): boolean {
    return Object.keys(piece.availableStyles).every((slug) => Boolean(styles[slug]));
  }

  const comboReady = Boolean(
    (!isPaired || pairedColorOptions.length === 0 || pairedColor) &&
    (!isMixed || set.colorCombos.length === 0 || selectedComboId) &&
    (!showsSizes || (sizeA && sizeB)) &&
    pieceStylesReady(pieceA, stylesA) &&
    pieceStylesReady(pieceB, stylesB)
  );
```

Extender `handleAddCombination` (línea 230-251) con un guard explícito, después del guard de tallas (línea 244-247):

```ts
    const pieceSelections = currentSelectionsArray();
    if (showsSizes && pieceSelections.some((s) => !s.size)) {
      toast.error('Selecciona la talla de cada pieza.');
      return;
    }
    if (!pieceStylesReady(pieceA, stylesA) || !pieceStylesReady(pieceB, stylesB)) {
      toast.error('Selecciona las opciones de estilo de cada pieza.');
      return;
    }
    setRows((prev) => [...prev, { id: newRowId(), quantity, pieceSelections }]);
```

- [ ] **Step 5: Componente `StyleAxisRow` — mirror de `SizeRow`**

Junto a `SizeRow` (línea 757-801), agregar un componente nuevo que renderiza un bloque por cada eje de `piece.availableStyles`:

```tsx
function StyleAxisRow({
  piece,
  styles,
  onStyleChange,
}: {
  piece: SetPiece;
  styles: Record<string, string>;
  onStyleChange: (slug: string, value: string) => void;
}) {
  const axes = Object.entries(piece.availableStyles).filter(([, values]) => values.length > 0);
  if (axes.length === 0) return null;
  return (
    <div className="space-y-2">
      {axes.map(([slug, values]) => (
        <div key={slug} className="flex flex-wrap items-center gap-2">
          <span className="font-sans text-body-sm text-gray-500 mr-1">
            {piece.styleLabels[slug] ?? slug}:
          </span>
          {values.map((value) => {
            const isSelected = styles[slug] === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onStyleChange(slug, value)}
                className={cn(
                  'px-2.5 h-7 text-xs rounded-full border transition-colors',
                  isSelected ? 'bg-[#111111] text-white border-[#111111]' : 'border-[#E5E5E5] text-[#111111] hover:border-[#111111] bg-white'
                )}
              >
                {value}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

(estilo de botón pill tomado de `RecommendedSection`, línea ~1036-1039, identificado en la investigación como mejor ajuste visual que el estilo circular de `SizeRow` para etiquetas de largo variable como "Recto"/"Jogger").

- [ ] **Step 6: Insertar `StyleAxisRow` debajo de `SizeRow` en las 4 ubicaciones**

En los 4 puntos de inserción identificados (copia "paired", líneas 416-418 y 427-429; copia "no-paired", líneas 484-486 y 495-497), agregar `StyleAxisRow` inmediatamente después de cada `SizeRow`:

Para el bloque A (ambas copias):
```tsx
                {showsSizes && (
                  <SizeRow piece={pieceA} size={sizeA} onSize={setSizeA} statuses={sizeStatusesFor(pieceA)} />
                )}
                <StyleAxisRow piece={pieceA} styles={stylesA} onStyleChange={(slug, value) => setStylesA((prev) => ({ ...prev, [slug]: value }))} />
```

Para el bloque B (ambas copias):
```tsx
                {showsSizes && (
                  <SizeRow piece={pieceB} size={sizeB} onSize={setSizeB} statuses={sizeStatusesFor(pieceB)} />
                )}
                <StyleAxisRow piece={pieceB} styles={stylesB} onStyleChange={(slug, value) => setStylesB((prev) => ({ ...prev, [slug]: value }))} />
```

(`StyleAxisRow` ya retorna `null` internamente si la pieza no tiene ejes — no hace falta envolver con una condición adicional en el JSX padre).

- [ ] **Step 7: Actualizar `CompositionCard`/`CompositionLine` y el resumen de filas armadas**

En `CompositionLine` (línea ~823), agregar los estilos elegidos a la cadena de composición — requiere pasar `stylesA`/`stylesB` como props nuevas de `CompositionCard` (línea ~525-535), igual patrón que `sizeA`/`sizeB` ya se pasan hoy. El string de línea 823 pasa de:

```ts
{quantityPerSet}× {piece.productName} {colorName ? `(${colorName}${size ? `, ${size}` : ''})` : ''}
```

a incluir los valores de `styles` de esa pieza, apendeados de forma similar (revisar el componente completo al momento de editar para mantener el formato existente coherente, sin inventar un formato nuevo sin verlo primero).

En el resumen de "Combinaciones armadas" (línea 928-933), extender:

```ts
                    {row.pieceSelections
                      .map((s) => {
                        const styleValues = Object.values(s.styles ?? {});
                        const parts = [s.size, s.color, ...styleValues].filter(Boolean).join(' / ');
                        return `${pieceLabelFor(s.productId)}${parts ? ` (${parts})` : ''}`;
                      })
                      .join(' + ')}
```

- [ ] **Step 8: Verificar con typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores relacionados a este archivo (pueden persistir errores no relacionados de otras fases pendientes de otros planes).

- [ ] **Step 9: Commit**

```bash
git add "src/app/(store)/corporativo/s/[slug]/SetDetailContent.tsx"
git commit -m "feat(corporativo): agregar selector de atributos VARIANT debajo de talla en el armador de sets"
```

---

### Task 3: Carrito corporativo — tipo, dedup, y el punto de fuga de `migrateLine`

**Files:**
- Modify: `src/context/CorporateCartContext.tsx`

**Interfaces:**
- Produces: `CorporateCartLine.pieceSelections[].styles?: Record<string, string>` persistido correctamente a través de hidratación desde localStorage y merge de login.

- [ ] **Step 1: Extender `CorporateCartLine`**

En `src/context/CorporateCartContext.tsx`, línea 17-22:

```ts
export interface CorporateCartLine {
  id: string;
  quantity: number;
  /** Una entrada por pieza del set — talla ausente en sets NO_SIZES, color siempre opcional,
   * styles presente solo si la pieza tiene atributos EAV en modo VARIANT. */
  pieceSelections: Array<{ productId: string; size?: string; color?: string; styles?: Record<string, string> }>;
}
```

- [ ] **Step 2: CRÍTICO — actualizar `migrateLine` para no descartar `styles`**

Este es el punto de mayor riesgo identificado en la investigación: `migrateLine` corre en **cada** hidratación (localStorage y fetch de servidor), no solo para carritos legacy, y reconstruye cada objeto de selección campo por campo — cualquier campo no copiado explícitamente se pierde en cada reload.

Reemplazar (línea 76-107):

```ts
interface LegacyCorporateCartLine {
  id?: string;
  size?: string;
  color?: string;
  pieceSelections?: Array<{ productId: string; size: string; styles?: Record<string, string> }>;
  quantity: number;
}

function migrateLine(item: { pieces?: SetPieceInfo[] }, raw: LegacyCorporateCartLine): CorporateCartLine {
  if (raw.pieceSelections && raw.pieceSelections.length > 0) {
    return {
      id: raw.id ?? lineId(),
      quantity: raw.quantity,
      pieceSelections: raw.pieceSelections.map((s) => ({
        productId: s.productId,
        size: s.size,
        color: raw.color,
        styles: s.styles,
      })),
    };
  }
  const pieces = item.pieces ?? [];
  return {
    id: raw.id ?? lineId(),
    quantity: raw.quantity,
    pieceSelections: pieces.map((p) => ({ productId: p.productId, size: raw.size, color: raw.color }))
  };
}
```

(el branch de reconstrucción desde `item.pieces`, líneas 101-106, no gana `styles` — esos carritos son legacy previos incluso al armador de combinaciones actual, y nunca tuvieron esta información; se deja tal cual, consistente con que ya pierden otros datos en ese branch).

- [ ] **Step 3: Actualizar el comentario de `lineKey`/dedup para reflejar el nuevo campo**

En el comentario de `addLine` (línea ~236, "Fusiona líneas idénticas (misma combinación de talla/color por pieza)"), actualizar a:

```ts
      // Fusiona líneas idénticas (misma combinación de talla/color/estilos por pieza) — lineKey()
      // serializa pieceSelections completo, así que un nuevo campo participa automáticamente.
      const matchIndex = existing.lines.findIndex((l) => lineKey(l) === lineKey(newLine));
```

No se requiere ningún otro cambio en `lineKey`, `addLine`, `mergeCartItems`, ni `cartForEngine` — todos son field-agnostic (confirmado en la investigación: `JSON.stringify` completo, spread de objetos, paso por referencia).

- [ ] **Step 4: Verificar con typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos en este archivo.

- [ ] **Step 5: Commit**

```bash
git add src/context/CorporateCartContext.tsx
git commit -m "fix(corporativo): propagar styles en migrateLine para que sobreviva a la hidratacion del carrito"
```

---

### Task 4: API — Zod schemas, disponibilidad, y descripción de cotización

**Files:**
- Modify: `src/app/api/corporate/cart/route.ts` (Zod schema)
- Modify: `src/app/api/corporate/quotes/route.ts` (Zod schema, `resolveAvailability`, descripción)
- Modify: `src/components/corporate/CorporateCartDrawer.tsx` (display)

**Interfaces:**
- Produces: `styles` sobrevive el round-trip PUT/GET del carrito persistido y queda en `quoteItems.pricingBreakdown` de cada cotización generada.

- [ ] **Step 1: CRÍTICO — extender el Zod schema de `cart/route.ts`**

En `src/app/api/corporate/cart/route.ts`, línea 21-25, agregar `styles` al schema de `pieceSelections` — sin esto, Zod descarta el campo silenciosamente en cada `PUT`:

```ts
      pieceSelections: z.array(z.object({
        productId: z.string(),
        size: z.string().optional(),
        color: z.string().optional(),
        styles: z.record(z.string(), z.string()).optional(),
      })),
```

- [ ] **Step 2: CRÍTICO — extender el Zod schema de `quotes/route.ts`**

En `src/app/api/corporate/quotes/route.ts`, línea 31-35, mismo cambio:

```ts
const CartLineSchema = z.object({
  pieceSelections: z.array(z.object({
    productId: z.string(),
    size: z.string().optional(),
    color: z.string().optional(),
    styles: z.record(z.string(), z.string()).optional(),
  })).min(1),
  quantity: z.number().min(1),
});
```

- [ ] **Step 3: Decisión — `styles` NO participa en `resolveAvailability` (documentar la decisión, no solo codearla)**

Basado en el spec aprobado: el atributo `VARIANT` sí genera variantes reales con su propio stock (confirmado explícitamente por el usuario: "se comporta igual que las tallas"). Por lo tanto `resolveAvailability` (línea 131-142) SÍ debe considerar `styles` para que la disponibilidad reportada sea precisa — de lo contrario, una combinación agotada en un valor de estilo pero disponible en otro reportaría el status más optimista de ambas, dando falsos "disponible".

Esto requiere que `getVariantAvailabilityByProductIds` (en `corporate-data-service.ts`, no leído todavía en detalle) devuelva también los `styles` de cada fila de disponibilidad, no solo `productId`/`size`/`colorCode`/`status`. Antes de tocar `quotes/route.ts`, leer esa función para confirmar su shape de retorno exacto y si ya trae `attributesPayload`/`styles` por variante (es razonable que sí, dado que consulta `product_variants` — confirmar en vez de asumir).

Una vez confirmado, extender `resolveAvailability` (línea 131-142):

```ts
    function resolveAvailability(productId: string, size?: string, color?: string, styles?: Record<string, string>): string | null {
      const candidates = availabilityRows.filter((r) => {
        if (r.productId !== productId) return false;
        if (size && r.size !== size) return false;
        if (color && r.colorCode !== color) return false;
        if (styles && Object.entries(styles).some(([slug, value]) => r.styles?.[slug] !== value)) return false;
        return true;
      });
      if (candidates.length === 0) return null;
      return candidates.reduce((best, r) =>
        AVAILABILITY_PRIORITY[r.status] < AVAILABILITY_PRIORITY[best.status] ? r : best
      ).status;
    }
```

Y el caller (línea 144-175):

```ts
          const status = resolveAvailability(sel.productId, sel.size, sel.color, sel.styles);
          const productName = productNameById.get(sel.productId) ?? sel.productId;
          const pieceLabel = [productName, sel.size, sel.color, ...Object.values(sel.styles ?? {})].filter(Boolean).join(' - ');
```

- [ ] **Step 4: Descripción de línea en `quoteItems`**

En el bloque de inserción (línea 238-260), extender la construcción de `description` (línea 243-246) siguiendo el mismo patrón de `sizes`:

```ts
        const sizes = Array.from(new Set(cartLine.pieceSelections.map((p) => p.size).filter(Boolean)));
        const styleValues = Array.from(new Set(
          cartLine.pieceSelections.flatMap((p) => Object.values(p.styles ?? {}))
        ));
        const descriptionParts = [item.setName ?? 'Set'];
        if (sizes.length > 0) descriptionParts.push(`Talla ${sizes.join('/')}`);
        if (styleValues.length > 0) descriptionParts.push(styleValues.join('/'));
        const description = descriptionParts.join(' — ');
        await db.insert(quoteItems).values({
          quoteId: quote.id,
          kind: 'CATALOG',
          setId: item.setId,
          size: sizes.length === 1 ? sizes[0] : null,
          description,
          quantity: cartLine.quantity,
          suggestedUnitPrice: unitPrice.toFixed(2),
          unitPrice: unitPrice.toFixed(2),
          pricingBreakdown: { composition: cartLine.pieceSelections },
          sortOrder: sortOrder++,
        });
```

(`pricingBreakdown` ya persiste `styles` automáticamente una vez que el Zod schema del Step 2 lo admite — es una columna JSON sin schema propio, no requiere cambio adicional).

- [ ] **Step 5: Mostrar `styles` en el drawer del carrito**

En `CorporateCartDrawer.tsx`, línea 141-144, extender:

```tsx
                                <span className="text-xs text-gray-600">
                                  {line.pieceSelections
                                    .map((s) => [s.size, s.color, ...Object.values(s.styles ?? {})].filter(Boolean).join(' / '))
                                    .filter(Boolean)
                                    .join(' · ') || 'Set completo'}
                                </span>
```

- [ ] **Step 6: Verificar con typecheck y build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/corporate/cart/route.ts src/app/api/corporate/quotes/route.ts src/components/corporate/CorporateCartDrawer.tsx
git commit -m "feat(corporativo): propagar styles en API de carrito/cotizaciones y mostrarlo en el drawer"
```

---

### Task 5: Verificación end-to-end manual

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Flujo completo en navegador**

Con `npm run dev` corriendo y un set corporativo cuyas piezas incluyan un producto con un atributo `VARIANT` configurado (Fases 1-2):

1. Ir a `/corporativo/s/{slug}` de ese set.
2. Confirmar que debajo del selector de talla de la pieza correspondiente aparece el bloque de "Modelo de corte" (o el atributo configurado) con sus valores como botones.
3. Intentar "Agregar combinación" sin elegir el atributo — debe bloquear con el toast de error nuevo.
4. Elegir todos los campos incluido el atributo, agregar la combinación — debe aparecer en "Combinaciones armadas" mostrando el valor elegido.
5. Agregar al carrito corporativo, abrir el drawer — debe mostrar el valor del atributo en la línea.
6. Recargar la página completa (F5) — el carrito debe seguir mostrando el valor del atributo (valida que `migrateLine` no lo perdió).
7. Ir a `/corporativo/solicitud` y completar una solicitud de cotización — confirmar que no hay errores 400 de validación Zod.
8. Si hay acceso al admin de cotizaciones, abrir la cotización generada y confirmar que la descripción de línea incluye el valor del atributo elegido.

Expected: comportamiento descrito arriba en cada paso, sin errores en consola ni pérdida de datos entre pasos.

- [ ] **Step 2: Caso sin atributos VARIANT — regresión**

Repetir el flujo con un set cuyas piezas NO tengan ningún atributo `VARIANT` configurado — debe verse y comportarse exactamente igual que antes de esta fase (sin bloque nuevo, sin bloqueos nuevos, sin cambios visuales).

Expected: cero regresión.

---

## Fin de Fase 4

Al completar las 5 tareas, el ciclo completo queda cerrado: un admin puede marcar un atributo como `VARIANT` en un tipo de producto (Fase 1-2), generar variantes reales por combinación en la ficha de producto (Fase 2), y el comprador —tanto individual (`/p/[slug]`, Fase 3) como corporativo armando un set (`/corporativo/s/[slug]`, Fase 4)— puede elegir ese atributo al momento de comprar, con la selección persistida de forma sólida hasta la cotización final. Los filtros del catálogo público (`/catalogo`) ya soportan esto sin cambios adicionales, según lo confirmado en el spec original.

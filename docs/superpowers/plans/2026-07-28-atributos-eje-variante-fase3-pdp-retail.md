# Atributos EAV como eje de variante — Fase 3: PDP Retail + Carrito Retail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalizar el selector especial de "Corte" (`selectedFit`) del PDP retail (`/p/[slug]`) a un selector genérico `selectedStyles` que soporte cualquier atributo EAV en modo `VARIANT` (no solo "corte"), respetando `displayType` (botones/select), y propagar la selección al carrito sin perder datos entre variantes que solo difieren en ese eje.

**Architecture:** El backend de datos (`data-service.ts`, `types.ts`) ya expone `ProductVariant.styles: Record<string,string>` y `Product.availableStyles?: Record<string,string[]>` de forma completamente genérica — no requiere cambios de schema ni de query. El trabajo es puramente de frontend: reemplazar el caso especial `Fit`/`selectedFit` (una sola constante `CORTE_ATTRIBUTE_SLUG`) por un mapa genérico slug→valor en `Product.tsx`, `VariantSelector.tsx`, `CartContext.tsx` y `types.ts`. `FitSelector` ya es genérico internamente (`fits: string[]`) — solo cambia cómo se invoca.

**Tech Stack:** Next.js 15 App Router (client components), React Context (`CartContext`).

## Global Constraints

- Nunca ejecutar `git commit`, `git push`, ni crear PRs/Releases — solo sugerir el mensaje de commit al final.
- Requiere Fase 1 y Fase 2 completas (un atributo debe poder marcarse `VARIANT` y generar variantes reales desde el admin para poder probar esto de punta a punta).
- No modificar `data-service.ts` en esta fase — `availableStyles`/`variants[].styles` ya son genéricos y correctos (confirmado por investigación previa: `CORTE_ATTRIBUTE_SLUG` sigue siendo válido como caso particular de "corte", el cambio es que el PDP deja de asumir que es el único atributo posible).
- Mantener retrocompatibilidad visual: un producto sin ningún atributo `VARIANT` (o con solo "corte", como hoy) debe verse y comportarse exactamente igual que antes.
- Validar con build + lint + typecheck al final.

---

### Task 1: Generalizar `CartItem`/`addItem` de `fit` a `styles`

**Files:**
- Modify: `src/lib/types.ts:93-109` (`CartItem`)
- Modify: `src/context/CartContext.tsx:14,99-142` (`addItem`, dedup)

**Interfaces:**
- Produces: `CartItem.styles?: Record<string, string>` (reemplaza `fit?: Fit`). `addItem(product, variantId, color, size, styles, quantity)` — firma con `styles: Record<string, string>` en la posición 5 (reemplaza `fit: Fit | undefined`).

- [ ] **Step 1: Cambiar `CartItem.fit` a `CartItem.styles`**

En `src/lib/types.ts`, dentro de la interfaz `CartItem` (línea 93-109), reemplazar:

```ts
export interface CartItem {
  id: string;
  productId: string;
  /** Id de la marca del producto — usado para resolver Visibilidad de precios por ítem en el carrito. */
  brandId?: string;
  variantId: string;
  name: string;
  brand: string;
  slug: string;
  color: ProductColor;
  size: Size;
  /** Estilos EAV en modo VARIANT elegidos al agregar al carrito (slug de atributo → valor).
   * Ej: `{ corte: 'Regular' }`. Vacío `{}` si el producto no tiene ejes VARIANT. */
  styles: Record<string, string>;
  sku: string;
  price: number;
  quantity: number;
  image: string;
}
```

(se quita `fit?: Fit`; `styles` queda no-opcional con default `{}` para simplificar el dedup de Task 1 Step 3 — evita tener que distinguir `undefined` vs `{}` en la key).

- [ ] **Step 2: Actualizar la firma y el cuerpo de `addItem`**

En `src/context/CartContext.tsx`, cambiar la firma en la interfaz `CartContextType` (línea 14):

```ts
  addItem: (product: Product, variantId: string, color: ProductColor, size: Size, styles: Record<string, string>, quantity: number) => void;
```

Y en la implementación (línea 99-142), reemplazar:

```ts
  const addItem = useCallback((
    product: Product,
    variantId: string,
    color: ProductColor,
    size: Size,
    styles: Record<string, string>,
    quantity: number
  ) => {
    const variant = product.variants.find(v => v.id === variantId);
    if (!variant) return;

    setItems(prev => {
      const existingItem = prev.find(
        item => item.variantId === variantId && item.color.id === color.id && item.size === size &&
          JSON.stringify(item.styles) === JSON.stringify(styles)
      );

      if (existingItem) {
        return prev.map(item =>
          item.id === existingItem.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      const newItem: CartItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        productId: product.id,
        brandId: product.brandId,
        variantId,
        name: product.name,
        brand: product.brand,
        slug: product.slug,
        color,
        size,
        styles,
        sku: variant.sku,
        price: product.priceSale || product.priceNormal,
        quantity,
        image: variant.images.find((m) => m.type === 'image')?.url || '/images/placeholder-product.jpg',
      };

      return [...prev, newItem];
    });
  }, []);
```

Nota sobre el dedup: se agrega `JSON.stringify(item.styles) === JSON.stringify(styles)` a la condición existente — antes `fit` no participaba en el dedup (bug latente identificado en la investigación: dos líneas que solo diferían en `fit` se fusionaban incorrectamente). Con `variantId` ya presente en la key, esto es en la práctica redundante para variantes reales (dos variantes distintas ya tienen distinto `variantId`), pero se mantiene explícito por claridad y como defensa si algún día `variantId` dejara de ser 1:1 con la combinación completa.

- [ ] **Step 3: Verificar con typecheck (esperado: errores en call-sites, se resuelven en Task 2)**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: errores nuevos en `Product.tsx` (llamadas a `addItem` con 5 argumentos posicionales en vez de 6, o pasando `fit`/`undefined` donde ahora se espera `Record<string,string>`) — esto es esperado en este punto intermedio, se resuelve en Task 2.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/context/CartContext.tsx
git commit -m "feat(carrito): generalizar CartItem.fit a CartItem.styles (cualquier atributo VARIANT)"
```

---

### Task 2: Generalizar `Product.tsx` — estado, resolución de variante, add-to-cart

**Files:**
- Modify: `src/legacy-pages/Product.tsx:15,109,131-136,152-215,271-283,400-413`

**Interfaces:**
- Consumes: `Product.availableStyles?: Record<string, string[]>` (ya existente, sin cambios), `CartItem`/`addItem` (Task 1).
- Produces: estado `selectedStyles: Record<string, string>` pasado a `VariantSelector` (Task 3) en vez de `selectedFit`.

- [ ] **Step 1: Reemplazar el import de `Fit` y el estado `selectedFit`**

En `src/legacy-pages/Product.tsx`, cambiar el import (línea 15):

```ts
import type { Product as ProductType, ProductColor, Size, VariantStatus, MediaItem } from '@/lib/types';
```

(se quita `Fit` — ya no se usa ningún tipo `Fit` en este archivo).

Reemplazar el estado `selectedFit` (línea 109):

```ts
  const [selectedStyles, setSelectedStyles] = useState<Record<string, string>>(() => {
    if (!product?.availableStyles) return {};
    // Preselecciona el primer valor disponible de cada eje VARIANT — mismo criterio que
    // `selectedColor`/`selectedSize` ya usan (primera opción por defecto).
    return Object.fromEntries(
      Object.entries(product.availableStyles)
        .filter(([, values]) => values.length > 0)
        .map(([slug, values]) => [slug, values[0]])
    );
  });
```

- [ ] **Step 2: Generalizar la resolución de `selectedVariant`**

Reemplazar (línea 131-136):

```ts
  // Get variant for selected options
  const selectedVariant = product.variants.find(
    (v) =>
      v.colorId === selectedColor?.id &&
      v.size === selectedSize &&
      Object.entries(selectedStyles).every(([slug, value]) => v.styles[slug] === value)
  );
```

Nota: a diferencia del `(!selectedFit || v.fit === selectedFit)` original (que dejaba pasar cualquier variante si no había selección), esta versión exige que **todos** los ejes en `selectedStyles` coincidan — correcto porque `selectedStyles` ahora siempre se inicializa con un valor por cada eje disponible (Step 1), así que nunca queda "sin elegir" salvo que el producto no tenga ejes VARIANT (`selectedStyles = {}`, en cuyo caso `Object.entries({}).every(...)` es vacuously `true` y no filtra nada — comportamiento idéntico al actual para productos sin atributos VARIANT).

- [ ] **Step 3: Actualizar `handleAddToCart` y `handleAddComplementary`**

En `handleAddToCart` (línea 175), cambiar la llamada:

```ts
        addItem(product, selectedVariant.id, selectedColor, selectedSize, selectedStyles, quantity);
```

En `handleAddComplementary` (línea 202), cambiar:

```ts
        addItem(complementaryProduct, variant.id, selectedColor, size, {}, 1);
```

(el producto complementario no tiene UI de selección de estilos en `CrossSellCard`, así que se agrega con `{}` — mismo comportamiento que antes, donde se pasaba `undefined` para `fit`).

- [ ] **Step 4: Actualizar ambos call-sites de `VariantSelector`**

En los dos bloques (mobile línea 271-283, desktop línea 400-413), reemplazar `selectedFit`/`onFitSelect` por `selectedStyles`/`onStylesChange`:

```tsx
            {selectedColor && (
              <div className="mb-6">
                <VariantSelector
                  product={product}
                  selectedColor={selectedColor}
                  selectedSize={selectedSize}
                  selectedStyles={selectedStyles}
                  onColorSelect={setSelectedColor}
                  onSizeSelect={setSelectedSize}
                  onStylesChange={(slug, value) => setSelectedStyles((prev) => ({ ...prev, [slug]: value }))}
                />
              </div>
            )}
```

(aplicar el mismo cambio en ambos lugares — mobile y desktop tienen el bloque idéntico).

- [ ] **Step 5: Verificar con typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: errores restantes solo en `VariantSelector.tsx` (props no actualizadas todavía — se resuelve en Task 3).

- [ ] **Step 6: Commit**

```bash
git add src/legacy-pages/Product.tsx
git commit -m "feat(pdp): generalizar selectedFit a selectedStyles en Product.tsx"
```

---

### Task 3: Generalizar `VariantSelector.tsx`

**Files:**
- Modify: `src/components/product/VariantSelector.tsx`

**Interfaces:**
- Consumes: `selectedStyles: Record<string, string>`, `onStylesChange: (slug: string, value: string) => void` (Task 2).
- Produces: renderiza un bloque por cada slug presente en `product.availableStyles`, debajo del selector de talla — usando `FitSelector` (ya genérico, sin cambios internos necesarios) para cada uno.

- [ ] **Step 1: Reemplazar props y la lógica de disponibilidad**

Reemplazar el archivo completo:

```tsx
import type { Product, ProductColor, Size, VariantStatus } from '@/lib/types';
import { ColorSwatchGroup } from '@/components/catalog/ColorSwatch';
import { SizeSelector, FitSelector } from '@/components/catalog/SizeSelector';
import { cn } from '@/lib/utils';

interface VariantSelectorProps {
  product: Product;
  selectedColor: ProductColor;
  selectedSize?: Size;
  selectedStyles: Record<string, string>;
  onColorSelect: (color: ProductColor) => void;
  onSizeSelect: (size: Size) => void;
  onStylesChange: (slug: string, value: string) => void;
}

export function VariantSelector({
  product,
  selectedColor,
  selectedSize,
  selectedStyles,
  onColorSelect,
  onSizeSelect,
  onStylesChange,
}: VariantSelectorProps) {
  // Get variants for selected color
  const colorVariants = product.variants.filter(v => v.colorId === selectedColor.id);

  // Get available sizes for selected color
  const availableSizesForColor = [...new Set(colorVariants.map(v => v.size))];

  // Get size statuses
  const sizeStatuses: Record<Size, VariantStatus> = {} as Record<Size, VariantStatus>;
  availableSizesForColor.forEach(size => {
    const variant = colorVariants.find(v => v.size === size);
    if (variant) {
      sizeStatuses[size] = variant.status;
    }
  });

  // Get availability status
  const getAvailabilityStatus = () => {
    if (!selectedSize) return null;
    const variant = colorVariants.find(
      v => v.size === selectedSize && Object.entries(selectedStyles).every(([slug, value]) => v.styles[slug] === value)
    );
    return variant?.status;
  };

  const availabilityStatus = getAvailabilityStatus();

  const statusConfig = {
    AVAILABLE: {
      dot: 'bg-[#34C759]',
      text: 'Disponible',
      textColor: 'text-[#34C759]',
    },
    BACKORDER: {
      dot: 'bg-[#FF9500]',
      text: 'Bajo Pedido: llega en 7-10 días',
      textColor: 'text-[#FF9500]',
    },
    OUT_OF_STOCK: {
      dot: 'bg-[#FF3B30]',
      text: 'Agotado',
      textColor: 'text-[#FF3B30]',
    },
  };

  const styleAxes = Object.entries(product.availableStyles ?? {}).filter(([, values]) => values.length > 0);

  return (
    <div className="space-y-6">
      {/* Color Selector */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[#111111]">
            Color: <span className="text-gray-500">{selectedColor.name}</span>
          </h3>
        </div>
        <ColorSwatchGroup
          colors={product.colors}
          selectedColorId={selectedColor.id}
          onColorSelect={onColorSelect}
          size="lg"
        />
      </div>

      {/* Size Selector */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[#111111]">
            Talla: <span className="text-gray-500">{selectedSize || 'Seleccionar'}</span>
          </h3>
          <button className="text-sm text-gray-500 underline hover:text-[#111111] transition-colors">
            Guía de tallas
          </button>
        </div>
        <SizeSelector
          sizes={product.availableSizes}
          selectedSize={selectedSize}
          sizeStatuses={sizeStatuses}
          onSizeSelect={onSizeSelect}
        />
      </div>

      {/* Selectores de atributos EAV en modo VARIANT (ej. Corte) — uno por cada eje
          presente en availableStyles, debajo de la talla. */}
      {styleAxes.map(([slug, values]) => (
        <div key={slug}>
          <h3 className="text-sm font-medium text-[#111111] mb-3">
            {slug}: <span className="text-gray-500">{selectedStyles[slug] || 'Seleccionar'}</span>
          </h3>
          <FitSelector
            fits={values}
            selectedFit={selectedStyles[slug]}
            onFitSelect={(value) => onStylesChange(slug, value)}
          />
        </div>
      ))}

      {/* Availability Status */}
      {availabilityStatus && (
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', statusConfig[availabilityStatus].dot)} />
          <span className={cn('text-sm', statusConfig[availabilityStatus].textColor)}>
            {statusConfig[availabilityStatus].text}
          </span>
        </div>
      )}
    </div>
  );
}
```

Nota sobre el label: se usa `slug` directamente como título (ej. "corte") en vez del nombre legible del atributo ("Modelo de corte") porque `product.availableStyles`/`variants[].styles` solo trae slugs, no nombres — el nombre legible vive en `attributes.name`, que no forma parte del payload actual del producto público. Ver Task 4 para resolver esto con un mapeo mínimo de labels conocidos, o aceptar el slug como label por ahora (decisión explícita, no placeholder).

- [ ] **Step 2: Verificar con typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos en el árbol de `Product.tsx`/`VariantSelector.tsx`/`CartContext.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/product/VariantSelector.tsx
git commit -m "feat(pdp): renderizar selector generico por cada atributo VARIANT en VariantSelector"
```

---

### Task 4: Labels legibles para los ejes de atributo (evitar mostrar el slug crudo)

**Files:**
- Modify: `src/lib/data-service.ts` (`transformProduct`, agregar mapeo de nombres)
- Modify: `src/lib/types.ts` (`Product`)
- Modify: `src/components/product/VariantSelector.tsx` (consumir el label)

**Interfaces:**
- Produces: `Product.styleLabels?: Record<string, string>` (slug → nombre legible del atributo, ej. `{ corte: 'Modelo de Corte' }`), poblado desde `attributes.name` vía join.

- [ ] **Step 1: Confirmar si la query de `transformProduct` ya trae `attributes.name` disponible**

Antes de escribir código, revisar la query que llama a `transformProduct` en `src/lib/data-service.ts` (buscar `getProductBySlug` o equivalente) para confirmar si ya hace join con `attributes`/`attributeValues` en algún punto (por ejemplo al construir `attributesPayload` en el pipeline de `src/lib/attributes-payload/`) o si hay que agregar un join nuevo. Si `attributesPayload` en la base ya es solo `{styles: {slug: value}}` sin nombres, la fuente de verdad de "slug → nombre" es la tabla `attributes` — requiere un join adicional o una consulta separada batched por los slugs presentes en `dbProduct.variants`.

- [ ] **Step 2: Agregar el join/consulta y poblar `styleLabels`**

Extender `transformProduct` (o la función que arma el objeto `dbProduct` antes de llamarla) para incluir un mapeo `attributeName` por slug — la forma exacta depende del resultado del Step 1; el patrón general es:

```ts
// Dentro de transformProduct, junto a donde se construye `availableStyles`:
const styleLabels: Record<string, string> | undefined = stylesMap.size > 0
  ? Object.fromEntries(
      Array.from(stylesMap.keys()).map((slug) => [slug, attributeNameBySlug.get(slug) ?? slug])
    )
  : undefined;
```

donde `attributeNameBySlug` es un `Map<string, string>` obtenido de una consulta a `attributesTable` filtrada por los slugs presentes (batched, una sola query, mismo patrón que otras funciones de este archivo).

Agregar el campo a la interfaz `Product` en `src/lib/types.ts`, junto a `availableStyles` (línea 79):

```ts
  /** Nombre legible de cada atributo EAV en `availableStyles` (slug → nombre), para no
   * mostrar el slug crudo en el selector del PDP. Ej: `{ corte: 'Modelo de Corte' }`. */
  styleLabels?: Record<string, string>;
```

Y en el `return` de `transformProduct`, agregar `styleLabels,` junto a `availableStyles,`.

- [ ] **Step 3: Consumir `styleLabels` en `VariantSelector.tsx`**

Reemplazar el label hardcodeado del Task 3 Step 1:

```tsx
      {styleAxes.map(([slug, values]) => (
        <div key={slug}>
          <h3 className="text-sm font-medium text-[#111111] mb-3">
            {product.styleLabels?.[slug] ?? slug}: <span className="text-gray-500">{selectedStyles[slug] || 'Seleccionar'}</span>
          </h3>
          <FitSelector
            fits={values}
            selectedFit={selectedStyles[slug]}
            onFitSelect={(value) => onStylesChange(slug, value)}
          />
        </div>
      ))}
```

- [ ] **Step 4: Verificar con typecheck y build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 5: Verificación manual**

Con `npm run dev` corriendo: navegar a `/p/{slug}` de un producto que tenga un atributo `VARIANT` configurado (Fase 2) con al menos 2 valores en sus variantes. Confirmar:
- Debajo del selector de talla aparece un bloque con el nombre legible del atributo (no el slug), con botones/select según `displayType`.
- Cambiar el valor del atributo cambia el estado de disponibilidad (`AvailabilityStatus`) si la combinación resultante tiene otro `status`.
- Agregar al carrito y confirmar en el drawer/página de carrito que la línea refleja el valor elegido (si hay UI de carrito que muestre detalles — si no la hay, confirmar al menos que no hay error en consola y que la cantidad se acumula correctamente al repetir la misma combinación, y NO se fusiona con una combinación que difiere solo en ese atributo).
- Un producto SIN ningún atributo `VARIANT` configurado se ve y comporta exactamente igual que antes (sin bloque nuevo, sin regresión).

Expected: comportamiento descrito arriba, sin errores en consola.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data-service.ts src/lib/types.ts src/components/product/VariantSelector.tsx
git commit -m "feat(pdp): mostrar nombre legible del atributo en vez del slug en el selector"
```

---

## Fin de Fase 3

Al completar las 4 tareas: el PDP retail (`/p/[slug]`) soporta cualquier cantidad de atributos EAV en modo `VARIANT`, no solo "Corte" — cada uno se renderiza como un selector adicional debajo de la talla, respetando `displayType`, y la selección se propaga correctamente al carrito sin fusionar líneas que deberían ser distintas. La Fase 4 (PDP corporativo/armador de sets + carrito/cotización corporativa) es la única pieza restante para que el comprador corporativo tenga la misma capacidad.

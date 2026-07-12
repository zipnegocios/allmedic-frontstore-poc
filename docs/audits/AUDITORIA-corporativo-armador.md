# Auditoría — Armador de combinaciones (catálogo corporativo)

Fecha: 2026-07-12. Auditoría de lectura previa a la implementación del armador de combinaciones por pieza en el catálogo corporativo.

## 1. Proporción de imagen

- `ProductCard.tsx:86` y `ImageGallery.tsx:54` usan ambos `aspect-[4/5]` (valor literal, sin fuente única compartida — están duplicados, no extendidos de una utilidad común).
- `SetDetailContent.tsx:139` usa hoy `aspect-[4/3]`, distinto al retail. Se unifica a `aspect-[4/5]` en el armador para lograr paridad visual real.
- `MediaGridThumb` (`src/components/media/MediaGridThumb.tsx:7-15`) no impone aspect-ratio propio — usa `<Image fill>`, así que el ratio lo controla el contenedor (`div` con la clase `aspect-[4/5]`). Reutilizable tal cual en las tarjetas corporativas y en la mini-galería por pieza.

## 2. `pieceSelections` — forma actual y consumidores

`CorporateCartLine` (`src/lib/rules-engine/types.ts:205-210`, espejada en `src/context/CorporateCartContext.tsx:18-24`):

```ts
export interface CorporateCartLine {
  id: string; // solo en el contexto de UI
  size?: string;
  color?: string;                    // color por LÍNEA, no por pieza
  pieceSelections?: Array<{ productId: string; size: string }>; // sin color
  quantity: number; // siempre en SETS
}
```

Consumidores: `SetDetailContent.tsx` (arma la línea en las 3 ramas de `SIZE_MODE`), `validate.ts:134` (`MISSING_PIECE_SELECTIONS`) y `:168-178` (`COLOR_RESTRICTION` contra `line.color`), `inventory.ts:73-78` (`computeItemDemand`, agrupa demanda por `productId::size`, sin color), `api/corporate/quotes/route.ts:19` (schema Zod), `api/corporate/cart/check-inventory/route.ts` (dry-run).

`color` hoy es una única elección por línea, compartida por los 3 modos de talla (documentado explícitamente como decisión de alcance de la sesión anterior en `SetDetailContent.tsx:52-56`). Extender a color por pieza toca: `types.ts`, `CorporateCartContext.tsx`, el schema Zod de `quotes/route.ts`, `inventory.ts` y `validate.ts`.

## 3. Imágenes por color en el set corporativo

`getCorporateSetBySlug` (`corporate-data-service.ts:141-264`) sí trae `colors`/`availableSizes` por pieza (join a `colorsTable`, líneas 180-218), pero **fija `variants[].images: []` de forma hardcodeada** (línea 226) — no consulta `mediaLinksTable` por `colorId`. El catálogo individual sí lo hace (`data-service.ts`, `fetchProductsWithJoins`, líneas 232-264, filtrando `mediaLinksTable` por `entityType: 'PRODUCT'`, `role: 'GALLERY'`, agrupando por `colorId`). Replicar ese mismo patrón en `getCorporateSetBySlug` es trabajo real de Fase 1, no un dato ya disponible.

Schema relevante (`src/db/schema/products.ts`): `colors {id, name, code, hex}`, `productVariants {id, productId, colorId, size, ..., stock}` (sin columna de imagen propia — las imágenes viven en `mediaLinks`/`mediaAssets`, relacionadas por `colorId`).

## 4. Resolución de SIZE_MODE, COLOR_RESTRICTION, INVENTORY_MODE

Confirmado contra `AUDITORIA-motor-reglas.md` y `REPORTE-reglas-ambitos-2026-07-13.md` — sin discrepancias:

- **SIZE_MODE**: resuelto en `resolve.ts` vía `pickBestRule`, propagado en `page.tsx` con `productIds`, consumido en las 3 ramas de `SetDetailContent.tsx`.
- **COLOR_RESTRICTION**: resuelto en los 5 ámbitos (incluye PRODUCT); validado hoy contra `line.color` (por línea) en `validate.ts:168-178`. Pasará a validarse por fila×pieza.
- **INVENTORY_MODE**: resuelto deliberadamente SIN `productIds` (excepción documentada — evita el riesgo de que un ámbito PRODUCT afecte la UI sin que el servidor lo replique). `checkInventory` (`inventory.ts:97`) agrupa demanda por `productId::size`; pasará a `productId::size::color` con fallback.

## 5. Componentes reutilizables del individual

- `ColorSwatchGroup` — `src/components/catalog/ColorSwatch.tsx:62-91`. Props: `{ colors: ProductColor[]; selectedColorId?; availableColorIds?; onColorSelect; size? }`.
- `SizeSelector` — `src/components/catalog/SizeSelector.tsx:1-67` (junto a `FitSelector`). Props: `{ sizes: Size[]; selectedSize?; sizeStatuses?; onSizeSelect }`.
- `ImageGallery` — `src/components/product/ImageGallery.tsx:13-19`. Props: `{ images: MediaItem[]; productName; brandLogo? }`. Usa `MediaGridThumb` para thumbnails internamente.
- `MediaGridThumb` — ver sección 1.
- Patrón de composición de referencia: `VariantSelector.tsx` combina `ColorSwatchGroup` + `SizeSelector` + `FitSelector` para la ficha individual — es la referencia a adaptar para cada tarjeta de pieza del armador.

## Discrepancias con el plan y ajustes adoptados

1. **Aspect ratio "reutilizable"**: no hay una única fuente — son dos literales idénticos duplicados (`ProductCard.tsx`, `ImageGallery.tsx`) más un tercero distinto en el set corporativo (`aspect-[4/3]`). Ajuste: se usa el literal `aspect-[4/5]` en todo el armador y el grid corporativo, sin crear una abstracción nueva (no la pide el plan; los literales ya son la convención del proyecto).
2. **`pieceSelections` como array por pieza**: confirmado correcto tal como asume el plan. Se le agrega `color?: string` opcional por pieza en Fase 1/2.
3. **`line.color` por línea (no por pieza) hoy**: confirmado correcto. Es la base de la migración en lectura (Fase 1): `line.color` existente se propaga a cada `pieceSelection.color` al cargar carritos persistidos, y luego se elimina el campo de línea.
4. **Hallazgo adicional (no cubierto por las 3 suposiciones)**: `getCorporateSetBySlug` no trae imágenes por color hoy (hardcodeado `[]`). Se agrega como tarea explícita de Fase 1: extender la consulta con el mismo patrón de `mediaLinksTable` que usa retail. Sin esto, la mini-galería por pieza del armador (Fase 4, punto 2) no tiene datos que mostrar.

No se encontraron contradicciones que obliguen a detener la ejecución del plan — se continúa a Fase 1 con estos ajustes incorporados.

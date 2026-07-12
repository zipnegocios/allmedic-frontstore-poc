# Reporte — Armador de combinaciones y paridad visual del catálogo corporativo

Fecha: 2026-07-12.

## Qué se activó

El catálogo corporativo (`/corporativo` y `/corporativo/s/[slug]`) pasa de un flujo con 3 ramas de UI distintas por `SIZE_MODE` (Matriz, Por pieza, Sin tallas) a un **armador de combinaciones único**: el comprador elige color y talla de **cada pieza del set por separado**, define la cantidad de sets de esa combinación, la agrega como fila, y puede repetir el proceso para armar varias combinaciones distintas antes de llevarlas al carrito. `SIZE_MODE` deja de cambiar la estructura de datos y pasa a cambiar solo el comportamiento del armador (atajo de talla única en Matriz, selector de talla oculto en Sin tallas).

En paralelo, el listado y la ficha de set adoptan la misma proporción de imagen (`aspect-[4/5]`) y los mismos componentes visuales (`MediaGridThumb`, `ColorSwatchGroup`, `SizeSelector`) que el catálogo individual.

## Decisiones de diseño

1. **Forma unificada de línea de carrito.** `CorporateCartLine` pasa de `{ size?, color?, pieceSelections?, quantity }` a `{ quantity, pieceSelections: Array<{ productId, size?, color? }> }`. Los tres modos de talla ahora comparten una sola forma de datos — `SIZE_MODE` ya no bifurca la estructura, solo el comportamiento del armador. Esto simplificó `validate.ts` e `inventory.ts`: ya no hay ramas por `sizeMode`, solo una condición sobre si el modo exige talla (`!== 'NO_SIZES'`).

2. **Color por pieza, no por línea.** `pieceSelections[].color` reemplaza al antiguo `line.color` (una elección compartida por todas las piezas). El selector de color de cada pieza en el armador solo ofrece colores con al menos una variante activa de esa pieza — mismo criterio "sin opción muerta" del proyecto.

3. **COLOR_RESTRICTION por fila × pieza.** La validación ahora calcula, por cada pieza con color elegido dentro de una fila, `unidades = cantidadDeSets × quantityPerSet`, y compara contra el mínimo configurado para ese color. El mensaje de error nombra pieza, color y mínimo exigido. Ejemplo numérico: una combinación de 3 sets de una camisa con `quantityPerSet: 2` en color rosado, con una regla `{ colorCode: "PINK", min: 6 }` → `3 × 2 = 6` unidades → **sin violación** (alcanza el mínimo exacto). Con 2 sets en lugar de 3 → `2 × 2 = 4 < 6` → violación: `"Camisa" en color "PINK" dentro de "Set X" requiere un mínimo de 6 unidades; esta combinación lleva 4.`

4. **INVENTORY_MODE con clave de color.** La demanda y el snapshot de stock ahora se calculan por `productId::size::color` cuando la pieza tiene color elegido, con fallback a `productId::size` (sin color) y `productId` (sin talla, modo Sin tallas — el color no participa ahí, tal como pedía el plan). `getInventorySnapshotByProductIds` agrega tres niveles: por color exacto, por talla (todos los colores) y por producto total.

5. **Imágenes por color en piezas del set.** `getCorporateSetBySlug` traía `variants[].images: []` hardcodeado — no había ninguna imagen por color en el flujo corporativo. Se extendió con el mismo patrón de consulta que usa el catálogo individual (`mediaLinksTable` filtrado por `entityType: 'PRODUCT'`, `role: 'GALLERY'`, agrupado por `colorId`), sin N+1 (una sola consulta agregada para todas las piezas del set). La mini-galería de cada pieza en el armador ahora reacciona al color elegido, igual que la ficha de producto individual.

6. **Migración de carritos persistidos.** Un carrito guardado (localStorage o BD) con la forma vieja (`line.size`/`line.color` a nivel de línea, `pieceSelections` sin color) se normaliza en lectura: si la línea ya tenía `pieceSelections`, se le propaga el color de línea a cada pieza; si no (líneas viejas de Matriz/Sin tallas), se reconstruye `pieceSelections` a partir de `item.pieces` (la composición del set, ya guardada en el carrito desde una sesión anterior). Si un carrito muy antiguo no tiene `item.pieces` (antes de esa metadata), la línea migra con `pieceSelections: []` — carga sin error, pero no podrá reenviarse hasta rehacerse en el armador. Es una degradación aceptada y documentada en el código (`CorporateCartContext.tsx`), no un bloqueo.

7. **Re-validación de servidor con composición completa.** Se detectó que `POST /api/corporate/quotes` llamaba a `validateCorporateCart` con `setMeta` SIN `pieces` (solo `checkInventory` recibía la composición completa) — esto habría dejado la nueva validación de `COLOR_RESTRICTION` por pieza (y la resolución de ámbito Producto ya existente) sin datos reales en el flujo real de envío. Se corrigió pasando `setMetaWithPieces` a `validateCorporateCart` y `computeCartPricing` también, cerrando una inconsistencia preexistente no relacionada directamente con este plan pero necesaria para que la nueva validación funcione en producción.

## Archivos creados/modificados

| Archivo | Propósito |
|---|---|
| `docs/audits/AUDITORIA-corporativo-armador.md` | Auditoría previa (Fase 0): aspect ratios, forma de `pieceSelections`, imágenes por color, componentes reutilizables. |
| `src/lib/rules-engine/types.ts` | `CorporateCartLine` unificada; comentario de `InventoryStockSnapshot` actualizado con la clave de 3 niveles. |
| `src/lib/rules-engine/validate.ts` | Estructura unificada (sin ramas por `sizeMode`); `COLOR_RESTRICTION` por fila × pieza. |
| `src/lib/rules-engine/inventory.ts` | `stockKey`/`computeItemDemand` con color; sin ramas por `sizeMode`. |
| `src/lib/rules-engine/docs.ts` | `SIZE_MODE`, `INVENTORY_MODE`, `COLOR_RESTRICTION` reescritos para reflejar el armador. |
| `src/lib/corporate-types.ts` | Sin cambios de forma (ya soportaba `colors`/`variants` por pieza). |
| `src/lib/corporate-data-service.ts` | `getCorporateSetBySlug`: imágenes reales por color en piezas; `getInventorySnapshotByProductIds`: snapshot con 3 niveles de clave. |
| `src/context/CorporateCartContext.tsx` | Tipo unificado, `normalizeCartItems`/`migrateLine` (migración en lectura), `addLine`/`lineKey` simplificados. |
| `src/app/(store)/corporativo/s/[slug]/SetDetailContent.tsx` | Reescrito: armador de combinaciones (selección por pieza, atajo Matriz, filas, validación en vivo de color, disponibilidad). |
| `src/app/(store)/corporativo/s/[slug]/page.tsx` | Pasa `colorRestrictions` resueltas al armador para validación en vivo. |
| `src/app/(store)/corporativo/CorporativoContent.tsx` | Tarjetas con `aspect-[4/5]` y `MediaGridThumb` (paridad con `/catalogo`). |
| `src/components/corporate/CorporateCartDrawer.tsx` | Muestra desglose por pieza (talla/color) en vez de talla/color de línea. |
| `src/app/(store)/corporativo/solicitud/page.tsx` | Envía `pieceSelections` sin los campos de línea eliminados. |
| `src/app/admin/(dashboard)/quotes/[id]/page.tsx` | Detalle de cotización admin: desglose por pieza. |
| `src/app/api/corporate/quotes/route.ts` | Schema Zod actualizado; `setMetaWithPieces` pasado también a `validateCorporateCart`/`computeCartPricing`. |
| `src/app/api/corporate/cart/route.ts` | Schema Zod de línea actualizado. |
| `src/app/api/corporate/cart/check-inventory/route.ts` | Schema Zod de línea actualizado. |
| `src/lib/rules-engine/__tests__/rules-engine.test.ts` | Migrado a la forma unificada; casos nuevos de `COLOR_RESTRICTION` con `quantityPerSet` y sin color/color distinto. |
| `src/lib/rules-engine/__tests__/inventory.test.ts` | Migrado a la forma unificada; casos nuevos de demanda con color (clave exacta y suma entre combinaciones). |
| `src/lib/rules-engine/__tests__/scope-activation.test.ts` | Migrado a la forma unificada; `COLOR_RESTRICTION` reescrito para fila × pieza. |
| `src/lib/rules-engine/__tests__/promo-pricing.test.ts` | Migrado a la forma unificada (sin cambios de comportamiento esperado). |
| `docs/audits/AUDITORIA-motor-reglas.md` | Secciones de `COLOR_RESTRICTION` corregidas: color por pieza, no por línea. |

## Limitaciones conocidas

- **Carritos persistidos muy antiguos sin `item.pieces`** migran con `pieceSelections: []` — cargan sin error, pero requieren rehacerse en el armador antes de poder enviarse. No se intentó una reconstrucción más elaborada porque esos carritos no tienen ningún dato de composición del set guardado localmente.
- **Galería principal del set** sigue mostrando solo la imagen de portada (`COVER`) — el modelo de datos no tiene un concepto de "galería del set" más allá de eso; se unificó su proporción a `aspect-[4/5]` pero no se fabricó una galería multi-imagen inexistente en los datos.
- **Verificación manual con `curl` (Fase 7 del plan) no se ejecutó contra una base de datos real en este entorno.** El `.env.local` del proyecto apunta a una base de datos remota que no es local/efímera; enviar cotizaciones de prueba habría insertado registros reales en `quote_requests`. Se optó por no arrancar el servidor de desarrollo contra esa base para evitar escrituras no autorizadas. La verificación de este cierre se limitó a la suite automatizada, el build y el lint — se recomienda que el equipo ejecute la Fase 7 manualmente contra un entorno de desarrollo aislado antes de desplegar.

## Verificación

- `npx vitest run --no-file-parallelism src/lib/rules-engine` → **139/139 en verde** (incluye los casos nuevos de color por pieza, inventario con color y estructura unificada).
- `npm run build` → compilación limpia (TypeScript, 49 rutas generadas).
- `npm run lint` → **83 problemas**, idéntico al baseline previo a esta sesión — cero hallazgos nuevos en los archivos tocados (verificado grep de cada nombre de archivo contra la salida completa del lint).

## Commit recomendado (no ejecutado)

```
git commit -m "feat: armador de combinaciones por pieza en catalogo corporativo con paridad visual al individual"
```

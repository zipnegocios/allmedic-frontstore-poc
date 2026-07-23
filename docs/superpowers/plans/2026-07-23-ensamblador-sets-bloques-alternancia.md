# Plan — Ensamblador de sets corporativos: bloques de alternancia (elige 1 de 2) + color único + piezas recomendadas

> Prompt de ejecución para Claude Code. Copy, comentarios y documentación en **español (Ecuador)**. Identificadores de
> código en inglés. Commits sugeridos en Conventional Commits (`feat:`/`fix:`/`docs:`), nunca ejecutados. El motor de
> reglas (`src/lib/rules-engine/`) **permanece puro, sin dependencias de DB**. Validado visualmente con dos mockups
> interactivos (admin y PDP) antes de escribir código — este documento ya incorpora todos los ajustes que salieron de
> esa revisión.

## Contexto y objetivo

Hoy el ensamblador de sets (`admin/sets/[id]`) carga una lista plana de piezas — todas obligatorias en cada
combinación. El nuevo modelo introduce **bloques de alternancia**: el set se compone de **exactamente 2 bloques fijos**
(Bloque A y Bloque B), cada uno con **exactamente 2 piezas alternativas** — sin posibilidad de agregar más bloques, por
simplicidad. El cliente final elige **1 opción por bloque** (ej. Camisa
cuello V *o* cuello redondo, combinada con Jogger con bolsillos *o* Jogger elástico). Todo el set se pide en **un solo
color compartido** entre las piezas elegidas; la talla se elige por separado para cada pieza. Además, se incorpora una
lista de **piezas recomendadas** — sugerencias de la misma colección/marca que el cliente agrega libremente a su
cotización, con su propio color, talla y cantidad, sin relación con la lógica de bloques.

## Decisiones cerradas (NO reabrir)

1. **Bloques:** exactamente **2 bloques fijos** (Bloque A / Bloque B), cada uno con **exactamente 2 piezas**. No hay
   botón para agregar un Bloque C ni ningún bloque adicional — se descartó explícitamente por agregar complejidad
   innecesaria.
2. **Piezas recomendadas:** una sola lista para todo el set (no varía por bloque). No son obligatorias, no forman
   parte del combo, y **no afectan el precio referencial del set**.
3. **Precio referencial del set:** cuando las 2 opciones de un bloque tienen precios distintos, se muestra el
   **mínimo** de cada bloque, sumado entre bloques — "Desde $X" — tanto en el grid como en la ficha, antes de que el
   cliente elija.
4. **Migración de datos:** no aplica. El único set existente fue eliminado — impacto 0 en producción.
5. **Cantidad por set:** se define **una sola vez por bloque** (compartida entre sus 2 alternativas), no por pieza
   individual.
6. **Color: uno solo para toda la combinación.** El cliente NO elige color por pieza — elige un único color que se
   aplica a la vez a la pieza elegida del Bloque A y a la del Bloque B (y de cualquier otro bloque). Las opciones de
   color visibles son la **intersección** de los colores disponibles entre las piezas actualmente elegidas en cada
   bloque. Si dos piezas elegidas no comparten ningún color, se bloquea "Agregar combinación" y se muestra una
   advertencia — nunca se deja elegir un color inválido ni se oculta el problema.
7. **Talla: independiente por pieza.** Cada pieza elegida (una por bloque) tiene su propio selector de talla, sin
   relación con las tallas de las otras piezas de la combinación.
8. **Preselección por defecto:** al cargar la ficha pública, cada bloque ya trae seleccionada su **primera pieza**, y
   el color se autoselecciona con el primero disponible de la intersección resultante. Si el cliente cambia de pieza
   en un bloque y el color activo deja de ser válido, el color se reajusta automáticamente al primero disponible de la
   nueva intersección — nunca queda en un estado inválido. **La talla no tiene default** — el cliente siempre debe
   elegirla explícitamente.
9. **Cantidad de la combinación:** el campo "Cantidad de sets con esta combinación" se prellena con el valor resuelto
   de la regla `MIN_QUANTITY` del Motor de Reglas (dinámico, nunca hardcodeado), para que el cliente no tenga que
   adivinar el mínimo.
10. **Piezas recomendadas en la cotización:** se registran como **línea independiente** en el carrito corporativo
    (precio, color, talla y cantidad propios) — no cuentan para `MIN_QUANTITY`, `COLOR_RESTRICTION` ni
    `INVENTORY_MODE` de los sets.
11. **Atajo de creación en el admin:** cada una de las 2 piezas de cada bloque tiene, además del ícono de editar
    (abre el wizard sobre el producto ya elegido), un ícono de **crear producto nuevo** — abre el mismo wizard en modo
    creación y, al guardar, el producto recién creado queda preseleccionado automáticamente en esa pieza específica
    (sin agregar una tercera pieza al bloque).
12. **Layout de la PDP (bento, versión escritorio):** de arriba hacia abajo — (a) "Color del set" a todo el ancho;
    (b) las tiras de selección de pieza por bloque, una junto a otra, a todo el ancho; (c) una fila de 2 columnas:
    **izquierda** = galería de doble carril + grupo de tallas debajo, **derecha** = marca/título/descripción +
    "Composición del set" + precio + alerta de compra mínima + instrucciones "Arma tu combinación" + caja con
    cantidad/agregar combinación/combinaciones armadas/agregar al carrito; (d) "Piezas recomendadas" a todo el ancho;
    (e) footer del sitio.
13. **Galería de doble carril:** un riel lateral izquierdo con las fotos de la pieza elegida en el Bloque A, un riel
    lateral derecho con las fotos de la pieza elegida en el Bloque B, y una imagen central que muestra la foto
    activa. Clic en cualquier miniatura de cualquiera de los 2 rieles carga esa foto en el centro. Cada riel muestra
    flechas de desplazamiento cuando la pieza tiene más de 4 fotografías en el color elegido.
14. **Grupo de tallas:** debajo de la galería, un solo bloque visual que contiene el selector de talla de la pieza del
    Bloque A y el de la pieza del Bloque B, unidos por un conector "+" flotante entre ambos — reforzando que se están
    combinando.

## Decisiones técnicas propuestas por Claude (ajustables — confirmar o vetar antes de ejecutar)

- **Esquema con 2 tablas nuevas** (`set_blocks` + `set_block_options`) en vez de agregar columnas sueltas a
  `set_items`: evita duplicar `quantityPerSet` en 2 filas del mismo bloque. `set_blocks` queda restringida a
  exactamente 2 filas por set (`block_code enum('A','B')`, `UNIQUE(set_id, block_code)`) — la tabla existe por
  prolijidad de esquema, no para habilitar una cantidad variable de bloques.
- **La fila de combinación en el carrito guarda el color UNA sola vez** (no por pieza):
  `{ id, quantity, selections: [{ blockId, productId, size }], colorCode }` — más simple y más fiel a la regla de
  color único que un `pieceSelections[].color` por pieza.
- **`pieceCount`** en `CorporateSetSummary` pasa a significar "número de bloques" en vez de "piezas cargadas".
- **`getSetPiecesByIds`** (motor de reglas, ámbito PRODUCTO) sigue devolviendo todas las opciones posibles + piezas
  recomendadas, porque una regla de ese ámbito puede apuntar a cualquiera sin importar cuál se elija después. Esto es
  distinto de `piecesPerSet` (que sí depende del número de bloques, no del número de opciones).
- **`COLOR_RESTRICTION` se simplifica**: como el color es único por fila de combinación, la evaluación por pieza usa
  ese mismo `colorCode` para ambas piezas de la fila, en vez de resolver un color distinto por pieza.
- **Advertencia de "sin color en común"** también disponible como chequeo suave en el admin (no bloqueante): si dos
  piezas de un mismo bloque, cruzadas con las de otro bloque, no comparten ningún color en ninguna combinación
  posible, se muestra un aviso al guardar el set — evita publicar un set imposible de cotizar.
- **Fotos por color por pieza:** se reutiliza el mismo patrón de `colorVariant.images` que ya usa el catálogo
  individual — confirmar en la auditoría si `getCorporateSetBySlug` ya expone esto o falta extenderlo.

## Fase 0 — Auditoría previa (obligatoria antes de tocar código)

Producir `docs/audits/AUDITORIA-ensamblador-bloques.md` con matriz verificada leyendo el código real:

1. Todos los consumidores actuales de `setItems` (`corporate-data-service.ts`, `SetForm.tsx`/`PiecesSection.tsx`,
   `getSetPiecesByIds`, `getSetMetaByIds`, cualquier serialización de carrito/cotización) — confirmar que no queda
   ninguno huérfano tras el reemplazo.
2. Forma exacta y puntos de consumo de `pieceSelections` en `CorporateCartContext`, `SetDetailContent.tsx`,
   `validate.ts`, servicio de inventario (confirmar estado real de `INVENTORY_MODE` pese al plan de supresión de stock
   en curso).
3. Cómo `getCorporateSetBySlug` trae variantes hoy: ¿incluye imágenes por variante/color? ¿Cuántas fotos por color
   suele haber cargadas? Esto determina si el umbral de "más de 4 fotografías" para las flechas del carrusel es
   realista con los datos actuales.
4. Confirmar `RULE_DOCS` de `MIN_QUANTITY`, `COLOR_RESTRICTION`, `INVENTORY_MODE` — localizar texto que diga "todas
   las piezas del set" para actualizar a "la pieza elegida en cada bloque", y confirmar dónde se resuelve el valor
   numérico de `MIN_QUANTITY` para poder prellenar el campo de cantidad en la PDP.
5. Doble verificación: confirmar en base de datos real que `set_items`/`corporate_sets` no tienen filas activas antes
   del `DROP`.

**No escribir lógica nueva hasta cerrar esta matriz.** Si algo contradice este plan, detenerse y reportarlo.

## Fase 1 — Esquema y tipos

- **Migración Drizzle:**
  - Crear `set_blocks`: `id, set_id (FK), block_code enum('A','B'), quantity_per_set integer default 1, created_at,
    updated_at` — `UNIQUE(set_id, block_code)`. Exactamente 2 filas por set (Bloque A y Bloque B), sin más.
  - Crear `set_block_options`: `id, block_id (FK), product_id (FK), sort_order integer, created_at` — exactamente 2
    filas por bloque, validado en zod (no en constraint de DB).
  - Crear `set_recommended_items`: `id, set_id (FK), product_id (FK), sort_order integer, created_at`.
  - `DROP TABLE set_items` (tabla vacía, impacto 0 confirmado).
- **`src/db/schema/corporate.ts`:** agregar las 3 tablas nuevas, quitar `setItems`.
- **`corporate-types.ts`:**
  - `SetPiece` se mantiene igual, ahora incluye `imagesByColor: Record<string, MediaItem[]>` (o estructura
    equivalente ya existente en el retail).
  - Nuevo `SetBlock { id, blockCode: 'A' | 'B', quantityPerSet, options: [SetPiece, SetPiece] }`.
  - `CorporateSetDetail`: `pieces: SetPiece[]` → `blocks: [SetBlock, SetBlock]` (tupla fija de 2, nunca más ni menos) +
    `recommendedPieces: SetPiece[]`.
  - `CorporateSetSummary`: `pieceCount` = número de bloques; agregar `hasRecommendedItems: boolean`.
  - Forma de la fila de combinación en el carrito: `{ id, quantity, colorCode, selections: Array<{ blockId,
    productId, size }> }`.

## Fase 2 — Backend: `corporate-data-service.ts`

- Reescribir `getActiveCorporateSets`/`getCorporateSetBySlug` para traer `blocks` (con sus 2 `options` completas:
  colores, tallas, imágenes por color, igual que hoy) y `recommendedPieces`.
- `referencePrice`: por bloque, `min(priceWholesaleOf(opción)) × quantityPerSet`, sumado entre bloques → "Desde $X".
  El override `priceManual` del set sigue ganando sin cambios de precedencia.
- `getSetPricesByIds`: mismo criterio de mínimo por bloque.
- `getSetMetaByIds`: `piecesPerSet` = suma de `quantityPerSet` de todos los bloques (no de las opciones cargadas).
- `getSetPiecesByIds`: devuelve todas las opciones + recomendadas para resolución de ámbito Producto.
- Nuevo helper `getBlockColorIntersections(setId)`: para el chequeo suave de "sin color en común" en el admin.

## Fase 3 — Motor de reglas (puro, sin romper contratos existentes)

- `SetMeta.pieces` conserva su forma (`SetPieceInfo[]`).
- `COLOR_RESTRICTION`/`INVENTORY_MODE` se evalúan sobre las piezas **realmente elegidas** por fila (una por bloque),
  usando el `colorCode` único de la fila para todas ellas — coherente con la Decisión 6.
- Piezas recomendadas quedan fuera de `COLOR_RESTRICTION`/`INVENTORY_MODE`/`MIN_QUANTITY`.
- Actualizar `RULE_DOCS` de los 3 tipos afectados con la semántica nueva.
- Tests Vitest: combinación válida por bloque, bloque incompleto, `MIN_QUANTITY` con `piecesPerSet` recalculado,
  `COLOR_RESTRICTION` con color único de fila, intersección de color vacía entre 2 piezas.

## Fase 4 — Admin: `SetForm.tsx` y componentes de bloques

- Reemplazar `PiecesSection.tsx` por `BlockSection.tsx`, renderizado **exactamente 2 veces** (Bloque A, Bloque B) —
  sin botón para agregar un tercer bloque ni para quitar los existentes.
- Cada bloque exige **exactamente 2 filas**, sin botón para agregar una tercera. Validación zod: ambos `productId`
  completos antes de guardar.
- Cada pieza (fila) tiene **2 íconos**: **crear producto nuevo** (abre el wizard embebido en modo creación;
  al guardar, el producto resultante reemplaza el contenido de esa fila específica) y **editar producto** (abre el
  wizard sobre el producto ya elegido). Reutiliza el drawer con `ProductForm` ya existente.
- Un solo campo **"Cantidad por set"** en la cabecera de cada bloque (no por fila).
- Nuevo `RecommendedItemsSection.tsx`: reutiliza el patrón libre actual ("Agregar pieza"/"Crear producto nuevo", sin
  límite, sin campo de cantidad).
- `PriceSection.tsx`: vista previa muestra "Desde $X" (suma de mínimos por bloque × cantidad); el toggle de precio
  manual del set no cambia.
- Aviso suave (no bloqueante) si, cruzando las opciones de todos los bloques, ninguna combinación posible comparte un
  color — usa `getBlockColorIntersections`.
- `schema.ts`: `blocks: [BlockFormData, BlockFormData]` (tupla fija de 2) + `recommendedItems:
  RecommendedItemFormData[]`.

## Fase 5 — PDP: `SetDetailContent.tsx`

- **Layout bento (Decisión 12):** implementar exactamente el orden de secciones descrito, con la fila de 2 columnas
  (galería+tallas / info+armador) fija en escritorio; en mobile, ambas columnas se apilan (galería y grupo de tallas
  primero, luego el panel de info) — sin duplicar componentes, solo cambia la disposición vía clases responsive.
- **Selector de color global (Decisión 6):** un solo grupo de swatches arriba de todo, opciones = intersección de
  colores entre la pieza elegida de cada bloque. Si la intersección queda vacía, mostrar advertencia y bloquear
  "Agregar combinación".
- **Tiras de bloque:** por cada bloque, sus 2 opciones como chips seleccionables (miniatura + nombre); la primera
  viene preseleccionada (Decisión 8). Cambiar de opción resetea la talla de esa pieza y reajusta el color si ya no es
  válido.
- **Galería de doble carril (Decisión 13):** riel izquierdo = fotos de la pieza elegida en el Bloque A en el color
  activo; riel derecho = fotos de la pieza elegida en el Bloque B. Al ser siempre exactamente 2 bloques, la galería
  de 2 rieles queda cerrada, sin casos de 3+ bloques que resolver. Flechas de desplazamiento cuando hay más de 4
  fotos.
- **Grupo de tallas (Decisión 14):** debajo de la galería, un panel por pieza elegida con su selector de talla, unidos
  por el conector "+". Sin talla por defecto.
- **"Composición del set" dinámica:** una línea por pieza elegida, mostrando color (compartido) + talla (si ya se
  eligió, si no "elige talla") + precio real de esa pieza. El precio total del set se recalcula en vivo.
- **Alerta de compra mínima:** valor de `MIN_QUANTITY` resuelto por el motor de reglas, nunca hardcodeado.
- **"Arma tu combinación":** instrucciones + caja con "Cantidad de sets con esta combinación" (prellenada con el
  mínimo de compra), botón "Agregar combinación" (deshabilitado hasta que todas las tallas y el color sean válidos),
  lista "Combinaciones armadas" (removible), botón "Agregar al carrito corporativo".
- **Piezas recomendadas:** sin cambios respecto a lo ya validado — color/talla/cantidad independientes, botón
  "Agregar a la cotización" por ítem.

## Fase 6 — Carrito corporativo y cotización

- `CorporateCartLine` gana discriminador `type: 'SET_COMBINATION' | 'RECOMMENDED_ITEM'`.
- Forma de `SET_COMBINATION`: `{ quantity, colorCode, selections: [{ blockId, productId, size }] }` — un solo color
  para toda la fila.
- API de envío revalida en servidor cada línea según su tipo:
  - `SET_COMBINATION`: cada `productId` debe pertenecer a las opciones configuradas de su bloque (rechaza productos
    ajenos); el `colorCode` debe estar disponible en TODAS las piezas seleccionadas de esa fila; corre
    `COLOR_RESTRICTION`/`INVENTORY_MODE`/`MIN_QUANTITY` sobre las piezas elegidas con ese color único.
  - `RECOMMENDED_ITEM`: `productId` debe estar en la lista curada del set; valida color/talla propios; precio =
    `priceWholesaleSale ?? priceWholesale` × cantidad; sin reglas de sets.
- `computeCartPricing`: suma ambos tipos al subtotal, sin tocar `pricing.ts`.
- Snapshot de cotización (PDF/registro): desglose claro entre "sets" (con su color y las tallas por pieza) y "piezas
  adicionales".

## Fase 7 — Documentación y verificación manual

- Actualizar `AGENTS.md`/`PROJECT_MAP.md` si describen el flujo plano viejo.
- Checklist manual (sin MCP Chrome DevTools):
  1. Crear set con 2 bloques (2+2 piezas) + 1 pieza recomendada — guarda sin errores.
  2. Bloque con solo 1 opción → bloquea con mensaje claro. No existe manera de agregar un tercer bloque ni de quitar
     el Bloque A o el Bloque B — el set siempre tiene exactamente esos 2.
  3. Crear producto nuevo desde el ícono de una pieza del bloque → wizard se abre, al guardar reemplaza esa pieza
     específica (no agrega una tercera).
  4. PDP: al cargar, ambos bloques ya tienen su primera opción seleccionada y un color válido; cambiar de opción en
     un bloque reajusta el color si hace falta y resetea esa talla.
  5. Elegir 2 piezas sin color en común (si el catálogo de prueba lo permite) → advertencia visible, "Agregar
     combinación" deshabilitado.
  6. Galería: clic en miniaturas de ambos rieles carga la foto correcta en el centro; con 5+ fotos aparecen flechas.
  7. Cantidad de la combinación llega prellenada con el valor real de `MIN_QUANTITY`.
  8. Agregar combinación + pieza recomendada → "Agregar al carrito corporativo" refleja ambas líneas correctamente.
  9. Envío con `productId` o `colorCode` manipulado vía curl → rechazo en servidor.
  10. `COLOR_RESTRICTION`/`MIN_QUANTITY` funcionan sobre combos y NO aplican a recomendadas.
  11. `npm run build && npm run lint && npm run typecheck && npm run test` en verde.

## Restricciones finales

- Motor de reglas puro, sin dependencias de DB.
- Sin duplicación de componentes mobile/desktop — misma PDP, presentación condicional vía Tailwind.
- Copy/comentarios/docs en español (Ecuador); identificadores en inglés.
- Sin `git commit`/`push` automático — solo Conventional Commits sugeridos al cierre de la ejecución real.
- Sin archivos Markdown de cierre — el reporte final va directo en el chat de esa sesión, con el formato obligatorio
  (Resumen Ejecutivo, Verificación Manual en Producción, Migraciones Ejecutadas, Builds y Validaciones, Commits
  Sugeridos).

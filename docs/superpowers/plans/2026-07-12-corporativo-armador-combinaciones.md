# PLAN — Catálogo corporativo: paridad visual con el individual + armador de combinaciones por pieza

> Prompt de ejecución para Claude Code. Idioma de todo el copy, comentarios y docs: **español (Ecuador)**.
> Commits: convención `feat:` / `fix:` / `docs:`. Sin errores de lint. El motor de reglas (`src/lib/rules-engine/`) **permanece puro, sin dependencias de DB** — restricción dura.

---

## Contexto y objetivo

El catálogo corporativo (`/corporativo` y `/corporativo/s/[slug]`) debe alcanzar la calidad visual y de interacción del catálogo individual, y evolucionar su flujo de compra a un **armador de combinaciones**: el comprador corporativo construye filas de pedido donde **cada pieza del set elige su propio color y talla**, y cada fila lleva una cantidad de sets.

### Decisiones ya tomadas (NO reabrir)

1. **Granularidad:** color y talla se eligen **por pieza individual** dentro de cada combinación. `pieceSelections` gana `color`.
2. **SIZE_MODE (híbrido):** el armador de combinaciones es el flujo único. Los 3 modos sobreviven como configuración de comportamiento dentro del armador — sin opciones muertas:
   - `MATRIX` → el armador muestra un **atajo prominente "todo el set en la misma talla"** que rellena la talla de todas las piezas de un tap; el usuario puede luego ajustar piezas individuales.
   - `PER_PIECE` → armador sin atajo (es el comportamiento por defecto del armador).
   - `NO_SIZES` → el armador **oculta los selectores de talla**; solo se elige color por pieza y cantidad.
3. **COLOR_RESTRICTION:** se evalúa **por fila de combinación, por pieza**. Unidades de una pieza en un color en una fila = `cantidadDeSets × quantityPerSet`. Si es menor al mínimo configurado para ese color → bloquear el envío con mensaje que nombre **pieza, color y mínimo exigido**.

### Decisiones menores resueltas en este plan (implementar tal cual, documentar en el reporte)

- **Proporción de imagen:** NO hardcodear un ratio nuevo. Leer la clase de aspect ratio real de `src/components/catalog/ProductCard.tsx` (imagen de tarjeta) y de `src/components/product/ImageGallery.tsx` (imagen principal) y **reutilizar exactamente las mismas** en el grid corporativo y la ficha del set. Reutilizar `MediaGridThumb` en las tarjetas.
- **INVENTORY_MODE con color:** la clave de demanda y del snapshot pasa de `productId::size` a `productId::size::color` cuando la selección especifica color (fallback agregado por `productId::size` si la pieza no tiene color elegido, y `productId` en NO_SIZES sin tallas). `checkInventory` (servidor) agrupa variantes activas por esa misma clave. El motor sigue recibiendo el snapshot ya construido — puro.
- **Compatibilidad de carrito persistido:** líneas viejas (color por línea, `pieceSelections` sin color) deben cargar sin romper: migrar en lectura propagando `line.color` a cada `pieceSelection.color` y eliminar el campo de línea. Documentar la migración en el código.
- **Estética:** mantener el sistema visual existente (`#111111`, `#F5F5F7`, bordes `#E5E5E5`, botones `rounded-full`, tipografía actual). La paridad con el individual ES el objetivo de diseño — no introducir una dirección visual nueva.

---

## Fase 0 — Auditoría previa (obligatoria antes de tocar código)

Producir `docs/audits/AUDITORIA-corporativo-armador.md` con una matriz verificada leyendo el código real:

1. Clase exacta de aspect ratio en `ProductCard.tsx` y en `ImageGallery.tsx` (individual).
2. Forma actual de `pieceSelections` y **todos** sus puntos de consumo: `CorporateCartContext`, `SetDetailContent`, `validate.ts`, `checkInventory`/servicio de inventario, API de envío del carrito corporativo, y cualquier serialización persistida.
3. Cómo `getCorporateSetBySlug` trae variantes hoy: ¿incluye imágenes por variante/color? ¿Qué falta para exponer `images` por color por pieza (equivalente a `colorVariant.images` del retail)?
4. Puntos de resolución de `SIZE_MODE`, `COLOR_RESTRICTION` e `INVENTORY_MODE` (UI, validate, API) — confirmar contra `docs/audits/AUDITORIA-motor-reglas.md` y el reporte `REPORTE-reglas-ambitos-2026-07-13.md`.
5. Componentes reutilizables del individual: `ColorSwatchGroup`, `SizeSelector`, `ImageGallery`, `MediaGridThumb` — props y contratos.

**No escribir lógica nueva hasta cerrar esta matriz.** Si algo contradice este plan, detenerse y reportarlo antes de continuar.

## Fase 1 — Datos y tipos

- `corporate-data-service.ts`: `SetPiece` gana, por pieza, la lista de colores disponibles con `{ id, code, name, hex, images: MediaItem[] }` derivada de variantes **activas** del producto (mismo criterio que el retail: imágenes de la variante del color; fallback a placeholder). Sin N+1: consultas agregadas.
- `corporate-types.ts`: nueva forma de línea de carrito corporativo:
  - `combinations: Array<{ quantity: number; pieces: Array<{ productId: string; size?: string; color?: string }> }>` — o bien una fila de combinación = una línea de carrito con `pieceSelections` extendido; elegir la forma que menos rompa `CorporateCartContext` y documentar la elección.
- Migración en lectura del carrito persistido (ver decisiones menores).

## Fase 2 — Motor de reglas (puro, con tests Vitest)

- `types.ts` / `validate.ts`: `pieceSelections` con `color` opcional por pieza.
- `COLOR_RESTRICTION`: nueva evaluación por fila × pieza (semántica decidida arriba). Mensajes de error en español nombrando pieza, color y mínimo.
- `INVENTORY_MODE`: claves de demanda/snapshot con color (ver decisiones menores). Los tres modos (`IGNORE`/`INFORMATIVE`/`BLOCK`) siguen funcionando; `BLOCK` bloquea por combinación exacta color+talla.
- `SIZE_MODE`: sin cambios de tipo — cambia su **significado documentado** (comportamiento del armador). Actualizar `RULE_DOCS` de los tres tipos afectados (`SIZE_MODE` si existe como doc, `COLOR_RESTRICTION`, `INVENTORY_MODE`): summary, detail, examples, warnings — reflejando la semántica nueva con honestidad (patrón ya establecido).
- Tests: casos por modo de talla, con y sin color, fila que cumple/no cumple COLOR_RESTRICTION, demanda agregada correcta para INVENTORY_MODE con múltiples filas que comparten pieza+talla+color.

## Fase 3 — Listado corporativo (`CorporativoContent`)

- Tarjetas de set con **la misma proporción de imagen** que `ProductCard` (clase leída en Fase 0) y `MediaGridThumb`.
- Mantener grid, filtros y visibilidad de precios por set tal como están (no regresionar la resolución por ítem de `PRICE_VISIBILITY`).

## Fase 4 — Ficha del set: el armador de combinaciones (`SetDetailContent`)

Estructura de la página (desktop dos columnas como el individual; móvil apilado):

1. **Galería principal del set** con la misma proporción y componente de galería del individual (`ImageGallery` o extracción reutilizable): imagen de portada del set + imágenes destacadas de las piezas.
2. **Sección "Piezas del set":** cada pieza como tarjeta con:
   - Mini-galería propia (misma proporción, `MediaGridThumb` + miniaturas) que **reacciona al color elegido de esa pieza** — igual que el retail cambia imágenes por color.
   - `ColorSwatchGroup` (mismo componente del individual) con los colores de esa pieza.
   - `SizeSelector` (mismo componente) con las tallas de esa pieza — oculto en `NO_SIZES`.
3. **Atajo MATRIX** (solo cuando `sizeMode === 'MATRIX'`): control "Todo el set en talla ___" que propaga la talla a todas las piezas (solo tallas comunes); tras usarlo, las piezas siguen siendo editables individualmente.
4. **Filas de combinación:** botón "Agregar combinación" que congela la selección actual (color+talla por pieza + cantidad de sets) como una fila visible — con mini-swatches por pieza, tallas, cantidad editable y botón eliminar. Las filas se acumulan antes de "Agregar al carrito corporativo".
5. **Disponibilidad** (si `inventoryMode !== 'IGNORE'`): mostrar sets disponibles por combinación exacta (pieza más escasa en su color+talla), junto a cada fila y en la selección activa. `BLOCK` deshabilita agregar la fila con explicación.
6. **Validación en vivo de COLOR_RESTRICTION:** si una fila no alcanza el mínimo de un color, marcar la fila con el mensaje (patrón "no dead option": el usuario ve por qué, antes de llegar al envío).
7. Mantener: mínimo de compra (`MIN_QUANTITY`), precios referenciales, `PRICE_VISIBILITY`, composición del set.

Copy en español, voz activa, etiquetas que nombran lo que el usuario controla ("Agregar combinación", "Todo el set en la misma talla").

## Fase 5 — Carrito corporativo y validación de servidor

- `CorporateCartContext` + drawer/página del carrito: mostrar cada fila de combinación con su desglose por pieza (color + talla), editable en cantidad, eliminable.
- API de envío: `validate.ts` con la nueva forma; el servidor re-valida COLOR_RESTRICTION, MIN_QUANTITY e INVENTORY_MODE con las mismas funciones puras — la UI nunca es la única barrera.

## Fase 6 — Panel admin y documentación

- `RuleForm.tsx`: revisar que ninguna opción quede muerta o cambie de significado sin reflejarlo en la ayuda contextual (`RULE_DOCS`).
- Actualizar `AGENTS.md` (flujo corporativo nuevo) y `PROJECT_MAP.md` si describe el flujo viejo.
- Reporte final `docs/reports/REPORTE-corporativo-armador-<fecha>.md`: qué cambió, decisiones, semánticas nuevas de reglas, migración de carrito.

## Fase 7 — Verificación manual (cierre obligatorio)

Ciclo `curl` + navegación manual:

1. `GET /corporativo` — tarjetas con proporción idéntica a `/catalogo` (comparar visualmente).
2. Ficha de un set con ≥2 piezas y ≥2 colores: cambiar color de una pieza cambia sus fotos; armar 2 filas con combinaciones distintas; atajo MATRIX propaga talla.
3. Regla `COLOR_RESTRICTION` activa: fila por debajo del mínimo se marca en UI **y** el envío se bloquea en servidor (curl al endpoint con payload inválido → error nombrando pieza/color/mínimo).
4. `INVENTORY_MODE=BLOCK`: combinación sin stock exacto color+talla no se puede agregar; curl al endpoint confirma bloqueo de servidor.
5. Carrito viejo persistido (línea con color a nivel de línea) carga sin errores tras la migración.
6. `npm run lint` y suite Vitest en verde.

---

## Restricciones finales

- Motor de reglas puro — cualquier dato de DB entra como snapshot/parámetro.
- Seguir patrones existentes (resolución de ámbitos estilo `PROMO`, snapshots estilo `INVENTORY_MODE` actual).
- Todo copy/comentarios/docs en español (Ecuador).
- Documentación (`RULE_DOCS`, auditoría, `AGENTS.md`, reporte) se actualiza **en la misma sesión**, no después.

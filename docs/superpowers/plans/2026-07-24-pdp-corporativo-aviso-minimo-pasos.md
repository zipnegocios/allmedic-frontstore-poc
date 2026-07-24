# Plan — PDP corporativo: popover de compra mínima global + guía de 2 pasos

> Prompt de ejecución para Claude Code. Copy, comentarios y documentación en **español (Ecuador)**, registro "tú"
> consistente. Identificadores de código en inglés. Commits sugeridos en Conventional Commits, nunca ejecutados. El
> motor de reglas permanece puro. Este plan es un incremento sobre el PDP corporativo ya construido (bloques A/B,
> `isPaired`/`isMixed`, `BlockStrip`, `SizeRow`, `CompositionCard`, `CombinationBuilderCard`) — no lo rediseña, lo
> complementa.

## Contexto y objetivo

Dos mejoras de comprensión para el cliente en la PDP corporativa:

1. Un botón circular informativo junto al breadcrumb que explica, en un popover, que el pedido mínimo es **por
   carrito completo**, no por cada set individual que el cliente esté viendo.
2. Reordenar la selección de pieza+talla y la selección de color en dos columnas rotuladas como "Paso 1" y "Paso 2",
   para que el cliente entienda de un vistazo el orden de la interacción — **solo en sets `isPaired`**; los sets
   `isMixed` conservan su tarjeta de combinaciones curadas sin cambios.

## Decisiones cerradas (NO reabrir)

1. **Interacción del botón informativo:** popover flotante (no banner inline) — no empuja el contenido de abajo,
   abre/cierra al hacer clic en el botón o afuera del popover.
2. **Copy del popover:**
   > "El mínimo de {N} sets es por carrito, no por cada set que veas. Combina distintos sets, colores y tallas del
   > catálogo corporativo hasta completarlo."

   `{N}` se lee del mismo valor de `MIN_QUANTITY` (ámbito global, sets) ya resuelto para el aviso gris existente —
   una sola fuente de verdad, nunca hardcodeado ni recalculado en paralelo.
3. **Alcance del rediseño de 2 pasos:** aplica únicamente a sets `isPaired`. Los sets `isMixed` mantienen su título
   "Color del set" + tarjeta de selector de combinaciones curadas exactamente como está hoy — no se toca su lógica
   ni su layout.
4. **Paso 1 — "Elige la prenda":** columna izquierda. Contiene el `BlockStrip`/`SizeRow` de los bloques A y B ya
   existentes, sin tocar su lógica interna — solo se envuelven bajo este encabezado.
   > "Elige una pieza de cada bloque y su talla. Puedes usar tallas distintas en cada una — por ejemplo, camisa en L
   > y pantalón en M."
5. **Paso 2 — "Elige el color del set":** columna derecha. Contiene el `ColorSwatchGroup` (o el aviso ámbar de "sin
   color en común") ya existente, sin tocar su lógica — solo envoltorio.
   > "Un solo color para las 2 piezas que elegiste en el paso 1. Apenas lo elijas, verás su nombre junto al
   > selector." (el nombre del color junto al swatch ya existe hoy — se conserva tal cual).
6. **Badges numerados:** "1" y "2" junto a cada encabezado, como elemento visual separado del texto (no concatenado
   en el string del heading).
7. **Registro de copy consistente:** ambos encabezados en "tú" — corregir "SELECCIONE EL COLOR DEL SET" a "ELIGE EL
   COLOR DEL SET" (mismo verbo que "ELIGE LA PRENDA", refuerza que son un mismo patrón de 2 pasos).
8. **Aviso gris inferior de compra mínima:** se actualiza para no sonar contradictorio frente al nuevo popover
   global:
   > "Compra mínima: {N} sets en tu carrito, combinables entre distintos sets. Precio referencial — sujeto a
   > cotización formal."

   Mismo `{N}`, misma fuente que el popover — nunca una segunda resolución de la regla.

## Fase 0 — Auditoría previa (obligatoria antes de tocar código)

Producir hallazgos en el chat (no requiere archivo de auditoría aparte, dado el tamaño acotado del cambio):

1. Ubicar el componente/lugar exacto donde hoy se resuelve y se muestra el valor de `MIN_QUANTITY` para el aviso
   gris — confirmar que es una función/valor reutilizable directamente por el nuevo popover, sin duplicar la
   resolución de la regla.
2. Confirmar dónde vive el flag `isPaired`/`isMixed` y cómo se determina, para condicionar correctamente el nuevo
   layout de 2 pasos.
3. Confirmar si el proyecto ya usa `Popover` de shadcn/ui en algún otro punto (para mantener consistencia visual) o
   si hay que instalarlo/agregarlo por primera vez.
4. Confirmar la estructura exacta del JSX actual de "Color del set" (título + descripción + `ColorSwatchGroup`/aviso
   ámbar) y de la fila de bloques (`BlockStrip` + `SizeRow` × 2), para envolverlos sin duplicar ni reescribir su
   lógica interna.

Si algún hallazgo contradice este plan, detenerse y reportarlo antes de continuar.

## Fase 1 — Popover informativo de compra mínima

- Nuevo componente (ej. `MinQuantityInfoPopover.tsx`): botón circular con ícono `Info` (lucide-react), estilo
  informativo azul (no ámbar, no gris neutro), ubicado junto al breadcrumb en la misma fila (`justify-between`).
- Contenido del popover: copy de la Decisión 2, con `{N}` interpolado desde el valor ya resuelto (Fase 0.1).
- Se actualiza en vivo si el administrador cambia el valor de la regla `MIN_QUANTITY` — sin caché ni valor
  hardcodeado en el componente.

## Fase 2 — Guía de 2 pasos (solo `isPaired`)

- Nuevo wrapper de 2 columnas (mismo patrón responsive ya usado en el resto de la PDP: se apila en mobile) que,
  condicionado a `isPaired`, envuelve:
  - **Columna izquierda:** encabezado "Elige la prenda" + badge "1" + copy de la Decisión 4 + `BlockStrip`/`SizeRow`
    de los bloques A y B, tal como existen hoy.
  - **Columna derecha:** encabezado "Elige el color del set" + badge "2" + copy de la Decisión 5 +
    `ColorSwatchGroup`/aviso ámbar, tal como existen hoy.
- Si `isMixed`: sin cambios — se mantiene el título "Color del set" + tarjeta de selector de combinaciones curadas
  actual, sin envolver en columnas ni renombrar.
- Fix de copy: "SELECCIONE EL COLOR DEL SET" → "ELIGE EL COLOR DEL SET".

## Fase 3 — Aviso inferior de compra mínima

- Actualizar el copy del aviso gris existente a la Decisión 8, reutilizando el mismo `{N}` ya resuelto (Fase 0.1) —
  sin introducir una segunda función de resolución de `MIN_QUANTITY`.

## Fase 4 — Verificación manual

Checklist (sin MCP Chrome DevTools):

1. El popover abre al hacer clic en el botón circular, cierra al hacer clic afuera o en el botón de nuevo, y no
   desplaza el contenido de la página.
2. Cambiar el valor de `MIN_QUANTITY` desde el admin y confirmar que **tanto el popover como el aviso gris**
   reflejan el nuevo número, sin discrepancia entre ellos.
3. Set `isPaired`: aparecen las 2 columnas "1 · Elige la prenda" / "2 · Elige el color del set", con el
   `BlockStrip`/`SizeRow` y el `ColorSwatchGroup` funcionando exactamente igual que antes dentro de su nuevo
   envoltorio.
4. Set `isMixed`: el layout NO cambia — sigue mostrando "Color del set" + selector de combinaciones curadas como
   hoy.
5. Ambos encabezados en registro "tú", sin mezclar con "usted".
6. Responsive: en mobile las 2 columnas se apilan sin duplicar componentes.
7. `npm run build && npm run lint && npm run typecheck && npm run test` en verde.

## Restricciones finales

- Motor de reglas puro, sin dependencias de DB — el popover y el aviso solo leen un valor ya resuelto, no
  reimplementan la resolución de `MIN_QUANTITY`.
- Sin duplicación de componentes mobile/desktop.
- Copy en español (Ecuador), registro "tú" consistente; identificadores en inglés.
- Sin `git commit`/`push` automático — solo Conventional Commits sugeridos al cierre.
- Sin archivos Markdown de cierre — el reporte final va directo en el chat, con el formato obligatorio (Resumen
  Ejecutivo, Verificación Manual en Producción, Migraciones Ejecutadas, Builds y Validaciones, Commits Sugeridos).

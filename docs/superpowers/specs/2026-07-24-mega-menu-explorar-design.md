# Mega Menu "Explorar": hover, tabs (Sets/Marcas/Sucursales), tamaños

## Contexto

`src/components/layout/MegaMenu.tsx` + `src/components/layout/Header.tsx` implementan el menú
"Explorar" como un panel toggle-by-click (`isMegaMenuOpen` booleano + botón "Cerrar" explícito),
con 3 tabs: `products` (categorías de productos individuales), `brands` (cards de marca con
nombre + contador), `stores`. El mobile usa un drawer completamente separado (`isMobileMenuOpen`)
y no se ve afectado por este cambio.

## Hallazgos de auditoría (Fase 0)

- `isMegaMenuOpen` hoy es un `useState<boolean>` simple, toggled por click en el botón. No existe
  listener de click-outside — el cierre por click fuera del panel ocurre hoy solo porque hay un
  backdrop full-screen (`bg-black/50 backdrop-blur-sm`) que captura el click. Al eliminar el
  backdrop, hay que agregar un listener real de `document` (`mousedown`) para mantener el cierre
  por click-outside sin overlay visual.
- No existía una función de datos para "últimos N sets creados". `getActiveCorporateSets()`
  (en `src/lib/corporate-data-service.ts`) ya trae `createdAt` (timestamp real de DB, mapeado a
  ISO string) para cada set activo/no-eliminado, pero ordena por `sortOrder`, no por fecha, y
  hace joins pesados (bloques, opciones, variantes, colores, tallas, estilos) innecesarios para
  una card de menú. Se crea una función nueva y más liviana en vez de reutilizar esta.
- No existe un componente `SetCard` reutilizable. El componente que renderiza sets hoy
  (`src/components/catalog/SetListItem.tsx`, usado en `/corporativo`) es una card de **lista
  horizontal ancha** (imagen 96–128px + texto a la derecha), de forma totalmente distinta a la
  card de producto en grid que usa el mega menu. La referencia de "100%" para calcular el 25%
  es la card de producto del propio mega menu (grid `aspect-product` + texto `text-body-sm`),
  no `SetListItem`.
- `BrandNavItem.logoUrl` (en `src/lib/types.ts`) ya es `string | null`. `MegaMenu.tsx` ya
  implementa hoy un fallback cuando `logoUrl` es null (renderiza el nombre de la marca como
  texto) — se conserva esa misma lógica en el nuevo layout de solo-logo.

## Fase 1 — Interacción: hover + click como fallback táctil

Nuevo estado en `Header.tsx`: `megaMenuOpenedBy: 'hover' | 'click' | null` (reemplaza el
`isMegaMenuOpen: boolean` actual; `isMegaMenuOpen` se deriva como `megaMenuOpenedBy !== null`).

Comportamiento sobre el contenedor que envuelve botón + `MegaMenu`:

- **Hover (solo puntero fino):** `onMouseEnter` del contenedor abre el panel con
  `openedBy: 'hover'`, condicionado a `window.matchMedia('(hover: hover)').matches` (para no
  disparar apertura por hover fantasma en touch). `onMouseLeave` cierra tras un delay de
  150–200ms vía `setTimeout` cancelable — si el mouse vuelve a entrar (botón o panel) antes de
  que expire, se cancela el timeout. Este cierre por `mouseleave` solo aplica si
  `openedBy === 'hover'`.
- **Click (fallback táctil, también válido en desktop):** click en el botón alterna: si ya está
  abierto (sea cual sea `openedBy`), cierra; si no, abre con `openedBy: 'click'`. Un click
  siempre "fija" el panel — pisa cualquier apertura previa por hover. En modo `'click'`, el panel
  NO se cierra por `mouseleave`; permanece abierto hasta: nuevo click en el botón, click fuera
  del panel, o `Escape`.
- **Teclado:** `onFocus` del contenedor abre el panel con `openedBy: 'hover'` (modo no
  persistente); `onBlur` del contenedor lo cierra si el nuevo foco quedó fuera del contenedor.
- **Click-outside:** listener de `document` en `mousedown` que cierra el panel solo cuando
  `openedBy === 'click'` y el `target` está fuera de `containerRef`. Sin overlay/backdrop visual
  — se elimina el `bg-black/50 backdrop-blur-sm` que hoy renderiza `MegaMenu.tsx`.
- **Escape:** cierra siempre sin importar `openedBy` (comportamiento ya existente, se mantiene).
- Al cerrar por cualquier vía, `megaMenuOpenedBy` vuelve a `null`.
- El `containerRef` para detectar click-outside vive en `Header.tsx` (envuelve botón + panel),
  no en `MegaMenu.tsx`, ya que ambos deben considerarse "dentro" a efectos de hover/click-outside.

El comportamiento mobile (`isMobileMenuOpen`, drawer aparte) no se toca.

## Fase 2 — Nueva tab "Sets Corporativos"

- Tab `products` → `sets`, label **"Sets Corporativos"**, ícono `Boxes` de `lucide-react`
  (reemplaza `Package`).
- Se elimina `getFeaturedProducts`, `getNewArrivals`, `getProductsByCategory` y las 4
  sub-secciones ("Más Solicitados" / "Nuevos Ingresos" / "Camisas" / "Pantalones") de
  `MegaMenu.tsx`. La tab de sets pasa a tener **una sola sección**, sin sub-navegación.
- Nueva función `getLatestCorporateSets(limit = 8)` en `src/lib/corporate-data-service.ts`:
  - Filtra `isActive = true AND deletedAt IS NULL`.
  - Ordena por `createdAt DESC`, `LIMIT 8`.
  - Trae solo lo necesario para la card chica: `id, slug, name, cover, brandName,
    referencePrice`. Reutiliza el mismo cálculo de precio mínimo por bloque que
    `getActiveCorporateSets` (mínimo de cada bloque × cantidad, sumado entre bloques; precio
    manual pisa el automático si está vigente), pero sin traer colores/tallas/estilos/variantes
    (no aplican en el menú).
  - Retorna un tipo nuevo y liviano `CorporateSetNavItem` (en `src/lib/corporate-types.ts`), no
    reutiliza `CorporateSetSummary` completo.
- `src/app/(store)/layout.tsx` agrega `getLatestCorporateSets()` al `Promise.all` existente y
  pasa `corporateSets` a `AppShell` → `Header` → `MegaMenu` (mismo patrón que
  `products`/`brands`/`stores`), con fallback `[]` si no hay DB disponible.
- "Ver todo" de esta tab apunta a `/corporativo`.

## Fase 3 — Tamaño de las cards de sets (~25%)

Nueva sección tipo `'set'` en el `switch` de `MegaMenu.tsx`, usando la card de producto actual
como referencia de 100%:

- Imagen: mismo componente `MediaGridThumb` + `aspect-product`, dentro de una columna de grid
  mucho más angosta — el ancho de columna produce la reducción proporcional de la imagen (no se
  fuerza un tamaño de píxeles fijo).
- Grid: `grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3` (base tomada del prompt
  original; ajustar solo si el resultado visual queda apretado o con espacio vacío excesivo).
- Nombre del set: `text-[10px]` o `text-xs`, `line-clamp-2` (proporcional al `text-body-sm`
  actual de producto).
- Precio: `text-[10px] font-semibold`, mostrado solo si `showPrices` es `true` y
  `referencePrice !== null`. Si `referencePrice` es `null` (precio bajo cotización), no se
  muestra placeholder ni texto alternativo — se omite el precio para esa card.
- No se muestra marca por separado (el set ya no es un producto individual con `brand` propio).

## Fase 4 — Tab Marcas: solo logo, sin card

Nueva sección tipo `'brand'` simplificada en `MegaMenu.tsx`:

- Se elimina el wrapper `bg-[#F5F5F7] rounded-xl p-4 sm:p-6` — el `<Link>` pasa a
  `className="group p-1"` (padding mínimo), sin fondo, borde ni sombra.
- Contenido: solo el logo (`<img>`), sin nombre de marca ni contador de productos debajo.
  Tamaño de logo se mantiene similar al actual (`max-w-[60px] sm:max-w-[80px]`).
- Fallback cuando `logoUrl` es `null`: se conserva la lógica ya existente (mostrar el nombre de
  la marca como texto), aplicada solo a esa marca puntual.
- Feedback hover: `group-hover:scale-110` o `group-hover:opacity-70` sobre el logo (reemplaza el
  feedback de fondo oscuro que se pierde al quitar la card).
- Layout: contenedor `flex flex-wrap gap-3 items-center` (reemplaza el `grid` actual), para que
  los logos fluyan uno junto a otro sin celdas vacías de grid.
- Todo el `<Link>` sigue siendo el área clickeable completa, navegando a
  `/catalogo?marca=...` (ruta ya usada hoy por la tab de marcas).

## Fase 5 — Eliminar el botón "Cerrar"

- Se quita el `<button onClick={onClose}>` con ícono `X` y texto "Cerrar" de la barra de tabs.
- El `flex items-center justify-between` del contenedor de tabs vuelve a `flex items-center gap-1
  sm:gap-2` simple (ya no hay elemento a la derecha que justifique `justify-between`).
- Vías de cierre restantes, todas ya cubiertas por Fase 1: hover-out (si `openedBy === 'hover'`),
  click fuera del panel (si `openedBy === 'click'`), `Escape`, y cualquier link interno del panel
  (que ya invoca `onClose` en su `onClick`).

## Fuera de alcance

- Comportamiento del drawer mobile (`isMobileMenuOpen`) — no se toca.
- Tab `stores` — sin cambios de diseño ni datos.
- Cualquier cambio a `SetListItem.tsx` o al grid de `/corporativo` — son componentes
  independientes, no compartidos con el mega menu.

## Validación

- Build, lint, typecheck (sin pruebas manuales como mecanismo principal).
- Sin migraciones de base de datos — `getLatestCorporateSets` es una consulta nueva sobre tablas
  ya existentes, no requiere cambios de esquema.
- Verificación visual en desktop (≥1024px) descrita en el prompt original: hover abre/cierra sin
  parpadeo, click/touch mantiene el panel fijo hasta cierre explícito, cards de sets notoriamente
  más chicas con varias por fila, logos de marca pegados sin cajas visibles, sin rastro del botón
  "Cerrar".

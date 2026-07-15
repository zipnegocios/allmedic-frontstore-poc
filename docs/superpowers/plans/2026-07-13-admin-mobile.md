# Plan — Panel Admin usable desde smartphone (mobile-first operativo)

> Guardar este plan en `docs/superpowers/plans/2026-07-13-admin-mobile.md`.
> Ejecutar las fases en orden. La Fase 0 es obligatoria antes de tocar código.

## Contexto

El panel `/admin` de Allmedic Frontstore está diseñado exclusivamente para escritorio y es inutilizable desde un smartphone. Diagnóstico verificado:

- `AdminSidebar` es un `<aside class="w-64">` fijo, siempre visible, sin comportamiento mobile ni hamburguesa. El layout `(dashboard)/layout.tsx` es un `flex` sin breakpoints.
- 24 de 25 páginas admin no contienen ninguna clase responsive (`sm:`, `md:`, `lg:`).
- 11 módulos de listado usan `<Table>` de shadcn y desbordan en viewports de ~390px: `productos`, `cotizaciones`, `prospectos`, `cuentas-corporativas`, `sets`, `grupos-de-sets`, `reglas`, `marcas`, `colores`, `sucursales`, `banners`.
- Padding uniforme `p-8` en todas las páginas.
- Formularios grandes con grids fijos sin breakpoints: `ProductForm.tsx` (~933 líneas), `SetForm.tsx` (~835), `RuleForm.tsx` (~777), `quotes/QuoteEditor.tsx` (~473, con `grid-cols-3` fijo).

Recursos ya disponibles que se deben reutilizar (no reinventar): `src/hooks/use-mobile.ts` (`useIsMobile()`), `src/components/ui/sheet.tsx`, `src/components/ui/drawer.tsx` (vaul), `src/components/ui/accordion.tsx`, shadcn completo, Tailwind 3.4.

## Objetivo

Que el panel admin y **todos** sus módulos sean plenamente manejables desde un smartphone (viewport de referencia: 390×844), sin degradar en absoluto la experiencia desktop actual.

## Decisiones cerradas (no reabrir)

1. **Navegación mobile: barra inferior tipo app (bottom nav)** con 4 módulos + botón "Más".
   - Accesos directos (foco venta diaria): **Cotizaciones · Pedidos (prospectos) · Productos · Cuentas** (Cuentas Corporativas).
   - "Más" abre un Drawer inferior con grid de los módulos restantes: Dashboard, Biblioteca, Banners, Marcas, Colores, Sucursales, Sets Corporativos, Grupos de Sets, Motor de Reglas, Configuración, Cerrar sesión.
   - En desktop (`≥ md`) el `AdminSidebar` actual se mantiene **intacto**; la bottom nav solo existe `< md`.
2. **Listados: tarjetas apiladas en mobile para los 11 módulos con tabla.** La tabla se conserva en desktop; en mobile se renderiza una lista de tarjetas con los campos clave y las acciones accesibles.
3. **Formularios grandes: wizard por pasos en mobile** para `ProductForm`, `SetForm`, `RuleForm` y `QuoteEditor`. En desktop conservan exactamente su estructura actual.

## Decisiones menores resueltas de forma autónoma (flag para revisión)

- **Breakpoint de corte:** `md` (768px) de Tailwind, coherente con `useIsMobile()`. Detección por viewport (`matchMedia`), nunca por user-agent.
- **Dialogs → Drawer en mobile:** los `Dialog` de creación/edición (marcas, colores, banners, grupos-de-sets, biblioteca, presets de cotizaciones) se presentan como Drawer inferior (bottom sheet) en mobile mediante un componente adaptador `ResponsiveDialog`. En desktop siguen siendo `Dialog`.
- **Padding de página:** `p-8` → `p-4 md:p-8` en todas las páginas admin.
- **Touch targets:** mínimo efectivo 44×44px en botones, filas tocables y controles de la bottom nav.
- **Safe areas iOS:** la bottom nav respeta `env(safe-area-inset-bottom)`; el contenido de página recibe `pb` suficiente para no quedar oculto tras la barra.
- **Barra de acciones sticky en formularios mobile:** Guardar/Cancelar (y navegación del wizard) fijos al fondo, sobre la safe area, para no perder los botones tras scroll largo.
- **Wizard = mismo componente, dos presentaciones.** No se duplican formularios. El estado y la validación son únicos; en mobile se agrupa por pasos, en desktop se renderiza como hoy. Prohibido crear `ProductFormMobile.tsx` paralelo.
- **Accesibilidad y calidad base:** focus visible en todos los controles, `prefers-reduced-motion` respetado en transiciones de drawers/wizard, sin scroll horizontal accidental (`overflow-x` controlado).
- **Formularios pequeños** (marcas, colores, sucursales, banners, presets): no llevan wizard; solo apilado a 1 columna + `ResponsiveDialog`.

Si durante la ejecución alguna de estas decisiones menores resulta inviable, documentar la alternativa aplicada en el resumen final en lugar de silenciarla.

---

## Fase 0 — Auditoría obligatoria (sin tocar código)

1. Inventariar **todas** las páginas bajo `src/app/admin/(dashboard)/` (incluidas subrutas `[id]`, `nueva`, `nuevo`) y clasificarlas: listado con tabla / formulario grande / formulario pequeño en dialog / página especial (dashboard home, biblioteca, configuración, detalle de cotización, detalle de prospecto, detalle de cuenta).
2. Para cada listado con tabla: registrar columnas actuales y proponer el subconjunto de campos que irá en la tarjeta mobile (título, subtítulo, badges de estado, metadato secundario, acciones). Regla: la tarjeta debe permitir ejecutar las mismas acciones que la fila de la tabla — **ninguna acción puede perderse en mobile**.
3. Para cada uno de los 4 formularios grandes: mapear sus secciones actuales y proponer la partición en pasos del wizard (nombre de paso, campos incluidos, validaciones que bloquean el avance). Verificar dependencias entre secciones (ej. variantes dependen de tallas/colores elegidos antes).
4. Detectar todos los usos de `Dialog`/`Modal` custom (`src/components/ui/Modal.tsx` incluido) en el admin y decidir por cada uno: migra a `ResponsiveDialog`, pasa a Drawer siempre, o queda igual (justificar).
5. Revisar `QuoteLineEditor`, `MediaPicker`, `MediaDetailDialog`, `RuleConflictsPanel`, `RuleDocPanel`, `QuoteAttachmentUpload`: son componentes embebidos que también deben funcionar en 390px.
6. Verificar si existe configuración de viewport en `src/app/layout.tsx` o en el layout del admin (Next.js la emite por defecto; confirmar que no esté sobreescrita).
7. Producir la matriz completa **módulo → tipo → intervención → archivos afectados** antes de escribir la primera línea de código.

## Fase 1 — Infraestructura mobile del shell admin

1. **`AdminBottomNav`** (`src/components/admin/AdminBottomNav.tsx`):
   - Visible solo `< md` (`md:hidden`), `position: fixed; bottom: 0`, fondo `#111111` coherente con el sidebar, íconos lucide + label corto, estado activo por `usePathname` (mismo criterio de coincidencia que el sidebar).
   - Ítems: Cotizaciones (`FileText`), Pedidos (`ShoppingCart`), Productos (`Package`), Cuentas (`Building2`), Más (`Menu` o `Grid2x2`).
   - "Más" abre un Drawer inferior con grid 3×N de los módulos restantes + Cerrar sesión. El módulo activo también se resalta dentro del Drawer.
   - Safe area: `pb-[env(safe-area-inset-bottom)]`.
2. **Layout** `(dashboard)/layout.tsx`: `AdminSidebar` pasa a `hidden md:flex`; el `<main>` recibe `pb-20 md:pb-0` (altura de la bottom nav + margen). Montar `AdminBottomNav`.
3. **Header mobile de página**: los títulos `h1` y botones de acción primaria ("Nuevo producto", etc.) hoy conviven en un `flex justify-between` que rompe en 390px. Ajustar a apilado (`flex-col gap-3 md:flex-row md:items-center md:justify-between`) y botones de acción full-width en mobile cuando aplique.
4. **`ResponsiveDialog`** (`src/components/admin/ResponsiveDialog.tsx`): wrapper que usa `useIsMobile()` para renderizar `Dialog` (desktop) o `Drawer` (mobile) con la misma API (`open`, `onOpenChange`, `title`, `description`, `children`, `footer`). Contenido con `max-h-[85dvh]` y scroll interno en mobile.
5. Sustituir `p-8` por `p-4 md:p-8` en todas las páginas admin (respetar `max-w-*` existentes).

## Fase 2 — Listados como tarjetas apiladas (11 módulos)

1. Crear el patrón una sola vez y reutilizarlo: componente **`AdminListCard`** (o patrón documentado equivalente) con slots: título, subtítulo, badges, metadatos, thumbnail opcional, acciones. Tarjeta completa tocable cuando la fila navega a detalle; acciones secundarias en `DropdownMenu` (⋮) con targets de 44px.
2. En cada página de listado: la `<Table>` actual queda envuelta en `hidden md:block`; la lista de tarjetas en `md:hidden`. **Misma fuente de datos, mismos handlers** — cero duplicación de lógica de fetch/estado.
3. Orden de implementación por prioridad operativa: cotizaciones → prospectos → productos → cuentas-corporativas → sets → reglas → grupos-de-sets → marcas → colores → sucursales → banners.
4. Filtros y buscadores sobre las tablas: apilar a 1 columna en mobile; si un módulo tiene más de 2 filtros, agruparlos en un Drawer "Filtros" con contador de filtros activos.
5. Paginación: controles con targets táctiles adecuados, centrados, sin desbordar.
6. Estados vacíos: mensaje + acción primaria visibles en mobile (no depender de columnas de tabla).

## Fase 3 — Wizard mobile en los 4 formularios grandes

Aplicar a `ProductForm`, `SetForm`, `RuleForm`, `QuoteEditor`:

1. **Mismo componente, presentación condicionada por `useIsMobile()`.** Extraer las secciones actuales a subcomponentes internos si hace falta para poder renderizarlas tanto en la vista desktop actual (sin cambios visuales) como como pasos del wizard mobile.
2. Wizard mobile: indicador de progreso (pasos con nombre, ej. "2/5 · Variantes"), navegación Atrás/Siguiente en barra sticky inferior, validación del paso al avanzar (errores visibles en el paso, no silenciosos), posibilidad de saltar a un paso ya visitado.
3. Partición de pasos: usar la propuesta validada en Fase 0. Orientación inicial (ajustar según hallazgos):
   - `ProductForm`: Datos básicos → Precios y canal → Tallas y colores → Variantes/inventario → Imágenes → Revisión.
   - `SetForm`: Datos del set → Piezas y combinaciones → Precio (auto/override) → Reglas → Revisión.
   - `RuleForm`: Tipo y alcance → Parámetros del tipo → Condiciones → Revisión (el `RuleDocPanel` contextual se muestra colapsable dentro del paso; `RuleConflictsPanel` visible en Revisión y como aviso al avanzar si hay conflictos).
   - `QuoteEditor`: Cliente → Líneas → Impuestos y validez → Revisión/acciones. `QuoteLineEditor` en mobile abre como Drawer a pantalla casi completa.
4. Grids internos: todo `grid-cols-2/3` fijo pasa a `grid-cols-1 md:grid-cols-{n}`.
5. Inputs numéricos y de precio: `inputMode` adecuado (`decimal`/`numeric`) para teclado correcto en mobile.

## Fase 4 — Módulos y componentes especiales

1. **Biblioteca (`/admin/biblioteca`)**: grid de medios `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6`; `MediaDetailDialog` vía `ResponsiveDialog`; `MediaPicker` como Drawer a pantalla casi completa en mobile (selección y búsqueda usables con el pulgar); subida de archivos funcional desde mobile (input file estándar dispara cámara/galería).
2. **Dashboard home (`/admin`)**: tarjetas de métricas a `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (o el equivalente según lo existente).
3. **Configuración**: apilado a 1 columna; paneles de presets (`TaxPresetsPanel`, `ValidityPresetsPanel`) con sus tablas internas convertidas al mismo patrón tarjeta/lista en mobile.
4. **Páginas de detalle** (`cotizaciones/[id]`, `prospectos/[id]`, `cuentas-corporativas/[id]`, `productos/[id]`, `sets/[id]`, `reglas/[id]`): columnas laterales pasan debajo del contenido principal (`flex-col lg:flex-row` o `grid-cols-1 lg:grid-cols-3`); botones de acción del encabezado apilados o en menú ⋮ en mobile.
5. **`QuoteAttachmentUpload`** y cualquier zona drag-and-drop: asegurar alternativa por tap en mobile.

## Fase 5 — Validación y cierre

1. `npm run build` (o el script del repo), `lint`, `typecheck`, `vitest` — todos en verde.
2. Verificación estática de regresiones desktop: ninguna clase base cambiada sin su contraparte `md:` que restaure el comportamiento anterior en escritorio.
3. Criterios de aceptación (auto-verificar contra el código):
   - Ninguna página admin produce scroll horizontal a 390px.
   - Toda acción disponible en desktop tiene equivalente accesible en mobile (principio "sin opciones muertas").
   - Bottom nav visible y funcional en todas las rutas `< md`, oculta `≥ md`; sidebar intacto en desktop.
   - Los 4 formularios grandes operan por wizard en mobile y sin cambios en desktop.
   - `ResponsiveDialog` aplicado a todos los dialogs del admin inventariados en Fase 0.

---

## Reglas globales de ejecución (obligatorias)

- **Git**: prohibido `git commit`, `git push`, PRs y releases. Dejar solo el working tree modificado. Sugerir mensajes de commit (Conventional Commits) al final.
- **Base de datos**: este plan no debería requerir cambios de esquema. Si algo lo exigiera, detenerse y reportarlo — no improvisar migraciones para un cambio de UI.
- **Validación**: exclusivamente build + lint + typecheck + tests existentes. **Prohibido MCP Chrome DevTools.**
- **Entregables**: no crear archivos Markdown de resumen (SUMMARY.md, REPORT.md, etc.). Este archivo de plan es el único `.md` permitido, en `docs/superpowers/plans/`.
- **Idioma**: todo copy UI en español (Ecuador). Identificadores de código en inglés. Rutas API intactas.
- **Arquitectura**: no tocar `src/lib/rules-engine/` (permanece puro, sin dependencias de DB). No duplicar componentes: un formulario = un componente con dos presentaciones.

## Respuesta final obligatoria (en el chat, no en archivos)

1. **Resumen Ejecutivo**: objetivo realizado, componentes modificados, archivos relevantes, cambios de arquitectura, riesgos, observaciones.
2. **Verificación Manual en Producción**: checklist por módulo — navegación bottom nav, listados en tarjetas, wizard de cada formulario grande, dialogs como drawers, biblioteca, detalles, permisos, casos límite (tablas con muchos badges, formularios con errores de validación por paso, safe area en iPhone).
3. **Migraciones Ejecutadas**: "No aplica" (o reporte si surgió algo).
4. **Builds y Validaciones**: comandos y resultado (Build/Lint/Typecheck/Tests ✅/❌).
5. **Commits Sugeridos**, por ejemplo:

```bash
git commit -m "refact: agregar navegacion inferior tipo app y shell responsive al panel admin para uso en smartphones"

```

Ajustar los mensajes a lo realmente implementado en cada bloque de trabajo.

# Task 1 — Fase 1: Infraestructura mobile del shell admin — Reporte

## Resumen

Implementados los 5 requisitos del brief: `AdminBottomNav`, ajuste de `(dashboard)/layout.tsx`,
verificación del header genérico (no existe, se deja para fases posteriores), `ResponsiveDialog`,
y reemplazo de `p-8` → `p-4 md:p-8` en las 19 páginas admin que lo usaban.

## Archivos creados

- `src/components/admin/AdminBottomNav.tsx` — bottom nav fija `md:hidden`, 4 ítems primarios
  (Cotizaciones, Pedidos, Productos, Cuentas) + botón "Más" que abre un `Drawer` (vaul) inferior
  con grid 3 columnas de los 10 módulos restantes + "Cerrar sesión". Reutiliza `signOut` de
  next-auth igual que `AdminSidebar`. Exporta `isNavItemActive(pathname, href)` (misma lógica de
  coincidencia que `AdminSidebar`: exacta o por segmento con `startsWith(href + '/')`) para poder
  testearla de forma aislada. Fondo `#111111`, safe area `pb-[env(safe-area-inset-bottom)]`,
  targets táctiles `min-h-[44px]`, `focus-visible:ring-2` en todos los controles.
- `src/components/admin/ResponsiveDialog.tsx` — wrapper con `useIsMobile()` que renderiza `Dialog`
  (desktop) o `Drawer` (mobile) con API común (`open`, `onOpenChange`, `title`, `description`,
  `children`, `footer`). `max-h-[85dvh]` con scroll interno (`overflow-y-auto`) en el body. No se
  cableó a ningún dialog existente (según instrucción explícita del brief, queda para fases
  posteriores).
- `src/components/admin/__tests__/AdminBottomNav.test.ts` — 5 tests unitarios sobre
  `isNavItemActive` (coincidencia exacta, subrutas, no-colisión de prefijos textuales tipo
  `/admin/cotizaciones-legacy`, rutas no relacionadas, caso especial del dashboard raíz `/admin`).

## Archivos modificados

- `src/app/admin/(dashboard)/layout.tsx` — `AdminSidebar` ahora recibe `className="hidden md:flex"`;
  `<main>` gana `pb-20 md:pb-0`; se monta `<AdminBottomNav />` como hermano de `<main>`.
- `src/components/admin/AdminSidebar.tsx` — acepta prop opcional `className` (vía `cn`), agregada
  para que el layout controle la visibilidad `hidden md:flex` sin tocar el resto del componente.
  Comportamiento visual en `≥ md` sin cambios (mismo `w-64 bg-[#111111] ... flex-col`).
- `src/index.css` — agregada regla global `@media (prefers-reduced-motion: reduce)` que reduce
  duración de animaciones/transiciones a ~0, cubriendo las transiciones del `Drawer` de "Más" (y
  cualquier otra animación de la app) sin tocar componentes individuales.
- 19 `page.tsx` bajo `src/app/admin/(dashboard)/`: `p-8` → `p-4 md:p-8`, respetando los `max-w-*`
  existentes donde los había (`configuracion`, `cotizaciones/nueva`, `cuentas-corporativas/[id]`,
  `prospectos/[id]`, `reglas/nueva`, `reglas/[id]`).

## No tocado (fuera de alcance de este task, según el brief)

- No existe un header compartido genérico en el layout ni en un componente común: cada página
  maneja su propio header inline. Se deja intacto para fases 2-4.
- `ResponsiveDialog` no se conectó a ningún dialog existente.
- `src/lib/rules-engine/` sin cambios.

## Verificación

- `npx tsc --noEmit` → sin salida, limpio.
- `npm run lint` → 83 problemas (80 errores, 3 warnings) preexistentes, **idénticos** antes y
  después de mis cambios (verificado con `git stash` / `git stash pop` y comparación de conteo).
  Ninguno de los errores reportados pertenece a archivos tocados en este task (verificado con grep
  sobre la salida de lint filtrando por los nombres de archivo modificados/creados).
- `npm test` → 13 archivos de test, **176 tests pasando** (incluye los 5 nuevos de
  `AdminBottomNav.test.ts`).

## Autorevisión frente a los requisitos numerados

1. `AdminBottomNav`: visible `< md`, fixed bottom, fondo `#111111`, iconos lucide + label corto,
   activo por `usePathname` con mismo criterio que el sidebar — OK. 5 ítems (4 + Más) — OK. Drawer
   "Más" con grid 3×N de los 10 módulos restantes + Cerrar sesión, módulo activo resaltado — OK.
   Safe area — OK. Rutas verificadas contra `src/app/admin/(dashboard)/` — todas coinciden con las
   del brief. Cierre de sesión reutiliza el mismo mecanismo (`signOut({ redirect: false })` +
   redirect manual a `/admin/login`) — OK.
2. Layout: sidebar `hidden md:flex`, `<main>` con `pb-20 md:pb-0`, `AdminBottomNav` montado — OK.
3. Header mobile de página: no existe componente compartido genérico; no se tocó nada — OK
   (conforme a instrucción condicional del brief).
4. `ResponsiveDialog`: creado con la API pedida, `max-h-[85dvh]` + scroll interno en mobile, no
   cableado a páginas existentes — OK.
5. `p-8` → `p-4 md:p-8` en las 19 `page.tsx` del árbol admin, `max-w-*` respetados, nada fuera del
   árbol admin tocado (verificado que el reemplazo fue solo sobre `className="p-8` dentro de
   `src/app/admin/(dashboard)/**/page.tsx`) — OK.

Restricciones globales: breakpoint `md` vía `useIsMobile()` (matchMedia por resize/innerWidth, sin
user-agent) — OK. Touch targets `min-h-[44px]` en bottom nav y grid del Drawer — OK. Safe area iOS
— OK. Focus visible (`focus-visible:ring-2`) en todos los controles nuevos — OK.
`prefers-reduced-motion` respetado globalmente vía `src/index.css` — OK. Copy en español (Ecuador)
— OK. `src/lib/rules-engine/` no tocado — OK. Sidebar desktop intacto — OK. Sin cambios de esquema
de BD — OK.

## Concerns

- No hay convención previa de tests de componentes React con render (no hay `@testing-library/react`
  ni entorno `jsdom` configurado en `vitest.config.ts`; el entorno es `node` y todos los tests
  existentes son de lógica pura). Siguiendo la instrucción de "no inventar" una convención nueva,
  testeé únicamente la lógica pura extraída (`isNavItemActive`) en vez de agregar dependencias de
  testing de componentes. `ResponsiveDialog` y el renderizado JSX de `AdminBottomNav` no tienen
  test automatizado de render; quedaron verificados solo por `tsc`/lint y revisión manual del
  código. Si se desea cobertura de render en fases posteriores, habría que añadir
  `@testing-library/react` + `jsdom` como convención nueva del proyecto.
- `AdminSidebar` ahora acepta `className` opcional; es un cambio de firma pública mínimo pero es el
  único consumidor (el layout), así que no hay riesgo de romper otros usos.

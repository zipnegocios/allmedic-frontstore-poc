# Plan — Ajustes visuales del sitio público: ratio de imagen, badges de estado y sistema tipográfico

> Guardar este plan en `docs/superpowers/plans/2026-07-20-ajustes-visuales-imagen-badges-tipografia.md`.
> Ejecutar las fases en orden. La Fase 0 es obligatoria antes de tocar código.
> Si algún hallazgo de la Fase 0 contradice las suposiciones de este plan, **detenerse y reportar** antes de continuar.

## Contexto

Tres ajustes visuales sobre el sitio público de Allmedic Frontstore:

1. **Ratio de imagen de producto.** Las imágenes de producto tienen dimensiones nativas 650×1000. Los contenedores actuales usan `aspect-[4/5]` (duplicado literal en `ProductCard.tsx:86` e `ImageGallery.tsx:54`) y `aspect-[4/3]` (`SetDetailContent.tsx:139`), con `object-cover`, lo que recorta la imagen. Se migra a un ratio 1:1.54 (650/1000) con la imagen 100% visible.
2. **Badge "Disponible".** `getAvailabilityStatus()` en `ProductCard.tsx` renderiza badge para los tres estados. El estado `AVAILABLE` es el default implícito del catálogo — mostrarlo en cada card es ruido visual. Se elimina solo ese badge; los de excepción se conservan.
3. **Sistema tipográfico.** El proyecto no define `fontFamily` en `tailwind.config.js` (corre con la fuente por defecto del navegador). Se implementa el sistema tipográfico documentado en la auditoría de cherokeeuniforms.com, **limitado estrictamente a tipografía** (familias, escala, pesos, line-height, letter-spacing). Los colores actuales de AllMedic no se tocan.

## Decisiones cerradas (no reabrir)

1. **Fuente display: Anton** (Google Fonts, gratuita), en sustitución de GT Walsheim (comercial, sin licencia). Anton es una fuente de un solo peso (400); el impacto visual proviene de la propia cara + `uppercase` + `line-height: 1`, no de un peso 800. No intentar sintetizar pesos.
2. **Fuente primaria (body/UI): Inter** (pesos 400, 500, 600). **Fuente secundaria: Nunito Sans** (solo si la Fase 0 identifica elementos tipo "H3 decorativo" donde aplicarla; si no hay consumidores, no cargarla — no introducir peso muerto).
3. **Carga de fuentes vía `next/font/google`** en el root layout, expuestas como variables CSS (`--font-display`, `--font-sans`, `--font-secondary`) y mapeadas en `tailwind.config.js` (`fontFamily.display`, `fontFamily.sans`, `fontFamily.secondary`). Autoalojadas por Next.js — cero requests de runtime a Google.
4. **Alcance de la refactorización: solo tipografía.** No se adoptan los colores de Cherokee (CTA azul `#000193`, rojo de oferta `#b21c02`, etc.). La paleta de AllMedic queda intacta.
5. **Ratio 1:1.54 en los tres contextos:** `ProductCard` (catálogo), `ImageGallery` (PDP) y `SetDetailContent` (corporativo). Se crea un **token único compartido** en Tailwind (`aspectRatio: { product: '650 / 1000' }` → clase `aspect-product`) y se eliminan los tres literales. Prohibido dejar el ratio hardcodeado en ningún componente.
6. **Fit de imagen: `object-contain`** — la imagen debe verse 100% visible, sin recorte, en los tres contextos.
7. **El hover `scale-105` de las cards se conserva** tal cual. El recorte momentáneo de bordes durante el hover es aceptable y aceptado.
8. **Badges de estado:** eliminar únicamente el badge `AVAILABLE` ("Disponible", verde). Conservar `BACKORDER` ("Bajo pedido", ámbar) y `OUT_OF_STOCK` ("Agotado", rojo) con su comportamiento actual. La lógica de `getAvailabilityStatus()` se mantiene — solo cambia el renderizado condicional.

## Decisiones menores resueltas de forma autónoma (flag para revisión)

- **Fondo del contenedor de imagen:** se conserva el `bg-[#F5F5F7]` actual. Con `object-contain`, cualquier imagen que no sea exactamente 650×1000 mostrará franjas de ese color — es el comportamiento deseado (fondo neutro intencional), no un bug.
- **Videos en cards:** `MediaGridThumb` puede renderizar video. Los videos no tienen ratio 650×1000; aplicarles `object-contain` produciría franjas grandes. **Los videos conservan `object-cover`**; `object-contain` aplica solo a imágenes. Implementar la distinción en el punto donde se resuelve el tipo de media (prop o lógica interna de `MediaGridThumb`), sin duplicar el componente.
- **Alcance de aplicación tipográfica: solo el sitio público** (grupo de rutas `(store)` y páginas corporativas públicas). El panel `/admin` no se toca — sus estilos actuales quedan intactos. Los tokens se definen globalmente en Tailwind, pero solo se aplican en componentes del sitio público.
- **`MediaGridThumb` no impone aspect-ratio propio** (usa `<Image fill>`; el ratio lo controla el contenedor) — confirmar en Fase 0 y no modificarlo salvo lo estrictamente necesario para el fit de imagen vs. video.
- **Placeholder de producto** (`/images/placeholder-product.jpg`): si su ratio no es 650×1000 se verá con franjas — aceptable, no regenerarlo en esta tarea.

## Escala tipográfica objetivo (adaptada de la auditoría)

Tokens a definir en `tailwind.config.js` (extend):

```js
fontFamily: {
  display: ['var(--font-display)', 'sans-serif'],          // Anton
  sans: ['var(--font-sans)', 'Helvetica Neue', 'arial', 'sans-serif'], // Inter
  secondary: ['var(--font-secondary)', 'var(--font-sans)', 'sans-serif'], // Nunito Sans (condicional)
},
fontSize: {
  'body-xs': ['0.625rem', { lineHeight: '1.6' }],  // 10px — badges
  'body-sm': ['0.75rem',  { lineHeight: '1.6' }],  // 12px — captions, SKU, legal
  'body-md': ['0.875rem', { lineHeight: '1.6' }],  // 14px — body base, cards, precios
  'body-lg': ['1rem',     { lineHeight: '1.6' }],  // 16px — navegación
  'h1-pdp':  ['1.25rem',  { lineHeight: '1.4', fontWeight: '500' }], // 20px — título PDP
  'h2':      ['1.5rem',   { lineHeight: '1' }],    // 24px — H2 sección desktop
  'h2-mobile': ['1.125rem', { lineHeight: '1' }],  // 18px — H2 sección móvil
  'h1-col':  ['2.5rem',   { lineHeight: '1' }],    // 40px — H1 colección/catálogo
  'h1-hero': ['5rem',     { lineHeight: '1' }],    // 80px — H1 hero desktop
},
letterSpacing: { badge: '0.04em' },
aspectRatio: { product: '650 / 1000' },
```

Reglas de aplicación:

| Elemento | Familia | Clases objetivo |
|---|---|---|
| H1 hero (home) | display | `font-display uppercase text-h2-mobile md:text-h1-hero` (escalar por breakpoint según diseño actual del hero; la Fase 0 define los pasos intermedios) |
| H1 catálogo / colección | display | `font-display uppercase` + escala móvil→desktop hasta `text-h1-col` |
| H2 de sección | display | `font-display uppercase text-h2-mobile md:text-h2` |
| Título producto (PDP) | sans | `font-sans font-medium text-h1-pdp` |
| Body / bullets / descripciones | sans | `font-sans text-body-md font-normal` |
| Navegación principal | sans | `font-sans text-body-lg font-normal` |
| Título de card de producto | sans | `text-body-md font-normal` |
| Precios | sans | `text-body-md` (peso 500 en precio destacado, `line-through` existente intacto) |
| Badges | sans | `text-body-xs font-medium uppercase tracking-badge` |
| Captions / SKU / vendor | sans | `text-body-sm` |

El escalado responsive es **por breakpoints discretos** (utilidades `md:` de Tailwind), no fluido — no usar `clamp()`.

## Fase 0 — Auditoría obligatoria (sin cambios de código)

Producir una matriz de impacto verificada antes de modificar nada:

1. **Inventario de aspect-ratio:** localizar todas las ocurrencias de `aspect-[4/5]`, `aspect-[4/3]` y cualquier otro `aspect-*` en componentes del sitio público (`grep` sobre `src/components/`, `src/legacy-pages/`, `src/app/(store)`). Confirmar los tres puntos conocidos (`ProductCard.tsx:86`, `ImageGallery.tsx:54`, `SetDetailContent.tsx:139`) y detectar cualquier cuarto consumidor no documentado (miniaturas de galería, quick-view, carruseles de home, cards corporativas del armador).
2. **Inventario de `object-cover`** en los componentes afectados y en `MediaGridThumb`: identificar dónde se decide el fit y si distingue imagen/video.
3. **Inventario de badges de estado:** confirmar que `getAvailabilityStatus()` vive solo en `ProductCard.tsx` o si existe lógica equivalente en cards corporativas, quick-view, PDP o `LayoutSwitcher`/`ProductListItem` (vista de lista del catálogo).
4. **Inventario tipográfico:** mapear los componentes del sitio público que definen tamaños/pesos hardcodeados (`text-*`, `font-*`, valores arbitrarios `text-[..px]`) en Header, Footer, MegaMenu, Home/hero, CatalogoContent, ProductCard, ProductListItem, PDP (`Product.tsx`, `PriceDisplay`, `VariantSelector`), páginas corporativas públicas. Identificar si existen elementos que califiquen como "H3 decorativo" (candidatos a Nunito Sans).
5. **Verificar el root layout** (`src/app/layout.tsx`) y el layout de `(store)`: dónde inyectar las variables de `next/font` para que apliquen al sitio público sin alterar el admin (evaluar si la variable se declara en `<html>`/`<body>` global y la *aplicación* de `font-sans` se hace en el layout de `(store)`).
6. Si algún hallazgo contradice este plan (p. ej. `getAvailabilityStatus()` duplicado, `MediaGridThumb` con fit propio hardcodeado, ratio consumido en el admin), **detenerse y reportar** con el hallazgo exacto y la alternativa propuesta.

## Fase 1 — Tokens y carga de fuentes

1. Configurar `next/font/google`: Anton (weight 400, subset latin) e Inter (400/500/600, subset latin). Nunito Sans solo si la Fase 0 encontró consumidores.
2. Exponer variables CSS y mapearlas en `tailwind.config.js` junto con `fontSize`, `letterSpacing.badge` y `aspectRatio.product` según la tabla de arriba.
3. Aplicar `font-sans` como base del sitio público (según el punto 5 de la Fase 0), sin afectar `/admin`.

## Fase 2 — Ratio de imagen y fit

1. Sustituir `aspect-[4/5]` en `ProductCard` e `ImageGallery`, y `aspect-[4/3]` en `SetDetailContent`, por `aspect-product`. Eliminar los literales; ninguna otra fuente del ratio puede quedar en el código.
2. Cambiar `object-cover` → `object-contain` para **imágenes** en los tres contextos, preservando `object-cover` para video (ver decisión autónoma). Conservar `bg-[#F5F5F7]`, `overflow-hidden`, el spinner de carga y el hover `scale-105` exactamente como están.
3. Revisar el atributo `sizes` de `next/image` en los contenedores modificados por si el cambio de ratio altera el ancho renderizado esperado (ajustar solo si es necesario).

## Fase 3 — Badge "Disponible"

1. En `ProductCard.tsx` (y cualquier duplicado hallado en Fase 0): renderizar el badge de estado **solo cuando** `availability.status !== 'AVAILABLE'`. No eliminar `getAvailabilityStatus()` ni los estilos de `BACKORDER`/`OUT_OF_STOCK`.
2. Verificar que el contenedor absoluto del badge (top-right) no deje espaciado fantasma cuando no se renderiza.

## Fase 4 — Aplicación tipográfica

Aplicar las clases de la tabla de reglas en los componentes mapeados en Fase 0, componente por componente: Header/nav, hero y secciones de Home, H1 y filtros del catálogo, `ProductCard`/`ProductListItem`, PDP completo, Footer, páginas corporativas públicas. Restricciones:

- No duplicar componentes mobile/desktop — un solo componente con clases responsive.
- No modificar colores, espaciados ni layout más allá de lo que exija el cambio tipográfico.
- No tocar el motor de reglas ni ningún módulo fuera del alcance visual.
- Headings display siempre `uppercase` con `line-height: 1`; body con `line-height: 1.6`.

## Fase 5 — Validación

- `npm run build`
- `npm run lint`
- Typecheck (`tsc --noEmit` o el script del proyecto)
- `npm run test` (Vitest)

No usar MCP Chrome DevTools. No hay cambios de base de datos en esta tarea: **no crear migraciones ni seeds**.

## Entregable final

No crear archivos Markdown de resumen. Responder únicamente en el chat con el formato obligatorio: **Resumen Ejecutivo · Verificación Manual en Producción · Migraciones Ejecutadas (indicar "N/A — sin cambios de BD") · Builds y Validaciones · Commits Sugeridos** (Conventional Commits, sin ejecutarlos, sin `git push`).

Checklist mínimo que debe cubrir la Verificación Manual en Producción:

- Cards del catálogo: imagen completa visible, sin recorte, ratio vertical 1:1.54, franjas `#F5F5F7` solo en imágenes no conformes.
- PDP: galería con imagen completa; zoom/interacciones existentes funcionan.
- Corporativo: detalle de set con el nuevo ratio, paridad visual con retail.
- Ningún badge "Disponible" en catálogo; un producto en `BACKORDER` muestra "Bajo pedido" y uno en `OUT_OF_STOCK` muestra "Agotado".
- Video en card: se reproduce y llena el contenedor (`object-cover`).
- Headings en Anton mayúsculas (hero, H1 catálogo, H2 secciones); body/nav/precios en Inter; badges con tracking 4%.
- Admin (`/admin`): sin cambios visuales de ningún tipo.
- Móvil (~390px) y desktop (~1280px): escala tipográfica correcta por breakpoint.

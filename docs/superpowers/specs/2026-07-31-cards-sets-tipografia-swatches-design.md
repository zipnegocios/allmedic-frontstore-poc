# Diseño — Tipografía y color swatches en cards de sets corporativos

## Contexto

El plan `docs/superpowers/plans/2026-07-20-ajustes-visuales-imagen-badges-tipografia.md` implementó el sistema tipográfico (tokens `fontFamily`, `fontSize`, `letterSpacing.badge` en `tailwind.config.js`) y lo aplicó en `ProductCard.tsx` (catálogo retail). Ese plan no incluyó las cards de listado de **sets corporativos** en su alcance — quedaron con clases de texto ad-hoc (`text-xs`, `text-sm`, `font-semibold`, etc.) en vez de los tokens `body-*`.

Además, las cards de sets no muestran hoy los colores disponibles del set, aunque el dato (`CorporateSetSummary.colors: ProductColor[]`, con `hex`/`kind`/`swatchUrl` completos) ya viaja desde `getActiveCorporateSets()` (`src/lib/corporate-data-service.ts`) hasta ambos componentes de card.

Este cambio cierra ambas brechas: propaga la tipografía ya establecida y agrega swatches de color interactivos, reutilizando el componente `ColorSwatch` que ya existe y ya se usa en `SetFilterSidebar` y (variante inline) en `ProductCard`.

## Decisiones cerradas

1. **Alcance de tipografía:** solo texto plano (`font-sans`), sin headings display — se aplican los mismos tokens que ya usa `ProductCard.tsx`: `text-body-xs/sm/md`, `tracking-badge`, `font-normal`/`font-medium` según jerarquía. Ver tabla de mapeo abajo.
2. **Agregación de colores:** se usa `set.colors` tal cual lo entrega `getActiveCorporateSets()` hoy. **No se corrige** la discrepancia conocida donde, en modo `MIXED`, la query pública no filtra por combos activos (a diferencia de `computeSetColorIntersection` del admin). Queda documentada como deuda a resolver en otra iteración.
3. **Truncamiento de swatches:** máximo 5 swatches visibles + contador `+N`, igual que `ProductCard.tsx:248-270`. Solo se muestran si `set.colors.length > 1`.
4. **Interactividad:** los swatches son clicables. Al click, actualizan un `activeColorId` en estado local del componente de card (`SetGridCard`/`SetListItem`, ya son client components) y se lo pasan a `resolveCardCover(set, activeColorId)` — mismo mecanismo que ya usa el filtro lateral (`SetFilterSidebar`) para cambiar la portada mostrada. `preventDefault`/`stopPropagation` en el click para no disparar la navegación del `<Link>` envolvente (mismo patrón que `ProductCard.tsx:251-254`).
5. **Componente reutilizado:** `ColorSwatch` (`src/components/catalog/ColorSwatch.tsx`), tamaño `sm`, llamado directamente (no `ColorSwatchGroup`, que fuerza `onColorSelect` con firma distinta a la que necesitamos aquí — se replica el patrón de iteración manual que ya usa `ProductCard.tsx:246-273`, pero llamando al componente real `ColorSwatch` en vez de reimplementar el botón inline).
6. **Sin cambios de datos:** no se toca el schema Drizzle, ni `getActiveCorporateSets()`, ni `corporate-types.ts`. `set.colors` ya trae todo lo necesario.

## Mapeo tipográfico

Aplicado igual en `SetGridCard` (inline, `CorporativoContent.tsx`) y `SetListItem.tsx`:

| Elemento | Clase actual | Clase nueva |
|---|---|---|
| Marca (`brandName`) | `text-xs text-gray-400 uppercase tracking-wide` (grid) / `text-xs uppercase tracking-wider text-gray-400` (list) | `font-sans text-body-sm uppercase tracking-badge text-gray-400` |
| Nombre del set | `font-semibold text-[#111111]` (grid) / `text-base sm:text-lg font-semibold text-[#111111]` (list) | `font-sans text-body-md font-normal text-[#111111]` |
| Piezas (`pieceCount`) | `text-sm text-gray-500` | `font-sans text-body-sm text-gray-500` |
| Precio referencial | `text-lg font-bold text-[#111111]` | `font-sans text-body-md font-medium text-[#111111]` |
| "/ set referencial" | `text-xs text-gray-400` | `font-sans text-body-xs text-gray-400` |
| Precio parcial (aviso) | `text-xs text-amber-600` | `font-sans text-body-xs text-amber-600` |
| "Precio bajo cotización" | `text-sm text-gray-400` | `font-sans text-body-sm text-gray-400` |

`SetListItem` conserva el botón "Ver set" (`text-sm font-medium`) sin cambios — es un CTA con fondo sólido, no parte de la jerarquía de lectura de texto plano que este cambio normaliza.

## Swatches — comportamiento

- Se insertan debajo del precio (o "Precio bajo cotización"), antes de cerrar el bloque de info.
- Estado local por card: `const [activeColorId, setActiveColorId] = useState<string | null>(null)`.
- `resolveCardCover(set, activeColorId)` ya soporta `activeColorId: string | null` (usado hoy vía prop del padre en `CorporativoContent`/`SetListItem`) — se reutiliza igual, pasando el estado local en vez de la prop del filtro global cuando el usuario interactuó con un swatch dentro de la card.
- Render:
  ```tsx
  {set.colors.length > 1 && (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {set.colors.slice(0, 5).map(color => (
        <div
          key={color.id}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveColorId(color.id); }}
        >
          <ColorSwatch color={color} size="sm" showTooltip isSelected={activeColorId === color.id} />
        </div>
      ))}
      {set.colors.length > 5 && (
        <span className="font-sans text-body-xs text-gray-400 flex items-center">
          +{set.colors.length - 5}
        </span>
      )}
    </div>
  )}
  ```
  (el wrapper `<div onClick>` es necesario porque `ColorSwatch` expone su propio `onClick` en el `<button>` interno sin `stopPropagation` — se decide en fase de implementación si conviene pasar el handler directo al prop `onClick` de `ColorSwatch` en su lugar, siempre que se preserve `preventDefault`/`stopPropagation`).
- Interacción con el `activeColorId` recibido por prop desde el filtro global (`CorporativoContent`): si el usuario cambia el filtro lateral, debe primar sobre la selección local de la card (mismo patrón de sincronización "durante el render" que ya usa `ProductCard.tsx:38-46` para `selectedFilterColor` vs. `selectedColorId`).

## Archivos a modificar

- `src/app/(store)/corporativo/CorporativoContent.tsx` — función `SetGridCard` (líneas ~29-122).
- `src/components/catalog/SetListItem.tsx` (completo).

No se modifica `ColorSwatch.tsx`, `corporate-data-service.ts`, `corporate-types.ts`, ni el schema.

## Fuera de alcance

- Corrección de la agregación de colores en modo `MIXED` (deuda documentada, no bloqueante).
- Cambios en `SetDetailContent.tsx` (PDP del set) — ya tiene su propio sistema de colores vía `colorMode`/`colorCombos`, fuera de este cambio.
- Cambios en `/admin`.

## Verificación

- `npm run build`, `npm run lint`, typecheck, `npm run test`.
- Manual: catálogo `/corporativo` en vista grid y lista — swatches visibles en sets con más de un color, click cambia portada, filtro lateral sigue funcionando y prima sobre selección local, tipografía visualmente consistente con `ProductCard`.
- Sets con un solo color: sin swatches (comportamiento actual preservado).
- Sets con más de 5 colores: contador `+N` correcto.

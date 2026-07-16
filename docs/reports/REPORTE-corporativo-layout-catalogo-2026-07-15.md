# Reporte — `/corporativo` adopta el layout de filtrado y grilla de `/catalogo`

Fecha: 2026-07-15.

## Resumen ejecutivo

El catálogo corporativo (`/corporativo`) pasa de dos filas de píldoras de selección única (Grupo, Marca) sobre un grid fijo de 3 columnas a la misma experiencia de exploración que el catálogo individual: sidebar de filtros por atributo (Grupo, Género, Categoría, Marca, Color, Talla, Corte — sin rango de precio), buscador interno, selector de orden (Relevancia / Precio ↑ / Precio ↓ / Más recientes), `LayoutSwitcher` (4/3/2 columnas + Lista), selector de ítems por página y paginación client-side.

La particularidad corporativa: los **sets** se filtran según los atributos de **las piezas que los componen**. Un set aparece si, para cada filtro activo, alguna pieza del set (no necesariamente la misma pieza en todos los filtros) satisface algún valor seleccionado — es decir, un set con la camisa en Navy y el pantalón en talla M aparece al filtrar Navy + M, sin exigir que exista una variante Navy/M en una misma pieza. Solo participan variantes activas (`status = 'AVAILABLE'`) — principio "sin opción muerta" ya usado en el resto del proyecto.

No se requirieron cambios de esquema de base de datos: los atributos (color, talla, género, categoría, corte) ya existían a nivel de producto/variante; el trabajo fue de consultas y agregación en la capa de datos existente.

## Hallazgo de Fase 0 (documentado, no reabrir)

El prompt original asumía que `useProductFilter` orquesta `/catalogo`. La auditoría confirmó que **no es así**: `CatalogoContent.tsx` implementa su propio filtrado/orden/búsqueda/paginación inline; `useProductFilter` solo se usa en componentes de la home (`FilterableProductSection`, `HierarchicalFilter`). `useSetFilter` se diseñó para espejar lo que `/catalogo` realmente hace, no la API del hook sin usar.

## Decisiones autónomas (flagueadas para revisión)

1. **Vista Lista → `SetListItem` nuevo, no reutilización de `ProductListItem`.** `ProductListItem` está acoplado al tipo `Product` (slug, brand, priceSale/priceNormal, variants) — no es agnóstico. Se creó `SetListItem` espejando su patrón visual (imagen + info + precio + CTA) para `CorporateSetSummary`.
2. **"Relevancia" y "Más recientes" replican el criterio del individual, salvo un ajuste necesario.** "Relevancia" = sin orden aplicado (orden de la consulta, ya `sortOrder asc`). "Más recientes" en `/catalogo` ordena por el flag `isNew`, no por fecha real — los sets no tienen ese concepto, así que "Más recientes" para sets ordena por `createdAt desc` real (dato que ya se agregó a la capa de datos en esta misma tarea).
3. **`SetFilterSidebar` no replica el patrón de estado local + `useEffect` de sincronización de `FilterSidebar.tsx`** — se conecta directamente al estado del hook vía props controladas, ya que la re-renderización es inmediata en ambos casos. Simplificación sin cambio de comportamiento observable.
4. **El buscador "Buscar en resultados..." vive en el área de controles de `CorporativoContent.tsx`**, igual que en `CatalogoContent.tsx` (no dentro del sidebar) — así es como el catálogo individual lo posiciona realmente, aunque el prompt original lo listaba como parte de los "filtros del sidebar".

## Archivos creados/modificados

| Archivo | Propósito |
|---|---|
| `src/lib/corporate-types.ts` | `CorporateSetSummary` gana `colors`, `sizes`, `genders`, `categories`, `fits`, `pieceNames`, `createdAt`. |
| `src/lib/corporate-data-service.ts` | `getActiveCorporateSets` agrega atributos de piezas activas por set (1 query extra de variantes, sin N+1); `getCorporateSetBySlug` calcula los mismos campos agregados desde sus piezas ya cargadas, para satisfacer el tipo sin tocar el comportamiento de la ficha de set. |
| `src/lib/data-service.ts` | `genderFromDb` pasa a exportarse (única fuente del mapeo DB→frontend de género, reutilizada por la capa corporativa). |
| `src/lib/set-filter-logic.ts` (nuevo) | Lógica pura de matching (AND entre grupos, OR dentro de grupo), orden y paginación — testeable sin React. |
| `src/lib/__tests__/set-filter-logic.test.ts` (nuevo) | 16 tests: matching cross-pieza, exclusión, OR intra-grupo, AND inter-grupo, búsqueda por nombre de pieza, orden por precio/fecha, conteo de filtros activos, paginación. |
| `src/hooks/useSetFilter.ts` (nuevo) | Hook cliente: filtros, opciones derivadas de los sets, paginación (default 20), orden, búsqueda. |
| `src/components/catalog/SetFilterSidebar.tsx` (nuevo) | Sidebar de filtros corporativo (Grupo/Género/Categoría/Marca/Color/Talla/Corte), reutiliza `ColorSwatch` sin modificarlo. |
| `src/components/catalog/SetListItem.tsx` (nuevo) | Vista Lista para sets. |
| `src/app/(store)/corporativo/CorporativoContent.tsx` | Reestructurado: adopta el control bar de `/catalogo`, elimina las píldoras de Grupo/Marca. |

**Sin cambios:** `LayoutSwitcher.tsx`, `ColorSwatch.tsx`, `FilterSidebar.tsx`, `CatalogoContent.tsx`, `useProductFilter.ts`, `SetDetailContent.tsx`, `src/lib/rules-engine/`, esquema de base de datos.

## Verificación Manual en Producción (checklist pendiente para el usuario)

- [ ] Filtrar por Color=Navy + Talla=M sobre un set donde Navy está en una pieza y M en otra — debe aparecer el set.
- [ ] Multi-selección de Grupo (2+ grupos marcados) — deben aparecer sets de cualquiera de los grupos seleccionados.
- [ ] Cambiar a vista Lista — verificar `SetListItem` (imagen, nombre, piezas, precio o "Precio bajo cotización", CTA).
- [ ] Cambiar entre 4/3/2 columnas — verificar que el grid respeta `aspect-[4/5]`.
- [ ] Paginación — cambiar ítems por página (5/10/20/50) y navegar entre páginas.
- [ ] Orden "Precio: menor a mayor" y "Precio: mayor a menor" — verificar que ordena por `referencePrice` aun si `PRICE_VISIBILITY` oculta el precio visualmente.
- [ ] Orden "Más recientes" — verificar que refleja `createdAt` real del set (el más nuevo primero).
- [ ] Con una regla `PRICE_VISIBILITY` que oculte precios (ámbito Marca/Grupo/Set/Producto) — verificar que se oculta tanto en cards de grid como en `SetListItem`.
- [ ] Responsive móvil — abrir/cerrar el drawer de filtros (`SetFilterButton` + overlay).
- [ ] Regresión visual de `/catalogo` — confirmar que no cambió nada (mismo `FilterSidebar`, mismo `CatalogoContent.tsx`, cero archivos tocados).

## Migraciones ejecutadas

Ninguna. No se modificó el esquema de base de datos.

## Builds y validaciones

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ Sin errores |
| `npx eslint .` | ✅ 86 errores / 3 warnings preexistentes, ninguno en archivos de esta tarea (verificado explícitamente) |
| `npx vitest run` | ✅ 30 archivos de test, 312 tests, todos en verde (incluye los 16 nuevos de `set-filter-logic.test.ts`, sin regresiones en el resto de la suite) |
| `npm run build` | ✅ Build de producción exitoso, incluye `/corporativo` y `/catalogo` |

## Commits realizados

```
feat(corporativo): agregar atributos de piezas activas por set en la capa de datos
feat(corporativo): logica pura de filtrado/orden/paginacion de sets con tests
feat(corporativo): hook useSetFilter para filtrado/orden/paginacion client-side
feat(corporativo): SetFilterSidebar con Grupo/Genero/Categoria/Marca/Color/Talla/Corte
feat(corporativo): SetListItem para la vista Lista del grid corporativo
feat(corporativo): adoptar layout de filtrado y grilla del catalogo individual
```

No se hizo push ni se abrió PR — pendiente de decisión del usuario.

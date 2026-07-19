# Plan — Carpetas por producto en R2, portada dual y evolución de la Media Library

> Destino: `docs/superpowers/plans/2026-07-19-media-carpetas-por-producto.md`
> Ejecutor: Claude Code. Este archivo es el único `.md` permitido como entregable de planificación.

## Contexto

Hoy los medios de productos se suben a `products/{slug}/` sin subcarpeta de color, el `MediaPicker` del formulario de productos muestra **toda** la carpeta PRODUCTS (todo el catálogo), la portada es un único slot `COVER` y la biblioteca (`/admin/biblioteca`) solo ofrece filtros planos (carpeta, tipo, búsqueda, sin usos). La fuente de verdad de los medios es la BD (`media_assets` + `media_links`); las rutas físicas en R2 son organizacionales.

## Objetivo

1. Organización física del bucket espejo del catálogo: `products/{codigo-estilo}/portada/` y `products/{codigo-estilo}/{CODIGO-COLOR}/`, con **renombrado físico en cascada** cuando cambien códigos.
2. Portada de producto como **dupla primaria + secundaria** (imagen o video), con switcher de origen: "subir especiales" vs "heredar del primer color" (referencia viva).
3. **Picker enfocado** por producto/set: entorno limpio que solo muestra la carpeta de la entidad actual, más botón "Insertar imagen desde otra ubicación" (biblioteca completa, reutilización sin duplicar).
4. Biblioteca con **panel lateral derecho** en árbol Marca → Colección → Producto → Color (organización lógica/virtual) y **gestión completa de vínculos** (filtrar, asignar, desvincular).

## Decisiones ya tomadas (no reabrir)

| Tema | Decisión |
|---|---|
| Cambio de código de estilo o de color | Renombrado físico en cascada: `copyObject + deleteObject` por objeto + actualización de `storage_key` en `media_assets`. Las claves son siempre espejo del código. |
| Portada en modo "desde variante" | **Referencia viva**: no se guardan vínculos COVER; se resuelve en lectura con las 2 primeras imágenes (`sortOrder`) del primer color del producto. |
| Obligatoriedad de la dupla | En modo "subir especiales": primaria **y** secundaria obligatorias (el validador bloquea). En modo "desde variante": el primer color debe tener ≥ 2 medios en galería. |
| Video en portadas | Permitido en ambas (primaria y secundaria). |
| Alcance del picker enfocado | Carpeta física del producto **+** medios vinculados que viven en otras rutas, con badge "Reutilizado". |
| Producto nuevo sin código | Sección de medios **bloqueada** con mensaje explicativo hasta declarar un código de estilo válido (validado en vivo contra `/api/admin/products/check-code`). |
| Sets | Misma lógica: `sets/{slug-del-set}/portada/`, picker enfocado y botón de inserción desde otra ubicación. |
| Migración de medios existentes | **Gradual**: al abrir y guardar un producto, se reorganiza su carpeta a la estructura nueva. Sin script masivo inicial. |
| Árbol de la biblioteca | 4 niveles: Marca → Colección → Producto → Color. Organización lógica derivada de la BD, no de rutas físicas. |
| Gestión desde biblioteca | Completa: filtrar + asignar (reciclar a uno o varios productos/sets) + desvincular. |

## Decisiones menores delegadas (resolver con criterio y marcar para revisión)

- **Badge de assets legacy**: los medios vinculados al producto que aún viven en la ruta antigua (pre-reorganización) se muestran en el picker enfocado con badge "Pendiente de reorganizar" (distinto de "Reutilizado"). Confirmar copy exacto.
- **Nombre del rol nuevo** para la portada secundaria: propuesto `COVER_SECONDARY` (la columna `role` es texto libre — sin migración de enum). Añadirlo a `MEDIA_LINK_ROLES`.
- **Nombre del flag de origen de portada** en `products`: propuesto `cover_source` con valores `CUSTOM | FIRST_VARIANT`, default `CUSTOM`.
- **Copy del tooltip/popover** del icono ⓘ del switcher (ver Fase 3.2) — redactarlo en español (Ecuador), claro y breve.
- **Segmento "portada"** del storage key: usar literal `portada` (ya slugificado). Los códigos de color se usan tal cual en mayúsculas normalizadas por `slugifySegment` — verificar en Fase 0 si `slugifySegment` (que fuerza minúsculas) es aceptable para los códigos (`blk`, `win`) o si se necesita variante que preserve mayúsculas; decidir por consistencia con claves existentes y documentarlo.

## Fase 0 — Auditoría obligatoria (sin cambios de código)

Producir una matriz de estado verificada antes de tocar nada:

1. **Claves actuales en R2/BD**: distribución real de `storage_key` de assets PRODUCTS y SETS (cuántos siguen `products/{slug}/{color}/`, cuántos `products/{slug}/`, cuántos otros patrones). Consulta directa a `media_assets`.
2. **Entidad Colección**: confirmar si existe como tabla/relación (aparece en `CatalogFilters` como `collection`). Si NO existe como entidad con FK desde productos, el árbol de la biblioteca degrada a 3 niveles (Marca → Producto → Color) y se reporta — **no inventar la entidad en este plan**.
3. **`slugifySegment` vs códigos**: comportamiento exacto con códigos como `CK3900`, `BLK` (minúsculas, guiones). Impacto en claves.
4. **Puntos de lectura de COVER**: inventario de todos los call-sites que resuelven portada (público y admin: `resolveCoverMedia`, `getProductCoversMap`, `getGroupEligibleProducts`, APIs de catálogo/búsqueda, cards, quick view, mega menu, cross-sell, sets). Cuidado con el antecedente de doble resolución de URL documentado en `docs/audits/AUDITORIA-miniaturas-piezas-sets.md`.
5. **Cambio de código de color**: qué productos comparten cada color (el renombrado en cascada de un color afecta a TODOS los productos que lo usan). Dimensionar el peor caso.
6. **`renameStorageKey`/`copyObject`**: contrato actual y usos existentes.
7. **MediaGallery/MediaPicker/API `/api/admin/media`**: parámetros soportados hoy (folder, mediaType, q, unused, paginación) y qué falta para filtrar por prefijo de clave y por vínculos de entidad.
8. **Wizard mobile** del formulario de productos: pasos actuales y dónde encaja el switcher de portada (paso fusionado `variants_and_media` según auditoría de fusión).

## Fase 1 — Infraestructura de claves y renombrado en cascada

1. **Builder de claves de producto**: helper puro `buildProductMediaKey(codigoEstilo, colorCode | 'portada', fileName)` sobre `buildStorageKey`, con tests Vitest (casos: portada, color, caracteres especiales, extensión).
2. **Servicio de reorganización** `reorganizeEntityMedia(entityType, entityId)`:
   - Calcula la clave destino esperada para cada asset **cuya clave actual esté bajo la carpeta de la entidad o esté vinculado con rol propio de la entidad y clave legacy** (los assets "Reutilizado" que viven en la carpeta de OTRO producto NO se mueven).
   - Por asset: `copyObject` → update `media_assets.storage_key` → `deleteObject`. Orden diseñado para que un fallo a mitad deje siempre un estado recuperable (la copia existe antes de tocar la BD; el delete es el último paso). Registrar en `media_audit`.
   - Idempotente: si la clave ya es la esperada, no-op.
3. **Cascada por cambio de código de estilo**: al guardar un producto cuyo `code` cambió, ejecutar la reorganización completa de su carpeta (equivale a rename de carpeta). Feedback de progreso en UI (los productos grandes pueden implicar decenas de objetos).
4. **Cascada por cambio de código de color**: al guardar un color cuyo `code` cambió, reorganizar la subcarpeta correspondiente en **todos** los productos afectados. Mostrar diálogo de confirmación previo indicando cuántos productos/archivos se moverán. Procesar por lotes.
5. **Migración gradual**: engancharse al guardado del producto — todo save exitoso invoca `reorganizeEntityMedia` (cubre tanto legacy → nuevo como renombrados).

Sin cambios de esquema en esta fase salvo lo indicado en Fase 2.

## Fase 2 — Base de datos y modelo de portada dual

1. **Migración Drizzle**: columna `cover_source` en `products` (`text`, default `'CUSTOM'`). Ejecutar migración. No se requieren seeds (los productos existentes quedan en `CUSTOM`, equivalente al comportamiento actual).
2. **Rol `COVER_SECONDARY`** en `MEDIA_LINK_ROLES` (constante, sin migración — `role` es texto libre). La secundaria usa el mismo patrón `replaceSingleLink`.
3. **Resolución central de portada** (extensión de `resolveCoverMedia` / data-services):
   - `cover_source = 'CUSTOM'` → links `COVER` (primaria) y `COVER_SECONDARY`.
   - `cover_source = 'FIRST_VARIANT'` → primer color del producto (orden actual de colores), medios `sortOrder` 0 y 1 de su galería. Referencia viva, calculada en lectura.
   - Un solo punto de verdad consumido por público y admin — prohibido resolver ad-hoc en componentes (antecedente del bug de doble resolución).
4. **Compatibilidad**: productos con `COVER` existente y sin secundaria → la secundaria se comporta como opcional-legacy en lectura (fallback: repetir primaria en el efecto hover) hasta que el producto se edite; al editar en modo CUSTOM, el validador exige la dupla completa.

## Fase 3 — Formulario de productos

1. **Bloqueo por código**: sin `code` válido (verificado en vivo), la sección de medios (portada + galerías) queda deshabilitada con mensaje: el código define la carpeta del producto en el bucket.
2. **Switcher de origen de portada** en la ficha general:
   - Toggle con dos estados: "Subir portadas especiales" / "Usar portadas del primer color".
   - Señalizador visual encendido/apagado + icono ⓘ con popover (hover en desktop, tap en mobile — reutilizar patrón `Popover` existente) explicando ambas condiciones y sus requisitos.
   - En modo `FIRST_VARIANT`: se ocultan los slots de portada, el validador NO exige subirlas y en su lugar exige ≥ 2 medios en la galería del primer color; mostrar preview en vivo de qué dupla se está heredando.
   - En modo `CUSTOM`: dos tarjetas de portada (Primaria \*, Secundaria \*), ambas obligatorias, imagen o video, con alt obligatorio.
3. **Picker enfocado**:
   - `MediaPicker` recibe el contexto de entidad (`entityType`, `entityId`, `codigoEstilo`, y para galerías el `colorCode` prefijado).
   - Tab "Elegir de la librería" lista: (a) assets con prefijo `products/{codigo}/` — para portada, sub-prefijo `portada/`; para galería de color, sub-prefijo `{color}/` — y (b) assets vinculados al producto con clave fuera de la carpeta, badge "Reutilizado" (o "Pendiente de reorganizar" si son legacy propios). Producto nuevo → carpeta vacía, entorno limpio.
   - Tab "Subir nueva": sube directo a la subcarpeta correcta según el slot que abrió el picker.
   - API `/api/admin/media`: nuevos parámetros de filtro (prefijo de `storage_key`; vínculos por entidad). Extender, no romper los existentes.
4. **Botón "Insertar imagen desde otra ubicación"**: dentro del picker enfocado, abre la biblioteca completa en modal grande (navegación total + búsqueda por criterios), en modo selección única de reutilización. Al confirmar: se crea el `media_link` correspondiente **sin copiar el objeto** (el asset permanece en su carpeta original) — evita duplicados de medios comunes.
5. **Validación y resumen de errores**: actualizar `schema.ts` (dupla obligatoria condicional a `cover_source`, regla de ≥ 2 medios en primer color para `FIRST_VARIANT`) y `validation-summary.ts` con etiquetas nuevas. Principio "sin opciones muertas": toda combinación inválida del switcher se bloquea con explicación, nunca se ignora en silencio.
6. **Wizard mobile**: el switcher y las tarjetas de portada viven en el paso correspondiente según la estructura vigente del wizard (verificada en Fase 0); validación por paso coherente con desktop. Un solo componente, presentación condicional — sin duplicar componentes por responsive.

## Fase 4 — Sets corporativos

1. `SetForm`: tarjeta de portada alineada al patrón de productos (objeto `cover` completo con alt), picker enfocado a `sets/{slug}/portada/` y botón "Insertar desde otra ubicación".
2. Reorganización gradual idéntica: guardar un set reorganiza su carpeta; cambio de slug renombra en cascada.
3. Sin dupla ni switcher en sets salvo indicación contraria (portada única como hoy, ahora obligatoria u opcional según el estado vigente — verificar en Fase 0 y no endurecer sin confirmación).

## Fase 5 — Evolución de la biblioteca (`/admin/biblioteca`)

1. **Panel lateral derecho** (desktop; en mobile, Drawer accesible desde un botón de filtros — patrón `ResponsiveDialog`/`drawer.tsx` existente):
   - Árbol anidado Marca → Colección → Producto → Color, construido desde la BD (marcas, colecciones si existen como entidad, productos, colores activos por producto). Virtual: seleccionar un nodo filtra la galería vía `media_links` (no por ruta física), de modo que los medios reutilizados aparecen bajo cada producto que los usa.
   - Si Fase 0 determina que Colección no existe como entidad: árbol de 3 niveles + nota en el reporte.
   - Búsqueda existente y filtros planos siguen funcionando en combinación con el árbol.
2. **Gestión completa de vínculos desde el detalle del medio** (`MediaDetailDialog`):
   - "Usos relacionados" pasa de solo-lectura a gestión: desvincular (con confirmación y aviso del efecto en el storefront) y **asignar/reciclar** a uno o varios productos o sets (selector de entidad + rol + color cuando aplique), respetando los constraints únicos de `media_links` y las reglas de validación de cada entidad (p. ej. no dejar un producto publicado sin portada resoluble — bloquear con explicación).
   - Registrar todo en `media_audit`.

## Fase 6 — Validación y cierre

1. Build, lint, typecheck, Vitest — todos en verde. Tests nuevos: builder de claves, servicio de reorganización (mock de R2), resolución de portada en ambos modos, validaciones condicionales del schema.
2. Verificación estática de que ningún call-site de portada quedó resolviendo ad-hoc ni duplicando `resolveMediaUrl`.
3. Desktop sin regresiones; comportamiento mobile solo aditivo.
4. Reporte de cambios en `docs/reports/` al cierre de la sesión.

## Riesgos

- **Cascada por código de color**: un color compartido por muchos productos multiplica las operaciones copy+delete. Mitigación: confirmación previa con conteo, procesamiento por lotes, idempotencia para reintentar.
- **Fallo a mitad de reorganización**: mitigado por el orden copy → update BD → delete y la idempotencia; un reintento converge.
- **Referencia viva de portada**: cambiar el orden de colores altera la portada pública sin aviso. Mitigación: preview en vivo en el formulario + nota en el popover ⓘ.
- **Caché de Cloudflare Image Transformations** tras renombrados: las URLs viejas dejan de existir; verificar que todos los consumidores leen la clave desde BD (deberían, por diseño) y que no hay claves cacheadas en estado de cliente persistido.

## Reglas globales de ejecución (obligatorias)

- **Git**: prohibido `git commit`, `git push`, PRs y releases. Solo working tree + mensajes sugeridos (Conventional Commits) al final.
- **BD**: migraciones y seeds exclusivamente vía Drizzle; ejecutar las migraciones creadas; nunca tocar la BD a mano.
- **Validación**: build + lint + typecheck + Vitest. **Prohibido MCP Chrome DevTools.**
- **Entregables**: sin archivos Markdown de resumen; resumen ejecutivo, checklist de verificación manual en producción, migraciones ejecutadas, resultados de validación y commits sugeridos — todo directo en el chat. Reporte de cambios en `docs/reports/`.
- **Idioma**: código, comentarios, UI y documentación en español (Ecuador). Documentación atemporal (sin "próximamente" ni referencias a fases o sesiones).
- **Arquitectura**: el motor de reglas no se toca; un componente por responsabilidad con presentación condicional responsive; desktop intacto.

## Commits sugeridos (orientativos, por fase)

```bash
git commit -m "feat: infraestructura de claves por codigo de estilo y renombrado fisico en cascada de medios en R2"
git commit -m "feat: portada dual primaria/secundaria con origen configurable (especiales o primer color) en productos"
git commit -m "feat: picker de medios enfocado por producto/set con insercion desde otra ubicacion sin duplicar assets"
git commit -m "feat: arbol lateral marca/coleccion/producto/color y gestion completa de vinculos en la biblioteca"
```

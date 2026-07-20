# PLAN — Ajustes del Administrador de Sets Corporativos: eliminación de Grupos, Portadas duales con paridad de producto, y correcciones del formulario

> Destino sugerido: `docs/superpowers/plans/PLAN-ajustes-admin-sets.md`
> Aplican las **Instrucciones Globales de Ejecución** (sin git commit/push, sin MCP Chrome DevTools, validación por build/lint/typecheck/Vitest, migraciones y seeds vía Drizzle ORM, reporte final en `docs/reports/`, resumen ejecutivo en el chat, sin archivos Markdown de resumen en el repo).

---

## Contexto

El administrador de Sets Corporativos (`/admin/sets/nuevo` y edición) requiere cuatro ajustes estructurales y una corrección de bug:

1. **Eliminar Grupos de Sets** del sistema completo.
2. **Portadas duales de set** (primaria + secundaria) con paridad exacta al sistema de portadas de producto.
3. **Eliminar el selector de Marca** del formulario de sets.
4. **Impedir piezas duplicadas**: el mismo producto no puede agregarse dos veces al set.
5. **Bug del selector de piezas**: existen 2 productos en el sistema (CKWW140 y CKWW615, ambos visibles en el listado de productos del admin), pero el buscador de piezas del set solo ofrece 1 (CKWW140); el polo CKWW615 no aparece y no puede seleccionarse.

### Decisiones ya tomadas (no reabrir)

1. **Grupos de Sets: eliminación total.** Admin (`/admin/grupos-de-sets`), filtro Grupo del sidebar de `/corporativo`, APIs, y migración Drizzle que elimina la columna de grupo en `sets` y la tabla de grupos. Sin período de convivencia.
2. **Portadas del set: primaria y secundaria obligatorias** para guardar/publicar — paridad exacta con productos.
3. **Dos modos de portada**, espejo del sistema de producto:
   - **Portadas especiales**: subir imágenes/video en el mismo momento (ambos slots obligatorios en este modo, video permitido en slots de portada, según las decisiones ya fijadas del rediseño de media).
   - **Portadas del contenido**: explorar las galerías de imágenes de **cualquier variante de color de cualquiera de los productos asociados al set**, y seleccionar de ahí la primaria y la secundaria.
4. **Referencia viva, no copia**: las portadas seleccionadas desde galerías de producto se vinculan vía `media_links` (FK al asset físico), igual que en productos — un renombre del asset se refleja solo; nunca se duplica el archivo en R2.
5. **Sin duplicación de componentes**: se reutiliza el sistema de portadas de producto (componentes/slots/picker) parametrizado para la entidad SET — no se crea una copia paralela.

---

## Fase 0 — Auditoría obligatoria (sin cambios de código)

1. **Bug del picker de piezas (prioridad):** localizar la consulta exacta que alimenta el buscador "Buscar por nombre, código, marca o colección..." y determinar por qué excluye a CKWW615. Hipótesis a verificar una por una, documentando cuál aplica:
   - filtro por la **marca seleccionada** en el formulario (el selector de marca que vamos a eliminar podría estar restringiendo el listado);
   - requisito de **precio al mayor** asignado (el formulario ya advierte "Una o más piezas no tienen precio al mayor asignado" — ¿el picker exige wholesale price y el listado no?);
   - filtro por **status**, tipo de producto, género o colección;
   - `limit`/paginación del endpoint de búsqueda o condición de búsqueda que no matchea el término vacío.
   Registrar el criterio de elegibilidad **explícito** que debe quedar documentado tras el fix (principio "sin opción muerta": si un producto no es elegible, el picker debe poder explicar por qué, no omitirlo en silencio).
2. **Consumidores de Grupos de Sets**: navegación del admin (incluida la bottom nav móvil si lo referencia), `useSetFilter`/`SetFilterSidebar` (filtro Grupo), `CorporativoContent`, APIs públicas y de admin, agregados del set (`groupSlug`/`groupName`), validación server-side de `POST /api/corporate/quotes` si menciona grupo, motor de reglas (verificar si existe scope/condición por grupo — el núcleo del motor no se toca; si hay scope de grupo, documentar el plan de retiro del context builder), seeds, sitemap y breadcrumbs.
3. **Sistema de portadas de producto**: inventariar los componentes reales (slots primario/secundario, modo subida especial, picker de galerías, validaciones de obligatoriedad, soporte de video) y su acoplamiento a la entidad producto, para dimensionar la parametrización a SET. Verificar cómo modela `media_links` la entidad SET hoy y qué slot(s) usa la card corporativa actual.
4. **Piezas duplicadas**: confirmar si hoy la API de crear/editar set acepta el mismo `product_id` dos veces y qué efectos produce (precio, armador, cotización).

Si la auditoría contradice supuestos del plan (ej. las portadas de producto no son parametrizables sin refactor mayor), detenerse y reportar antes de continuar.

---

## Fase 1 — Eliminación total de Grupos de Sets

Orden estricto (los consumidores mueren antes que el esquema):

1. Retirar el filtro Grupo de `SetFilterSidebar`/`useSetFilter` (incluidos tests del hook que lo cubran) y toda referencia en `/corporativo`.
2. Retirar `/admin/grupos-de-sets`, su entrada de navegación y los campos de grupo en el formulario de sets.
3. Retirar grupo de APIs, servicios de datos, agregados por set y seeds.
4. **Migración Drizzle**: eliminar la FK/columna de grupo en `sets` y luego la tabla de grupos. Seeds actualizados e idempotentes.
5. Barrido final: grep de identificadores de grupo con cero resultados fuera de migraciones históricas.

## Fase 2 — Portadas duales del Set (paridad con producto)

1. Parametrizar el sistema de portadas de producto para operar sobre la entidad SET (mismos componentes, presentación condicional — sin duplicar).
2. **Modo Portadas especiales**: subida en el momento a los slots primario/secundario del set (bucket `uniformes`, misma convención de rutas del rediseño de media para sets); ambos obligatorios; video permitido.
3. **Modo Portadas del contenido**: el picker enfocado explora las galerías de **todos los productos asociados al set en ese momento**, incluyendo todas sus variantes de color, y permite asignar primaria y secundaria como referencia viva (`media_links`). Si el set aún no tiene piezas, el modo lo explica y dirige a agregar piezas primero (sin opción muerta).
4. **Reglas de coherencia**: si se quita del set el producto cuya imagen está usada como portada, advertir en el momento (conteo/aviso) y exigir reasignar portada antes de guardar — nunca dejar un link roto ni una portada huérfana silenciosa.
5. Validación de publicación: sin primaria y secundaria válidas, el set no se guarda/publica; mensajes de error claros en español.
6. Superficies de lectura: card del corporativo y ficha del set consumen primaria/secundaria con el mismo patrón de producto (hover/secundaria si aplica el patrón existente).

## Fase 3 — Correcciones del formulario de Sets

1. **Eliminar el selector de Marca** del formulario (y del payload/validaciones de la API). Si la auditoría muestra que la marca del set se usaba en lectura (badges, filtro Marca del corporativo), la marca pasa a derivarse de las piezas (unión de marcas de los productos asociados) — documentar el ajuste aplicado.
2. **Anti-duplicados**: en el picker, los productos ya agregados al set aparecen deshabilitados con indicación "Ya está en el set" (no ocultos en silencio); validación también server-side en crear/editar set (rechazo con mensaje claro). Test de API cubriendo el caso.
3. **Fix del picker**: corregir la causa raíz hallada en Fase 0 para que el buscador ofrezca **todos** los productos elegibles (los 2 existentes deben aparecer). El criterio de elegibilidad final queda explícito en el código y documentado; si una pieza es elegible pero incompleta (ej. sin precio al mayor), aparece seleccionable con la advertencia existente — la advertencia informa, no oculta.

## Decisiones autónomas (resolver y flaggear en el resumen)

- Convención exacta de rutas en R2 para portadas especiales de sets, coherente con el árbol de carpetas del rediseño de media.
- Si el patrón primaria/secundaria de la card pública de producto (ej. swap en hover) se replica idéntico en la card de set o requiere ajuste visual.
- Tratamiento de sets existentes sin portadas válidas tras la migración de obligatoriedad (propuesta: quedan en borrador/no publicables con aviso en el listado admin — flaggear lo aplicado y el conteo).

## Fuera de alcance (no tocar)

- Núcleo del motor de reglas (`src/lib/rules-engine/`); solo context builders si la auditoría encuentra scope de grupo.
- Armador público de combinaciones, cotizaciones (más allá de referencias a grupo), Media Library en lo no relacionado con portadas de set, precios.
- No crear archivos Markdown de resumen; reporte de sesión en `docs/reports/`.

## Validación

- `build`, `lint`, `typecheck`, `vitest` en verde; migraciones y seeds ejecutados.
- Tests: anti-duplicados (API), obligatoriedad de portadas del set, elegibilidad del picker (los 2 productos actuales aparecen), `useSetFilter` sin grupo.
- Verificación de datos: cero referencias a grupos post-migración; `media_links` de portadas de set íntegros.
- Regresión: `/corporativo` funcional sin filtro Grupo; catálogo individual intacto.

## Respuesta final obligatoria

Según las Instrucciones Globales: **Resumen Ejecutivo** (incluyendo la causa raíz exacta del bug del picker y el criterio de elegibilidad final), **Verificación Manual en Producción** (checklist: buscador de piezas muestra CKWW140 y CKWW615; agregar dos veces el mismo producto es imposible en UI y rechazado por API; subir portadas especiales con video; seleccionar primaria de un producto y secundaria de la variante de color de otro; quitar la pieza cuya imagen es portada exige reasignar; guardar sin ambas portadas falla con mensaje claro; /corporativo sin filtro Grupo; formulario sin selector de marca), **Migraciones Ejecutadas**, **Builds y Validaciones**, y **Commits Sugeridos**.

Commits sugeridos de referencia:

```bash
git commit -m "feat: portadas primaria y secundaria obligatorias en sets con subida especial o seleccion desde galerias de productos asociados"

git commit -m "refactor: eliminar grupos de sets del sistema completo incluyendo admin, filtro corporativo y esquema"

git commit -m "fix: mostrar todos los productos elegibles en el selector de piezas del set, impedir piezas duplicadas y retirar selector de marca"
```

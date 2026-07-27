# Plan — Ciclo de Vida de Tareas/Sets, Anclaje de Tareas, Slug Automático y Orden de Matriz de Variantes

## Contexto y alcance

Este plan **extiende** el módulo de tareas construido en `2026-07-25-tareas-comentarios-pagos-productividad.md` (ciclo `PENDING → IN_PROGRESS → COMPLETED → APPROVED`, rama `REJECTED`, `catalog_task_groups`, subtareas `SET_PRODUCT_SLOT`) y el flag "Coordinador de tareas" ya existente en `/admin/usuarios` (visible en la captura: checkbox "Coordinador de tareas" sobre un usuario con rol Gestor del Catálogo). No crea ningún rol nuevo.

Cubre cuatro frentes independientes, agrupados en un solo plan porque comparten módulo (`/admin/productos`, `/admin/tareas`) y deben coordinarse en el orden de ejecución:

1. **Reestructuración del ciclo de vida de tareas y sets** — etiquetas de estado con semáforo de color, revisión por pieza en sets, autorización de finalización según quién asignó, y publicación automática de sets (`DRAFT → PUBLISHED`).
2. **Corrección del FAB de anclaje de tareas** — separar en dos componentes (anclaje dentro del formulario vs. panel de tareas no ancladas en el listado).
3. **Modal de detalle de tarea + quicklink en listado de productos.**
4. **Slug automático desde `code`** y **orden alfabético en la matriz de variantes.**

**Fuera de alcance (explícito):**
- El ícono de enlace de fuente en el listado de tareas (columna `sourceUrl`) — pospuesto por decisión explícita de Gustavo, no tocar en esta ejecución.
- Cualquier cambio al panel de pagos por productividad o al motor de tarifas (`src/lib/productivity-rates/`).
- Cualquier cambio a `src/lib/rules-engine/` — módulo puro, no se toca como efecto colateral.
- Creación de un rol `COORDINADOR` nuevo — ya existe como flag sobre Gestor del Catálogo.

---

## Decisiones cerradas (no reabrir sin autorización explícita)

1. **No hay rol nuevo.** "Coordinador" = flag existente `"Coordinador de tareas"` sobre un usuario con rol Gestor del Catálogo (capability: "Puede crear/asignar tareas y grupos a otros Gestores, igual que Admin dentro del módulo de Tareas"). Fase 0 debe mapear el nombre exacto del campo en `src/db/schema` (ej. `users.isTaskCoordinator` o similar) y confirmar dónde se usa hoy.

2. **Sin cambios de enum de estado.** La máquina de estados ya existente (`PENDING | IN_PROGRESS | COMPLETED | APPROVED | REJECTED`) se **reutiliza tal cual** a nivel de base de datos. El cambio es de **etiqueta/color en la UI**, no de esquema:
   - `PENDING` → "Pendiente" (gris)
   - `IN_PROGRESS` → "En progreso" (amarillo)
   - `COMPLETED` → se muestran **dos chips simultáneos**: "Completada" (azul) + "Por revisar" (naranja)
   - `REJECTED` → "Corregir" (rojo)
   - `APPROVED` → "Finalizada" (verde)
   - Fase 0 debe confirmar que ningún consumidor actual asume una correspondencia 1:1 entre estado y una sola etiqueta visual antes de introducir el doble chip.

3. **Transición automática a revisión.** Cuando el Gestor marca una tarea simple como completada (`IN_PROGRESS → COMPLETED`), el sistema muestra un **diálogo informativo** ("Tu tarea pasó a revisión de [nombre del Admin/Coordinador que la asignó]") — no requiere una acción separada del Gestor para "enviar a revisión"; ocurre en el mismo clic.

4. **Autorización de finalización (`APPROVED`) — enforcement en API, no solo UI:**
   - Si `assignedBy` es un usuario con rol `ADMIN` → **solo Admin** puede aprobar/rechazar esa tarea.
   - Si `assignedBy` es un Gestor con flag Coordinador → **cualquier Coordinador** puede aprobar/rechazar (no exclusivamente quien la asignó).
   - **Admin puede finalizar cualquier tarea sin excepción**, incluidas las asignadas por un Coordinador.
   - Esta regla se valida en el servicio (`approveTask`/`rejectTask` en `task-service.ts`), no únicamente ocultando el botón en el cliente — una llamada directa a la API debe rechazarse igual con 403 si el usuario no califica.

5. **Piezas de set — aprobación independiente.** Dentro de una tarea `CREATE_SET`/`EDIT_SET` con subtareas `SET_PRODUCT_SLOT`:
   - Cada pieza se marca `COMPLETED` por el Gestor de forma individual (doble chip "Completada"/"Por revisar" igual que una tarea simple).
   - El Coordinador/Admin puede **aprobar piezas sueltas** (`APPROVED`, verde) aunque el resto del set no esté terminado — no espera a que todas las piezas lleguen a `COMPLETED`.
   - "Corregir" también es **por pieza**: comentario obligatorio, esa subtarea vuelve a `IN_PROGRESS`; las demás piezas no se alteran.
   - La tarea **padre** (`CREATE_SET`) permanece en `IN_PROGRESS` mientras existan piezas no aprobadas, mostrando un **visor de avance** (ej. "2/4 piezas aprobadas", con detalle de cuál pieza y quién la hizo).
   - Cuando **todas** las piezas hijas llegan a `APPROVED`, el padre pasa **automáticamente** a `APPROVED` (Finalizada) — sin paso de revisión adicional sobre el conjunto armado.

6. **Estado Borrador de sets — campo persistido, sincronizado automáticamente.**
   - Se agrega `sets.status: 'DRAFT' | 'PUBLISHED'` (nombre de tabla a confirmar en Fase 0 — el proyecto usa `corporate_sets` o similar).
   - Mientras la tarea padre `CREATE_SET` no esté `APPROVED`, el set permanece `DRAFT`.
   - Un set en `DRAFT` **no aparece** en `/corporativo` ni en el armador público, independientemente de cuántas piezas tenga cargadas — visible solo en `/admin/sets`.
   - Cuando el padre pasa a `APPROVED` (regla 5), el set se publica **automáticamente en el mismo instante** (`DRAFT → PUBLISHED`) — no hay botón "Publicar" separado.
   - Un set creado fuera del flujo de tareas (sin tarea `CREATE_SET` asociada) nace `PUBLISHED` por defecto, para no romper la creación manual existente — confirmar este comportamiento en Fase 0 si hay sets sin tarea vinculada en producción.

7. **Separación del FAB de anclaje en dos componentes:**
   - **Componente A — "Anclar tarea"** (dentro de `ProductForm`/`SetForm`, crear o editar, nunca en el listado): permite elegir una tarea `PENDING`/`IN_PROGRESS` asignada al usuario actual, **siempre a nivel de producto individual** — incluso si el producto pertenece a un set, se ancla la subtarea `SET_PRODUCT_SLOT` de esa pieza específica, nunca el set completo. Una vez anclada, el botón dejar de ser selector y muestra el **detalle** de la tarea anclada, con una acción explícita **"Cambiar tarea anclada"** para volver al selector (permite corregir errores del operador).
   - **Componente B — "Panel de tareas"** (dentro del listado `/admin/productos`, no en el form): lista tareas **no ancladas** en estado `PENDING` o `COMPLETED` (mostrado como "Por revisar") — sirve para que el Gestor vea qué le falta y el Coordinador/Admin vea qué está pendiente de revisión sin abrir un producto puntual.
   - Esto corrige el bug actual (`TaskAnchorFab.tsx`) donde un solo componente se abre indistintamente en listado y formulario.

8. **Modal de detalle de tarea — contenido completo:**
   - Detalle básico: título, tipo, estado (con las etiquetas de la decisión 2), asignado, fechas.
   - Hilo de comentarios completo (`catalog_task_comments`), lectura **y escritura** desde el mismo modal.
   - Acciones de cambio de estado según el rol de quien lo abre (Gestor: marcar completada; Coordinador/Admin: aprobar/corregir, respetando la regla de autorización de la decisión 4).
   - Para tareas de tipo set: visor de piezas (cuántas aprobadas, quién hizo cada una) dentro del mismo modal.
   - Un solo componente `<TaskDetailModal />`, reutilizado desde el listado de tareas y desde el quicklink en el listado de productos (sin duplicación).

9. **Quicklink en el listado de productos (`/admin/productos`):**
   - Columna nueva: si el producto tiene tarea vinculada, chip de texto con el color semáforo del estado (mismo mapeo de la decisión 2); clic abre `<TaskDetailModal />`.
   - Si no tiene tarea vinculada: guion (`—`).
   - Si tiene varias tareas históricas: el chip muestra la más reciente/activa, más un ícono de histórico aparte que abre una modal con la traza completa de tareas anteriores de ese producto.

10. **Buscador en `/admin/tareas`:** texto libre sobre **título de la tarea** y **`targetCode`** únicamente (sin nombre de Gestor asignado — "la protagonista es la tarea").

11. **Slug de producto:** se recalcula **tanto al crear como al editar**, siempre derivado de `products.code` actual. Deja de ser un campo de edición libre en el formulario (o queda de solo lectura mostrando el valor calculado — a decidir en implementación según UX, pero el valor SIEMPRE proviene del código). Sin lógica de sufijo anti-colisión: como `code` ya tiene validación de unicidad global, el slug derivado hereda esa unicidad sin necesidad de resolver colisiones.

12. **Orden de colores en Matriz de Variantes:**
    - El selector de chips de color (antes de generar) se reordena **alfabéticamente en tiempo real** a medida que se van marcando/agregando colores — no espera a la generación.
    - Nuevo botón "Ordenar alfabéticamente" sobre la lista de variantes **ya generadas**: reescribe `colorSortOrder` de cada variante según el nombre del color (A→Z) en el estado del formulario — mismo patrón que el drag-and-drop existente (persiste al guardar el producto, no es un cambio inmediato en base de datos).
    - El drag-and-drop manual **sigue disponible** después de usar el botón (no lo bloquea ni lo reemplaza).

---

## Fase 0 — Auditoría obligatoria (sin cambios de código)

Producir una matriz de estado verificada antes de tocar nada. Detenerse y reportar si algún hallazgo contradice las decisiones anteriores.

1. **Flag de Coordinador:** ubicar el nombre exacto del campo en `src/db/schema` (tabla `users`) que respalda el checkbox "Coordinador de tareas" visto en `/admin/usuarios`, y todo lugar donde ya se consulte (`TaskAnchorFab.tsx`, `task-service.ts`, middleware de permisos). Confirmar si ya existe lógica de autorización basada en este flag o si toda la Fase 3 de este plan debe construirla desde cero.
2. **`assignedBy` en `catalog_tasks`:** confirmar que la columna existe y se puebla siempre (no nullable) — es la base de la regla de autorización de finalización (decisión 4). Si falta, planificar migración + backfill (asumir Admin como `assignedBy` para tareas históricas sin dato, o flaggear para revisión manual).
3. **Esquema de Sets:** confirmar el nombre real de la tabla de sets corporativos (`corporate_sets` o equivalente), si ya tiene algún campo de estado/visibilidad (`status`, `isActive`, `isPublished`) que pudiera colisionar o reutilizarse en vez de crear `DRAFT/PUBLISHED` desde cero. Confirmar cómo se relaciona un set con su tarea `CREATE_SET` (¿`catalogTasks.targetEntityId`? ¿`groupId`?) para poder disparar la sincronización automática.
4. **Sets sin tarea asociada:** contar cuántos sets en producción no tienen una tarea `CREATE_SET`/`groupId` vinculada — define el default de `status` para esos registros (decisión 6, último punto).
5. **`TaskAnchorFab.tsx` — extensión real del bug:** confirmar en qué rutas se monta hoy (`isProductsPanel`/`isSetsPanel` en el código ya visto) y si el listado (`/admin/productos` tabla) y el formulario (`ProductForm`) comparten el mismo layout/ruta base de forma que el `pathname.startsWith()` actual no distingue entre ambos — esto es probablemente la causa raíz del bug.
6. **`catalog_task_comments`:** confirmar que el endpoint y el modelo ya soportan lectura y escritura (mencionado en el plan anterior, Fase 4) — si el modal de detalle (decisión 8) puede reutilizar `<CommentThread mode="task" />` tal cual o necesita ajustes de layout para el modal grande.
7. **`ProductForm` — slug:** ubicar el campo/lógica actual de generación de slug (probablemente solo en creación) y todo lugar que lo consuma como si fuera editable libremente, para no romper flujos que dependan de un slug manual ya guardado en producción (aunque la decisión 11 dice que siempre se recalcula, hay que confirmar que no hay URLs externas ya indexadas que se roman de forma masiva e inesperada — si el hallazgo es significativo, reportar antes de continuar).
8. **`AttributeMatrixSection.tsx`:** confirmar el origen actual del orden de `colors` (¿viene de `brandColors` en orden de asociación?) para saber dónde aplicar el `sort()` alfabético del selector de chips (decisión 12).
9. **`sourceUrl` en listado de tareas:** confirmar que efectivamente está fuera de alcance y no requiere ningún cambio colateral por las modificaciones de esta fase (ej. si el nuevo modal reemplaza visualmente esa columna, no se debe alterar su comportamiento actual).

Si la auditoría revela que `assignedBy` no existe o que el flag de Coordinador no está mapeado a ningún lugar consultable, **detenerse y reportar** antes de construir la Fase 3.

---

## Fase 1 — Esquema y migraciones (Drizzle ORM)

- `catalog_tasks`: confirmar/agregar `assignedBy` (FK a `users`, not null) si la auditoría (Fase 0.2) lo requiere.
- Tabla de sets: agregar `status` (`text`, default `'PUBLISHED'`, valores `'DRAFT' | 'PUBLISHED'`) — el default `PUBLISHED` cubre sets creados fuera del flujo de tareas (decisión 6); los sets creados vía tarea `CREATE_SET` se insertan explícitamente en `DRAFT` desde el servicio de creación.
- Migración idempotente + seed de backfill: sets existentes con tarea `CREATE_SET` ya `APPROVED` → `PUBLISHED`; sets con tarea `CREATE_SET` en cualquier otro estado → `DRAFT` (revisar con Gustavo antes de correr en producción si el conteo de la Fase 0.4 es alto, para evitar ocultar sets que ya estaban visibles).

---

## Fase 2 — Servicio de tareas: autorización y transición de estado

En `src/lib/task-service.ts`:

- `canReviewTask(task, currentUser)`: función pura que implementa la decisión 4 —
  - `currentUser.role === 'ADMIN'` → `true` siempre.
  - `task.assignedBy` tiene flag Coordinador → `true` si `currentUser` tiene flag Coordinador (cualquiera, no solo quien asignó).
  - `task.assignedBy` es Admin → `false` si `currentUser` no es Admin.
- `approveTask`/`rejectTask`: invocar `canReviewTask` al inicio; lanzar error explícito (403 a nivel de API route) si no califica — **no solo ocultar el botón en cliente**.
- `completeTask` (nueva función o extensión de `advanceTaskStatus` para `IN_PROGRESS → COMPLETED`): al completar, además de lo que ya hace, resolver el `assignedBy` y devolver el nombre para que el frontend arme el diálogo informativo (decisión 3) sin una segunda llamada.
- **Aprobación por pieza de set:** `approveTask` ya opera sobre `taskId` individual (confirmado en el código existente) — verificar que la lógica de "si todas las tareas del grupo están `APPROVED`, marcar grupo completado" (ya existe en `approveTask`) es exactamente el disparador que activa la sincronización de `sets.status → PUBLISHED` (decisión 5/6). Conectar ese punto con el servicio de sets (posible nueva función `publishSetIfGroupApproved(groupId)` invocada al final de `approveTask`).
- **Corrección por pieza (`rejectTask`):** ya opera sobre `taskId` individual — confirmar que rechazar una pieza no afecta el estado de las demás piezas del grupo (comportamiento ya esperado por el código actual, solo falta la UI que lo exponga).

---

## Fase 3 — UI: etiquetas de estado, diálogo de transición y visor de piezas

- Componente centralizado `<TaskStatusBadge status={...} />`: único punto de mapeo estado→color/etiqueta (decisión 2), usado en listado de tareas, quicklink de productos, y modal de detalle — evita duplicar el mapeo en varios lugares.
- Diálogo informativo al completar (decisión 3): modal de confirmación simple tras el clic "Marcar como completada", mostrando "Tu tarea pasó a revisión de [nombre]".
- `<SetTaskProgressViewer groupId={...} />`: lista las piezas (`SET_PRODUCT_SLOT`) de un grupo con su estado individual (`<TaskStatusBadge />` por pieza), acción de aprobar/corregir por pieza para quien tenga permiso (`canReviewTask`), y contador "X/Y piezas aprobadas". Usado tanto en el listado de tareas como dentro de `<TaskDetailModal />` cuando la tarea es de tipo set (decisión 8).

---

## Fase 4 — Separación del FAB de anclaje

- Renombrar/dividir `TaskAnchorFab.tsx`:
  - **`TaskAnchorControl`**: se monta **dentro** de `ProductForm`/`SetForm` (no como FAB fijo de página, sino como sección del formulario). Consume `useAnchoredTask()` igual que hoy. Muestra selector si no hay tarea anclada para este producto/pieza; muestra detalle + botón "Cambiar tarea anclada" si ya existe una.
  - **`UnanchoredTasksPanel`**: FAB o panel lateral montado **solo** en el listado `/admin/productos` (y `/admin/sets` si aplica). Lista tareas con `targetEntityId IS NULL` (o el criterio real de "no ancladas" que confirme la Fase 0) en estado `PENDING` o `COMPLETED` ("Por revisar"), con buscador de texto libre (decisión 10, aplicado aquí también si Gustavo lo desea — confirmar alcance del buscador: ¿solo en `/admin/tareas` o también en este panel? revisar con Gustavo si queda ambiguo tras Fase 0).
- Eliminar la condición actual `isProductsPanel || isSetsPanel` que monta un solo componente en ambos contextos indiscriminadamente — cada componente nuevo se monta explícitamente en su lugar correspondiente (formulario vs. listado), sin depender de heurísticas de `pathname`.

---

## Fase 5 — Modal de detalle de tarea + quicklink en productos

- `<TaskDetailModal taskId={...} />`: modal grande, contenido según decisión 8 (detalle + `<CommentThread mode="task" />` + acciones de estado condicionadas por `canReviewTask` + `<SetTaskProgressViewer />` si aplica).
- Columna nueva en la tabla de `/admin/productos`: `<TaskStatusBadge />` de la tarea más reciente vinculada al producto (clic abre `<TaskDetailModal />`), guion si no hay ninguna, ícono de histórico si hay más de una (abre `<TaskHistoryModal productId={...} />` de solo lectura con la traza completa).
- Buscador en `/admin/tareas`: filtro de texto libre sobre `title` y `targetCode` (decisión 10) — ajustar `listTasks()` en `task-service.ts` para aceptar un parámetro `search` con `ILIKE` sobre ambos campos.

---

## Fase 6 — Slug automático desde código

- En el servicio de guardado de producto (creación y edición): generar `slug` a partir de `products.code` (slugify estándar del proyecto, si existe una utilidad ya usada en otro lado — confirmar en Fase 0) en **ambos** flujos, reemplazando cualquier valor manual que hubiera en el campo.
- Ajustar `ProductForm`: el campo slug pasa a mostrar el valor calculado (solo lectura o deshabilitado, según lo que se decida más natural en la implementación) — sin lógica de sufijo anti-colisión, apoyándose en la unicidad ya validada de `code`.
- Tests Vitest: generación de slug al crear, regeneración al editar (incluyendo el caso de cambiar el `code` de un producto ya publicado), y que la unicidad de `code` efectivamente previene colisión de `slug`.

---

## Fase 7 — Orden alfabético en Matriz de Variantes

- `AttributeMatrixSection.tsx`: ordenar `colors` alfabéticamente por nombre antes de renderizar los chips seleccionables (aplica al array completo, no solo a los ya seleccionados, para que el orden sea estable desde el inicio).
- Nuevo botón "Ordenar alfabéticamente" sobre la lista de variantes generadas: recorre `variantFields`, agrupa por `colorId`, ordena los grupos por nombre de color (A→Z), y reescribe `colorSortOrder` de cada variante en el estado del formulario (mismo mecanismo que ya usa el drag-and-drop existente — no persiste en DB hasta guardar el producto).
- Confirmar visualmente que el drag-and-drop sigue operativo después de usar el botón (no debe quedar bloqueado).

---

## Riesgos y advertencias

- **Enforcement de autorización solo en servicio, no en middleware de permisos genérico** (`requireRole`) — la regla de la decisión 4 es específica a `catalog_tasks.assignedBy`, no un permiso de módulo estándar; debe implementarse como lógica de negocio dentro de `task-service.ts`, y las API routes de aprobar/rechazar deben llamarlo explícitamente antes de cualquier `update`.
- **Backfill de `assignedBy`** (si falta, Fase 0.2): si hay tareas históricas sin este dato, la regla de autorización no puede evaluarse correctamente para ellas — decidir con Gustavo un fallback razonable (ej. tratar como asignada por Admin) antes de habilitar la Fase 2 en producción.
- **Publicación automática de sets** puede exponer al público sets que estaban en proceso si el backfill de la Fase 1 clasifica mal un set existente — correr el backfill primero en un conteo de verificación (Fase 0.4) antes de aplicar en producción, y revisar con Gustavo la lista de sets que cambiarían de visibilidad.
- **Slug siempre recalculado** (decisión 11, sin excepción) rompe cualquier URL externa ya indexada si el `code` de un producto existente cambia después de esta implementación — está aceptado explícitamente por Gustavo, pero debe advertirse en el reporte final como comportamiento esperado, no como bug.
- **Buscador del panel de tareas no ancladas** (Fase 4) quedó con alcance ambiguo (¿aplica ahí también o solo en `/admin/tareas`?) — Claude Code debe confirmar con Gustavo antes de implementarlo en el panel del listado si la Fase 0 no lo aclara por sí sola.

---

## Autorrevisión frente a las decisiones de Gustavo

- Sin rol nuevo, flag Coordinador reutilizado — ✅ (decisión 1, Fase 0.1).
- Reutilización del enum existente, solo cambio de etiquetas — ✅ (decisión 2, Fase 3).
- Diálogo automático al completar — ✅ (decisión 3, Fase 2/3).
- Autorización de finalización según `assignedBy`, Admin siempre puede — ✅ (decisión 4, Fase 2).
- Aprobación/corrección por pieza en sets, padre automático al completar todas — ✅ (decisión 5, Fase 2/3).
- Borrador↔Publicado sincronizado automáticamente desde la tarea padre — ✅ (decisión 6, Fase 1/2).
- FAB dividido en dos componentes con contextos claros — ✅ (decisión 7, Fase 4).
- Modal de detalle completo (comentarios + acciones + visor de piezas) — ✅ (decisión 8, Fase 5).
- Quicklink con chip semáforo + guion + histórico — ✅ (decisión 9, Fase 5).
- Buscador de tareas por título/código — ✅ (decisión 10, Fase 5).
- Slug automático en creación y edición, sin sufijos — ✅ (decisión 11, Fase 6).
- Selector de colores alfabético en tiempo real + botón de reordenar variantes generadas — ✅ (decisión 12, Fase 7).

---

## Respuesta final obligatoria (Claude Code)

Al ejecutar este plan, la respuesta en chat debe seguir el formato de las Instrucciones Globales: **Resumen Ejecutivo**, **Verificación Manual en Producción** (incluir explícitamente: probar aprobación de pieza individual de un set sin que las demás estén completas; probar que un set nuevo permanece invisible en `/corporativo` hasta que su tarea padre se aprueba en su totalidad; probar que un Coordinador puede finalizar tareas de otro Coordinador pero no las asignadas por Admin; probar edición de un producto ya publicado y confirmar que el slug cambia junto con el código), **Migraciones Ejecutadas**, **Builds y Validaciones**, **Commits Sugeridos**.

Commits sugeridos de referencia (uno por fase mayor):

```bash
git commit -m "feat: autorizacion de finalizacion de tareas segun asignador y aprobacion independiente de piezas de set"

git commit -m "feat: publicacion automatica de sets al completar todas las tareas de sus piezas"

git commit -m "fix: separar el FAB de anclaje de tareas del panel de tareas no ancladas del listado"

git commit -m "feat: modal de detalle de tarea con comentarios, acciones de revision y visor de piezas de set"

git commit -m "feat: quicklink de tarea vinculada y buscador en listado de tareas"

git commit -m "feat: regenerar slug de producto automaticamente desde el codigo al crear y editar"

git commit -m "feat: orden alfabetico de colores en selector y boton de reordenar variantes generadas"
```

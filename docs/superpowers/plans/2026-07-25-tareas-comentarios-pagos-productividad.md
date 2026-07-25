# Plan — Tareas, Comentarios, Actividad Detallada y Pagos por Productividad (Gestor del Catálogo)

## Contexto y alcance

El plan RBAC (`2026-07-25-rbac-gestion-usuarios.md`) ya dejó construido: `catalog_activity_log` (inicio/fin/duración por producto, variante, set y medio), `productivity_targets` (meta diaria por usuario) y `/admin/productividad` (semáforo de cumplimiento). Este plan **extiende** esa base — no la reemplaza — con cuatro capas nuevas para el rol Gestor del Catálogo:

1. **Asignación de tareas** — el Admin asigna trabajo concreto (crear producto, crear set, subir medios, o una tarea abierta) y le da seguimiento hasta su aprobación.
2. **Comentarios Admin ↔ Gestor** — dos hilos independientes: por tarea y por entidad (producto/set), sin relación obligatoria entre ambos.
3. **Actividad detallada** — se conserva el registro actual (inicio/fin/duración) y se agrega: diff de campos modificados en cada edición, eventos de abandono (formulario abierto sin guardar) y conteo de medios subidos por ítem.
4. **Panel de pagos por productividad** — motor de tarifas configurable por nivel (Junior/Senior/custom), combinable entre componentes (variante, producto, set, medio, bono/penalización por tiempo), con períodos de pago abiertos/cerrados/pagados, ajustes manuales y recálculo explícito. Todo el módulo queda apagado por defecto (interruptor maestro).

**Fuera de alcance (explícito):**
- Cualquier integración de pago real (transferencias, pasarelas). El módulo calcula y registra montos; el pago físico ocurre fuera del sistema.
- Extender tareas/comentarios/pagos a los roles Ventas o Despachador — este plan es exclusivo del rol Gestor del Catálogo.
- Tocar `src/lib/rules-engine/` (motor de precios de producto) — el nuevo motor de tarifas de productividad es un módulo independiente y no debe confundirse ni acoplarse con él.

---

## Decisiones arquitectónicas cerradas (no reabrir sin autorización explícita)

1. **Elegibilidad de pago — modo híbrido:** por defecto, cualquier ítem guardado (producto/variante/set/medio) cuenta para el cálculo de productividad, sin requerir tarea previa. Por usuario, el Admin puede activar un flag `requiresAssignedTask` que restringe el conteo únicamente a ítems vinculados a una tarea asignada.
2. **Comentarios — dos hilos independientes:** `catalog_task_comments` (atado a una tarea) y `catalog_entity_comments` (atado a `entityType` + `entityId`, sin relación con tareas). Un comentario pertenece a exactamente uno de los dos hilos.
3. **Ciclo de vida de la tarea:** `PENDING → IN_PROGRESS → COMPLETED → APPROVED`, con rama `REJECTED` (desde `COMPLETED`, con motivo obligatorio) que regresa la tarea a `IN_PROGRESS`.
4. **Estructura de tarea — híbrida:**
   - **Tipada:** `type` en (`CREATE_PRODUCT | CREATE_SET | UPLOAD_MEDIA | EDIT_PRODUCT | EDIT_SET`) + `targetCode` (style code, aún no existente) o `targetEntityType`/`targetEntityId` (entidad ya existente).
   - **Genérica:** `type = GENERIC`, solo título + descripción libre, sin vínculo a entidad. El Gestor no la asocia retroactivamente a un producto/set — es una tarea de alcance abierto (ej. "reorganizar biblioteca de la marca X").
5. **Tarifas por nivel (tier), no por usuario individual ni global única:** tabla `productivity_rate_tiers` (ej. "Junior", "Senior", o niveles custom que cree el Admin). Cada usuario Gestor tiene un `tierId` asignado.
6. **Componentes de la fórmula — todos combinables y activables/desactivables de forma independiente por tier:**
   - Precio fijo por variante instalada.
   - Precio fijo por producto (style code) creado.
   - Precio fijo por set corporativo armado.
   - Precio fijo por medio (foto/video) subido y vinculado.
   - Bono/penalización según tiempo promedio contra la meta (`productivity_targets`): más rápido = bono, más lento = penalización o cero, configurable por tier.
7. **Elegibilidad temporal del ítem para el cálculo:** un ítem cuenta **al guardarse** (no espera aprobación de tarea). Si la tarea asociada pasa a `REJECTED`, el ítem se **anula** del cálculo de productividad (queda marcado, no se borra el registro de actividad — solo se excluye del monto).
8. **Panel de pagos — reporte + registro de pago con historial completo:**
   - Períodos de pago (`payment_periods`) con corte **configurable por el Admin** (no hay cron fijo semanal/quincenal/mensual — el Admin abre y cierra el período con las fechas que decida).
   - Botón explícito **"Marcar período como pagado"**.
   - Historial de montos, fecha de pago, y **ajustes manuales** (suma/resta con motivo obligatorio) por usuario y período.
   - Exportable (CSV, reutilizando el patrón ya existente en el proyecto para exportaciones si aplica, o `Papa.unparse` equivalente en backend).
9. **Recálculo de período — manual, no automático:** un cambio de tarifa en un tier **no** recalcula solo. El Admin dispara un botón explícito **"Recalcular período"**, disponible únicamente en períodos `OPEN` (nunca en `CLOSED` o `PAID`).
10. **Interruptor maestro:** `system_settings.payment_module_enabled` (boolean, default `false`). Con el módulo apagado, `/admin/pagos` no aparece en el sidebar y las rutas devuelven 403 aunque el usuario tenga el permiso `pagos:read`/`pagos:write` — el interruptor global tiene precedencia sobre la matriz de permisos.
11. **Notificaciones:**
    - Badge/contador en el panel para: tarea asignada, tarea rechazada, tarea en revisión, comentario nuevo (en cualquiera de los dos hilos).
    - **Correo vía Resend** solo para dos eventos críticos: tarea asignada y tarea rechazada. El resto queda solo como badge.
12. **Actividad detallada — todas las capas activas:**
    - Se conserva el registro actual (inicio/fin/duración) sin cambios de comportamiento.
    - Se agrega diff de campos modificados en cada `UPDATE` (antes/después, solo campos que cambiaron).
    - Se agregan eventos de abandono: formulario abierto (`started_at` registrado) sin `finished_at` tras un umbral de inactividad, marcado por un job o al detectar una nueva sesión de actividad del mismo usuario sin cierre de la anterior.
    - Se agrega conteo de medios subidos/vinculados por ítem dentro de la misma sesión de actividad.

---

## Fase 0 — Auditoría obligatoria (sin tocar código)

1. Confirmar en `src/db/schema/rbac.ts` la definición exacta actual de `catalog_activity_log` (columnas, enums `entity_type`/`action`) para diseñar la migración de extensión sin duplicar campos.
2. Confirmar si existe ya algún patrón de "sesión de edición" reutilizable en los formularios de producto/set/medio para enganchar ahí la detección de abandono, o si `useActivityTracking` (Fase 7 del plan RBAC) es el único punto de instrumentación disponible.
3. Confirmar el mecanismo de subida/vinculación de medios en la biblioteca (endpoint(s) involucrados) para saber dónde incrementar el conteo de medios por sesión de actividad.
4. Confirmar en `src/lib/permissions/` el catálogo maestro de módulos (`permissions` table) y el patrón de alta de nuevos módulos (`tareas`, `comentarios`, `pagos`) sin romper la matriz existente en `/admin/permisos`.
5. Confirmar la tabla/patrón de `system_settings` (o equivalente singleton) donde agregar `payment_module_enabled`, o si debe crearse una tabla nueva si no existe un lugar natural.
6. Confirmar el patrón de envío de correo vía Resend ya usado (helper en `src/lib/email/`) para reutilizarlo en los dos eventos críticos (asignación y rechazo de tarea), respetando `FROM_ADDRESS = no-reply@notificaciones.allmedicuniforms.com`.
7. Verificar si Drizzle en este proyecto ya usa el tipo `numeric`/`decimal` para montos monetarios en algún otro módulo (ej. cotizaciones) y replicar esa convención para las tarifas y montos de pago, evitando `float`.

Si algún hallazgo contradice las decisiones cerradas arriba, **detener y reportar** antes de generar migraciones.

---

## Fase 1 — Schema (Drizzle)

Nuevas tablas (más extensión de `catalog_activity_log` y `users`):

- **`catalog_tasks`**: `id`, `type` (enum `CREATE_PRODUCT | CREATE_SET | UPLOAD_MEDIA | EDIT_PRODUCT | EDIT_SET | GENERIC`), `title`, `description`, `targetCode` (nullable, style code aún no creado), `targetEntityType` (nullable, enum `PRODUCT | SET`), `targetEntityId` (nullable), `assignedTo` (FK `users`), `assignedBy` (FK `users`), `status` (enum `PENDING | IN_PROGRESS | COMPLETED | APPROVED | REJECTED`), `rejectionReason` (nullable), `createdAt`, `updatedAt`, `completedAt` (nullable), `reviewedAt` (nullable).
- **`catalog_task_comments`**: `id`, `taskId` (FK `catalog_tasks`), `authorId` (FK `users`), `body`, `createdAt`.
- **`catalog_entity_comments`**: `id`, `entityType` (enum `PRODUCT | SET`), `entityId`, `authorId` (FK `users`), `body`, `createdAt`.
- **`catalog_notifications`**: `id`, `userId` (FK `users`), `type` (enum `TASK_ASSIGNED | TASK_REJECTED | TASK_STATUS_CHANGED | TASK_COMMENT | ENTITY_COMMENT`), `relatedTaskId` (nullable), `relatedCommentId` (nullable), `readAt` (nullable), `createdAt`.
- **`productivity_rate_tiers`**: `id`, `name`, `createdAt`.
- **`productivity_rates`**: `id`, `tierId` (FK), `componentType` (enum `VARIANT | PRODUCT | SET | MEDIA | TIME_BONUS`), `enabled` (boolean), `amount` (`numeric`), campos adicionales para `TIME_BONUS` (`bonusPerUnitUnderTarget`, `penaltyPerUnitOverTarget`, ambos `numeric` nullable).
- **`payment_periods`**: `id`, `startDate`, `endDate`, `status` (enum `OPEN | CLOSED | PAID`), `closedAt` (nullable), `paidAt` (nullable), `notes` (nullable), `createdAt`.
- **`payment_period_items`**: `id`, `periodId` (FK), `userId` (FK), `computedAmount` (`numeric`), `manualAdjustment` (`numeric`, default 0), `adjustmentReason` (nullable), `finalAmount` (`numeric`, generado o recalculado al guardar), `voidedItemsCount` (integer, informativo), `computedAt`.

Extensión de tablas existentes:

- `users`: agregar `tierId` (FK nullable a `productivity_rate_tiers`), `requiresAssignedTaskForPayment` (boolean, default `false`).
- `catalog_activity_log`: agregar `taskId` (FK nullable a `catalog_tasks`), `changedFields` (`jsonb` nullable, diff antes/después para `UPDATE`), `mediaCount` (integer nullable), `status` (enum `COMPLETED | ABANDONED`, default `COMPLETED`), `voidedByRejection` (boolean, default `false`).
- Tabla singleton de configuración existente (a confirmar en Fase 0, o `system_settings` nueva si no existe): agregar `payment_module_enabled` (boolean, default `false`).
- `permissions` (seed): agregar módulos `tareas`, `comentarios`, `pagos` con acciones `read`/`write`.
- `role_permissions` (seed inicial): `CATALOG_MANAGER` recibe `tareas:read`, `comentarios:read`, `comentarios:write` (propias), `pagos:read` (solo su propio historial). `ADMIN` mantiene bypass total.

Migraciones idempotentes + seeds correspondientes, siguiendo el patrón Drizzle-only ya establecido en el proyecto.

---

## Fase 2 — Motor de tarifas (servicio puro)

`src/lib/productivity-rates/` (sin dependencias de UI, análogo en pureza al `rules-engine` pero completamente independiente de él):

- `calculatePeriodAmount(userId, periodId)`: lee `catalog_activity_log` del rango de fechas del período, excluye filas `voidedByRejection = true` y (si aplica `requiresAssignedTaskForPayment`) filas sin `taskId`, agrupa por `entityType`/`action`, aplica la tarifa del tier del usuario por componente habilitado, suma el bono/penalización por tiempo comparando contra `productivity_targets`.
- `recalculatePeriod(periodId)`: solo permitido si `payment_periods.status = 'OPEN'`; recorre todos los usuarios con actividad en el rango y regenera `payment_period_items.computedAmount` (preserva `manualAdjustment` existente, recalcula `finalAmount`).
- Guard de módulo: toda función pública de este servicio verifica primero `payment_module_enabled`; si está apagado, lanza error explícito (no falla silenciosamente).

---

## Fase 3 — Asignación de tareas

- `/admin/tareas` (Admin): listado con filtro por estado, Gestor asignado, tipo. Crear tarea: tipada (con `targetCode`/entidad) o genérica. Al crear, dispara notificación (badge + correo).
- Vista del Gestor (`/admin` dashboard o sección propia): sus tareas asignadas, con acción para pasar `PENDING → IN_PROGRESS` y `IN_PROGRESS → COMPLETED`.
- Acción de revisión (Admin, solo sobre tareas `COMPLETED`): `Aprobar` → `APPROVED`, o `Rechazar` (motivo obligatorio) → `REJECTED` (regresa a `IN_PROGRESS`) — al rechazar, dispara el proceso de anulación de ítems asociados (Fase 6) y notificación por correo.

---

## Fase 4 — Comentarios

- Componente reutilizable `<CommentThread />` (un solo componente, sin duplicar entre los dos contextos): recibe `mode: 'task' | 'entity'` y el identificador correspondiente.
- Endpoints: `POST /api/admin/tasks/:id/comments`, `GET /api/admin/tasks/:id/comments`; `POST /api/admin/entity-comments`, `GET /api/admin/entity-comments?entityType=&entityId=`.
- Cada comentario nuevo genera una fila en `catalog_notifications` (badge) para el otro participante de la conversación (Admin si comenta el Gestor, y viceversa — no a todos los Admins salvo que se decida ampliarlo después).

---

## Fase 5 — Actividad detallada (extensión de `useActivityTracking`)

- Al finalizar (`PATCH /api/admin/activity/:id/finish`), calcular `changedFields` comparando el payload previo (snapshot capturado al abrir el formulario) contra el guardado final — solo para `action = UPDATE`.
- Job o verificación al abrir una nueva sesión de actividad del mismo usuario: si existe una fila previa del mismo usuario con `finished_at IS NULL` y `started_at` más antiguo que un umbral razonable, marcarla `status = ABANDONED` antes de crear la nueva.
- `mediaCount`: incrementar en la fila de actividad activa (por `entityId` + usuario) cada vez que se sube/vincula un medio dentro de esa sesión, usando el mismo `activityId` ya devuelto por el hook.

---

## Fase 6 — Vinculación actividad ↔ tarea y anulación por rechazo

- Al finalizar una actividad (`PATCH /api/admin/activity/:id/finish`), si el formulario fue abierto desde una tarea asignada, incluir `taskId` en el body para enlazar la fila de `catalog_activity_log`.
- Al rechazar una tarea (Fase 3): marcar `voidedByRejection = true` en todas las filas de `catalog_activity_log` con ese `taskId`, sin borrarlas (quedan visibles en el historial de actividad, pero excluidas del cálculo — Fase 2 ya las filtra).

---

## Fase 7 — Panel de pagos

- `/admin/pagos` (Admin, visible solo si `payment_module_enabled = true`):
  - Gestión de tiers y tarifas (`productivity_rate_tiers`, `productivity_rates`) — grid por componente con toggle enabled/disabled y monto.
  - Asignar tier y `requiresAssignedTaskForPayment` por usuario (extiende el formulario de `/admin/usuarios` o vista dedicada).
  - Gestión de períodos: crear período (fecha inicio/fin elegidas por Admin), ver desglose calculado por Gestor, aplicar ajuste manual (monto + motivo obligatorio), botón "Recalcular período" (solo `OPEN`), botón "Cerrar período" (`OPEN → CLOSED`), botón "Marcar como pagado" (`CLOSED → PAID`).
  - Vista del Gestor (solo lectura, solo sus propios períodos): desglose de su cálculo, sin ver tarifas de otros usuarios ni de otros tiers.
  - Interruptor maestro en `/admin/configuracion`: `payment_module_enabled`, apagado por defecto.

---

## Fase 8 — Notificaciones

- Badge/contador en sidebar y bottom nav para tareas y comentarios sin leer (`catalog_notifications.readAt IS NULL`), consumido vía `usePermissions()`-like hook liviano.
- Correo Resend (reutilizando helper existente) disparado únicamente en `TASK_ASSIGNED` y `TASK_REJECTED`.

---

## Fase 9 — Permisos y navegación

- Alta de módulos `tareas`, `comentarios`, `pagos` en la matriz `/admin/permisos` (ya CRUD-eable desde la Fase 4 del plan RBAC, no requiere nueva pantalla).
- `AdminSidebar`/`AdminBottomNav`: nuevos ítems condicionados a permiso de módulo **y**, en el caso de `pagos`, adicionalmente al interruptor maestro.

---

## Riesgos y advertencias

- El diff de campos (`changedFields`) requiere capturar un snapshot del estado del formulario al abrir, no solo al guardar — si el hook actual no lo hace, es una extensión no trivial de `useActivityTracking`, revisar en Fase 0 punto 2 antes de estimar esfuerzo.
- La detección de abandono por umbral de inactividad es heurística (no hay evento explícito de "cerré la pestaña sin guardar" confiable en todos los navegadores) — documentar esta limitación en el propio panel de productividad para que el Admin no la lea como un dato 100% preciso.
- Anular ítems por rechazo de tarea solo tiene efecto si la actividad quedó enlazada con `taskId` (Fase 6) — actividad de ítems creados **sin** tarea asignada nunca se anula por este mecanismo (es el comportamiento esperado dado el modo híbrido, pero conviene dejarlo explícito en la UI del rechazo).
- Un período `PAID` es inmutable por diseño (no admite recálculo ni ajustes) — si se necesita corregir un pago ya marcado como pagado, la única vía prevista es un ajuste manual en un período nuevo, no reabrir el anterior. Confirmar que esto es aceptable antes de construir Fase 7.
- El interruptor maestro apagado debe bloquear también los endpoints de API (no solo ocultar la navegación), para que nadie con acceso directo a la URL pueda leer/escribir montos con el módulo "desactivado".

---

## Autorrevisión frente a las decisiones de Gustavo

- Pago híbrido con flag por usuario — ✅ (decisión 1, Fase 2/7).
- Comentarios en dos hilos independientes, componente único sin duplicación — ✅ (decisión 2, Fase 4).
- Ciclo de vida de tarea con rechazo y motivo — ✅ (decisión 3, Fase 3).
- Tareas tipadas y genéricas conviviendo — ✅ (decisión 4, Fase 3).
- Tarifas por tier (no global, no por usuario individual) — ✅ (decisión 5, Fase 1/2).
- Los cinco componentes de fórmula, todos togglables — ✅ (decisión 6, Fase 1/2).
- Ítem cuenta al guardar, se anula si la tarea se rechaza — ✅ (decisión 7, Fase 6).
- Panel de pagos con historial + marcar pagado + ajustes manuales — ✅ (decisión 8, Fase 7).
- Recálculo manual explícito, nunca automático — ✅ (decisión 9, Fase 2/7).
- Interruptor maestro apagado por defecto — ✅ (decisión 10, Fase 1/7/9).
- Notificación por correo solo en eventos críticos, resto badge — ✅ (decisión 11, Fase 8).
- Actividad detallada: diff de campos + abandono + conteo de medios, sumado a lo ya existente — ✅ (decisión 12, Fase 5).

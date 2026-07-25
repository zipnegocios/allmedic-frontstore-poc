# Plan — Sistema de Gestión de Usuarios y RBAC (Roles: Admin, Ventas, Gestor del Catálogo + cimientos de Despachador/Marketing)

## Contexto y alcance

Hoy `users.role` es texto libre con dos valores en uso real: `ADMIN` y `CATALOG_MANAGER`, validados de forma binaria en `src/proxy.ts` y `requireAdmin()` (`src/lib/admin-auth.ts`). No existe pantalla de gestión de usuarios, ni tabla de permisos, ni registro de actividad.

Este plan agrega dos roles operativos nuevos (**Ventas** y **Gestor del Catálogo** ya existe pero gana un módulo de productividad), dos roles fundacionales sin funcionalidad (**Despachador**, y espacio reservado para **Marketing**), y construye el motor de permisos que sostiene todo lo anterior.

**Dentro de alcance:**
- Roles `ADMIN`, `SALES`, `CATALOG_MANAGER`, `DISPATCHER` como `pgEnum` real.
- Motor de permisos granular (`módulo:acción`) respaldado por tabla en BD, editable desde UI.
- Pantalla CRUD de usuarios (Admin).
- Pantalla CRUD de matriz de permisos (Admin).
- Rol Ventas: cotizaciones + cuentas corporativas con scope `OWN`/`ALL` configurable por usuario; catálogo de productos/sets en modo lectura.
- Rol Gestor del Catálogo: productos, sets, biblioteca de medios (ya existente) + visor de productividad con conteo de ítems, tiempo promedio de instalación/edición y semáforo de cumplimiento contra una meta configurable por usuario.
- Navegación (sidebar/bottom nav) filtrada según permisos reales del usuario.
- Dos páginas de visión futura, solo para Admin, describiendo (sin implementar) los módulos de Despachador y Marketing.

**Fuera de alcance (explícito):**
- Funcionalidad operativa real de Despachador (estados de pedido, picking/packing, tracking, etiquetas).
- Módulo de Marketing funcional (panel omnicanal, integraciones WhatsApp/IG/FB/TikTok, sincronización de catálogos externos con Meta/Google/MercadoLibre).
- Cualquier acceso de escritura a `/admin/usuarios` o `/admin/permisos` fuera del rol Admin.

---

## Decisiones arquitectónicas cerradas (no reabrir sin autorización explícita)

1. **`role` como `pgEnum` real** en Postgres: `ADMIN | SALES | CATALOG_MANAGER | DISPATCHER`. Migración con `USING role::text::user_role`. Se deja espacio para agregar `MARKETING` a futuro (nota de riesgo abajo).
2. **Permisos en tabla de BD**, granularidad **módulo + acción** (ej. `catalogo:read`, `catalogo:write`, `cotizaciones:read`, `cotizaciones:write`), no por módulo completo.
3. **Evaluación híbrida en 2 capas (defensa en profundidad):**
   - **Capa Middleware/Guard:** valida el permiso `módulo:acción` desde una caché en memoria con *tag de versión* (`permissions_version`), sin tocar la BD en cada request. Si la versión cambió, refresca la caché — así un cambio de permisos aplica sin exigir relogin.
   - **Capa de Servicio/ORM:** aplica el *scope* granular del dato (`OWN` vs `ALL`) y reglas transaccionales (ej. inyectar `WHERE sales_agent_id = user.id`, bloquear ediciones si la cotización ya está `Despachado`/`Cerrado`).
4. **Scope de Ventas:** flag por usuario `scopeLevel: OWN | ALL`, configurable solo por Admin. `OWN` = solo sus propias cotizaciones/cuentas asignadas; `ALL` = ve todas, pero solo edita las propias (regla de negocio en capa de servicio).
5. **Productividad del Gestor del Catálogo — qué cuenta como producción:**
   - Creación de producto (nuevo style code)
   - Creación/edición de variante (color/talla)
   - Armado o edición de set corporativo
   - Subida y vinculación de medios en la biblioteca
   - **Tiempo promedio de instalación** (creación) y **tiempo promedio de edición** (ajustes) de productos y sets
6. **Medición de tiempo:** evento explícito de **inicio** (al abrir el formulario) y **fin** (al guardar exitosamente) — instrumentado en frontend, no inferido por proxy entre eventos consecutivos.
7. **Meta de productividad:** configurable **por usuario** (no una meta global única), editable solo por Admin.
8. **Contraseña de usuarios nuevos:** Admin asigna una contraseña temporal al crear la cuenta; el usuario está obligado a cambiarla en su primer login (`must_change_password`).
9. **Rol Despachador en esta fase:** solo el valor del enum + una página de visión (solo Admin) que describe el flujo futuro, sin ninguna funcionalidad operativa. Un usuario con este rol no tiene módulos activos todavía.
10. **Páginas de visión futura:** dos páginas separadas (`/admin/vision-despacho` y `/admin/vision-marketing`), no una sola vista combinada.
11. **Navegación:** los módulos sin permiso se **ocultan por completo** del sidebar y del bottom nav (no se muestran deshabilitados).
12. **Matriz de permisos editable desde UI** en esta misma fase (no queda solo como seed fijo): pantalla CRUD para Admin en `/admin/permisos`.

---

## Fase 0 — Auditoría obligatoria (sin tocar código)

1. Confirmar en `src/db/schema/` si `quote_requests` (o el nombre real de la tabla de cotizaciones) y `corporate_accounts` ya tienen una columna de asesor asignado (`sales_agent_id` / `assigned_to`). Si no existe, se agrega en Fase 1 y se define el default/backfill para registros históricos (¿quedan sin asesor = visibles solo para `ALL` y Admin?).
2. Inventariar **todos** los módulos actuales de `AdminSidebar` y `AdminBottomNav` (cotizaciones, cuentas-corporativas, productos, sets, biblioteca, marcas, colores, reglas, banners, configuración, papelera, prospectos, corporate-carts, quote-config, dashboard) y mapear cada uno a su(s) permiso(s) `módulo:acción` necesarios.
3. Listar todos los usos actuales de `requireAdmin()` y del chequeo `role !== 'CATALOG_MANAGER' && role !== 'ADMIN'` en `src/proxy.ts` y en rutas API, para planificar su reemplazo gradual por `requireRole(...)`.
4. Confirmar el mecanismo de sesión JWT actual (`maxAge`, estrategia) en `src/lib/auth-config.ts`/`auth.ts` para diseñar el versionado de permisos sin invalidar sesiones.
5. Confirmar si existen formularios reutilizables de producto/variante/set/medio que permitan instrumentar un único hook de tracking (`useActivityTracking`) sin duplicar lógica entre mobile/desktop (recordando la restricción de no duplicar componentes).

Si algún hallazgo contradice las decisiones cerradas arriba, **detener y reportar** antes de continuar.

### Resultado de la auditoría (ejecutada 2026-07-25)

1. **Asesor asignado**: confirmado que NO existe `sales_agent_id`/`assigned_to`/similar en `quotes` (`src/db/schema/corporate.ts`) ni en `corporateAccounts`. Los únicos campos referenciando `user` son `createdBy` (quote, auditoría puntual) y `approvedBy` (corporate account, auditoría puntual) — ninguno sirve como ownership continuo. Se agrega `sales_agent_id` en Fase 1.
2. **Inventario de navegación**: `AdminSidebar` tiene 16 ítems, `AdminBottomNav` tiene 4 (`primaryItems`) + 12 (`moreItems`). Ninguno tiene lógica condicional de rol hoy. Hallazgo adicional: `quote-config` y `corporate-carts` tienen endpoints API activos pero **sin entrada de menú** — deben mapearse a permisos igual en Fase 0/1 aunque no tengan ítem visual hoy.
3. **Gate binario**: exactamente 3 copias independientes del mismo chequeo `role !== 'CATALOG_MANAGER' && role !== 'ADMIN'` — `src/proxy.ts:22`, `src/lib/auth-config.ts:45`, `src/lib/admin-auth.ts:23`. `requireAdmin()` se usa 117 veces en 67 archivos, prácticamente todas las rutas bajo `src/app/api/admin/**`.
4. **Sesión JWT**: `strategy: 'jwt'`, `maxAge: 30 días`. El token solo lleva `sub` y `role` (string plano). **Importante**: la caché versionada (`permissions_version`) resuelve cambios de permisos *por rol* en caliente, pero NO resuelve un cambio de *rol asignado a un usuario específico* ni una desactivación (`is_active = false`) mientras su JWT siga vivo — ver decisión 13 abajo, que amplía el alcance original de Fase 1/2 para cubrir esto.
5. **Formularios reutilizables**: `ProductForm.tsx` y `SetForm.tsx` son componentes únicos sin duplicación mobile/desktop (variantes embebidas en `VariantsMediaSection.tsx`, sin componente propio). Biblioteca de medios usa varios componentes sin un "form" central. Cero instrumentación de tracking/analytics existente en ninguno — el hook `useActivityTracking` de Fase 7 se inserta limpio.

Ningún hallazgo contradice las decisiones cerradas originales. Se abrieron 4 decisiones nuevas, resueltas con Gustavo el 2026-07-25 (ver sección siguiente).

### Hallazgo adicional durante ejecución de Fase 1 (2026-07-25)

Al aplicar la migración se descubrió un **tercer rol en uso real no detectado en la auditoría de Fase 0**: `CORPORATE_CLIENT`, usado por `POST /api/corporate/register` para clientes corporativos que se autoregistran desde el portal público (`/corporativo/registro`). Este rol vive en la misma tabla `users` y usa el mismo `Credentials` provider de NextAuth que los roles administrativos — no existe separación de tablas de identidad. La conversión de `role` a enum falló contra este valor.

**Decisión (Gustavo, 2026-07-25):** se amplía el enum `user_role` a `ADMIN | SALES | CATALOG_MANAGER | DISPATCHER | CORPORATE_CLIENT`, sin rediseñar la arquitectura de autenticación. `CORPORATE_CLIENT` no participa del motor de permisos RBAC de este plan (nunca se le concede ningún módulo admin, igual que hoy). Separar clientes corporativos en una tabla de identidad propia queda fuera de alcance — es un rediseño de auth mayor, no planteado originalmente.

### Decisiones nuevas (post-auditoría, cerradas 2026-07-25)

13. **Backfill de `sales_agent_id`**: los registros históricos de `quotes`/`corporateAccounts` sin asesor se asignan por defecto al usuario Admin `zipnegocios@gmail.com` (super admin, ver decisión 15). No quedan en `NULL`.
14. **Invalidación de sesión al cambiar rol/estado**: se amplía el alcance de Fase 1/2 — no basta con `permissions_version` (que ya cubre cambios de permisos *por rol*). Se agrega un mecanismo de invalidación casi inmediata para cambios que afectan a un **usuario específico** (cambio de `role`, o `is_active = false`): columna `session_version` (entero) en `users`, incrementada en cada cambio de rol/activación vía el CRUD de Fase 3. El JWT lleva `sessionVersion` al momento del login; el guard de middleware/servicio compara contra el valor actual en BD (a través de la misma caché versionada, no consulta en cada request) y fuerza cierre de sesión si no coincide.
15. **Super administradores protegidos**: se crean (si no existen) dos usuarios `ADMIN` con protección total: `zipnegocios@gmail.com` y `allmedicuniforms@gmail.com`. Nueva columna `is_protected` (`boolean`, default `false`) en `users`, `true` solo para estos dos por email en el seed de Fase 1. Estas cuentas **no pueden eliminarse, desactivarse ni cambiar de rol** desde la UI ni desde la API — el bloqueo se implementa en la capa de servicio (Fase 2/3), no solo deshabilitando el botón en UI. Ningún otro Admin, ni siquiera otro super admin, puede modificar estos campos para estas dos cuentas.
16. **Creación de los super admins en Fase 1**: el seed verifica por email si `zipnegocios@gmail.com` / `allmedicuniforms@gmail.com` existen; si no, los crea con `role = 'ADMIN'`, `is_protected = true`, contraseña temporal y `must_change_password = true` (mismo mecanismo de Fase 3 para altas de usuario). Si ya existen, solo se marca `is_protected = true` sin tocar el resto de sus datos.

---

## Fase 1 — Schema y migración base (Drizzle)

- `pgEnum user_role`: `ADMIN`, `SALES`, `CATALOG_MANAGER`, `DISPATCHER`.
- Migrar `users.role` de `text` a `user_role` (`USING role::text::user_role`), default `CATALOG_MANAGER` se mantiene para no romper seeds existentes.
- Nuevas columnas en `users`:
  - `scope_level` (`text` u otro `pgEnum`: `OWN | ALL`, default `OWN`; solo aplica cuando `role = SALES`)
  - `is_active` (`boolean`, default `true`)
  - `must_change_password` (`boolean`, default `true`)
  - `is_protected` (`boolean`, default `false`) — `true` solo para los super admins de decisión 15; bloquea eliminación/desactivación/cambio de rol en capa de servicio.
  - `session_version` (`integer`, default `0`) — se incrementa al cambiar `role` o `is_active` de ese usuario; el JWT lleva el valor vigente al login y se compara vía la caché versionada para forzar cierre de sesión casi inmediato (decisión 14).
- Tabla `productivity_targets`: `user_id` (FK único a `users`), `daily_target` (`integer`, default `25`).
- Tabla `permissions`: catálogo maestro — `module` (`text`), `action` (`text`), único por `(module, action)`.
- Tabla `role_permissions`: `role` (`user_role`), `permission_id` (FK a `permissions`), único por `(role, permission_id)`. La presencia de una fila = permiso concedido; su ausencia = denegado.
- Tabla singleton `permissions_version`: `version` (`integer`, se incrementa en cada cambio de `role_permissions`) — usada para invalidar la caché de middleware sin relogin.
- Tabla `catalog_activity_log`: `id`, `user_id` (FK), `entity_type` (enum `PRODUCT | VARIANT | SET | MEDIA`), `entity_id`, `action` (enum `CREATE | UPDATE`), `started_at`, `finished_at` (nullable hasta completar), `duration_seconds` (calculado al finalizar), `created_at`.
- Agregar `sales_agent_id` (FK nullable a `users`) a `quotes` y `corporateAccounts` (confirmado ausente en Fase 0). Backfill: registros existentes → `sales_agent_id = id de zipnegocios@gmail.com` (decisión 13).
- **Seeds (idempotentes):**
  - Catálogo completo de `permissions` según el inventario de Fase 0 (incluir `quote-config` y `corporate-carts`, sin ítem de menú hoy pero con endpoints activos).
  - `role_permissions` iniciales:
    - `ADMIN`: todos los permisos (o bypass total en código, ver Fase 2).
    - `SALES`: `cotizaciones:read`, `cotizaciones:write`, `cuentas-corporativas:read`, `cuentas-corporativas:write`, `catalogo:read`, `dashboard:read`.
    - `CATALOG_MANAGER`: `productos:read`, `productos:write`, `sets:read`, `sets:write`, `biblioteca:read`, `biblioteca:write`, `productividad:read` (solo propia).
    - `DISPATCHER`: sin filas (sin módulos activos aún).
  - `productivity_targets` con `daily_target = 25` para los Gestores del Catálogo existentes.
  - Super admins protegidos (decisión 15/16): verificar por email `zipnegocios@gmail.com` y `allmedicuniforms@gmail.com`; crear si faltan (`role = 'ADMIN'`, `is_protected = true`, contraseña temporal, `must_change_password = true`); si ya existen, solo marcar `is_protected = true`.

---

## Fase 2 — Motor de permisos (capa de servicio)

- `src/lib/permissions/` (módulo puro, sin acoplarse a componentes de UI):
  - `getPermissionsForRole(role)`: lee de caché en memoria; si `permissions_version` cambió desde la última carga, refresca desde BD.
  - `requireRole(session, module, action)`: helper para API routes y Server Components. Reemplaza gradualmente a `requireAdmin()`.
  - Mantener `requireAdmin()` como alias de `requireRole(session, '*', '*')` para `role === 'ADMIN'` (bypass total), marcado como deprecated en comentario, para no romper las rutas que aún no se migren en este plan.
- `src/proxy.ts`: reemplazar el chequeo binario actual por `requireRole` contra el mapa ruta→`módulo:acción` construido en Fase 0. Rechazo inmediato con 403 (API) o redirect (páginas) sin consultar BD en cada request (usa la caché versionada).
- Capa de servicio (`admin-data-service.ts` u homólogos): para `SALES` con `scopeLevel = OWN`, inyectar `WHERE sales_agent_id = user.id` en las queries de cotizaciones y cuentas corporativas. Para `ALL`, sin filtro de lectura, pero bloquear `UPDATE`/`DELETE` si `sales_agent_id !== user.id` (regla de negocio, no de UI).

---

## Fase 3 — Gestión de usuarios (CRUD, solo Admin)

- `/admin/usuarios`: listado con nombre, email, rol, estado (activo/inactivo), `scopeLevel` (solo si `SALES`).
- Crear usuario: nombre, email, rol (`ADMIN | SALES | CATALOG_MANAGER | DISPATCHER`), `scopeLevel` (solo si `SALES`), contraseña temporal (autogenerada o ingresada por Admin) → `must_change_password = true`.
- Si el rol seleccionado es `DISPATCHER`, mostrar aviso en el formulario: "Este rol aún no tiene módulos activos en el sistema."
- Editar usuario: cambiar rol, `scopeLevel`, activar/desactivar (soft, vía `is_active`), resetear contraseña (genera nueva temporal y vuelve a exigir cambio).
- Pantalla obligatoria de cambio de contraseña en primer login: middleware redirige a esta pantalla si `must_change_password = true` y la ruta actual no es esa misma pantalla.
- Login bloqueado (mensaje claro, sin filtrar detalles) si `is_active = false`.

---

## Fase 4 — Matriz de permisos (CRUD, solo Admin)

- `/admin/permisos`: grid rol × módulo con checkboxes por acción (`read`/`write`).
- Guardar hace upsert/delete sobre `role_permissions` y **incrementa `permissions_version`** al final de la transacción.
- Mensaje en UI aclarando que los cambios aplican de inmediato a los usuarios afectados sin necesidad de que vuelvan a iniciar sesión.
- `ADMIN` no aparece como fila editable (bypass total, no se debe poder auto-restringir por error).

---

## Fase 5 — Navegación filtrada por permisos

- Hook `usePermissions()` (cliente) que consume los permisos efectivos de la sesión actual (endpoint liviano cacheado, invalidado por la misma versión).
- `AdminSidebar` y `AdminBottomNav` ocultan por completo cualquier ítem cuyo `módulo:read` no esté concedido.
- Ajustar el dashboard `/admin` para que cada rol vea widgets relevantes: Admin ve todo, Ventas ve resumen de sus cotizaciones (respetando scope), Gestor del Catálogo ve su semáforo de productividad.

---

## Fase 6 — Rol Ventas: catálogo en modo lectura + scope en cotizaciones

- Confirmar/adaptar la vista de catálogo de productos y sets para Ventas: sin botones de edición/eliminación, sin acceso a biblioteca, motor de reglas ni configuración (bloqueo ya reforzado por Fase 2, esto es la capa visual).
- Cotizaciones y cuentas corporativas: aplicar el scope `OWN`/`ALL` en listados y en el detalle; los formularios de creación siguen usando el módulo existente heredado (constructor de propuestas, envío, seguimiento).

---

## Fase 7 — Gestor del Catálogo: registro de actividad y tiempos

- Instrumentar frontend con hook único `useActivityTracking(entityType, entityId?)`:
  - Al abrir el formulario (crear o editar): `POST /api/admin/activity/start` → crea fila en `catalog_activity_log` con `started_at`, retorna `activityId`.
  - Al guardar exitosamente: el submit incluye `activityId` → `PATCH /api/admin/activity/:id/finish` completa `finished_at` y calcula `duration_seconds`.
- Aplicar el hook en los formularios de producto, variante, set y en la subida/vinculación de medios en la biblioteca — un solo hook reutilizable, sin duplicar lógica entre mobile/desktop.

---

## Fase 8 — Visor de productividad y semáforo de cumplimiento

- `/admin/productividad`: filtros Día/Semana/Mes.
- Métricas: ítems procesados por tipo (producto/variante/set/medio), tiempo promedio de instalación, tiempo promedio de edición.
- Comparación contra `productivity_targets.daily_target` del usuario (prorrateado para semana/mes) → semáforo verde/amarillo/rojo con porcentaje de cumplimiento.
- Acceso: el propio Gestor ve solo sus datos; Admin ve el listado de todos los Gestores.

---

## Fase 9 — Páginas de visión futura (sin funcionalidad)

- `/admin/vision-despacho` (solo Admin): descripción del flujo futuro — recepción de ventas cerradas, hoja de ruta de solo lectura, estados operativos (En Preparación → Picking/Packing → Listo para Despacho → Despachado → Entregado), integración logística (etiquetas, tracking, notificaciones). Página puramente descriptiva, sin acciones reales.
- `/admin/vision-marketing` (solo Admin): descripción del panel de comunicaciones omnicanal (WhatsApp, Instagram, Facebook, TikTok, correo), social selling (acción rápida de cotización desde el chat, tarjetas de producto), y sincronización de catálogos externos (Meta Commerce Manager, Google Merchant Center, WhatsApp Business Catalog, MercadoLibre Ecuador opcional).
- Ambas páginas quedan fuera del sidebar/bottom nav estándar (acceso directo por URL o desde una sección "Roadmap" visible solo para Admin) para no confundir a otros roles con módulos inexistentes.

---

## Riesgos y advertencias

- **`ALTER TYPE ... ADD VALUE` en Postgres** no puede ejecutarse dentro de la misma transacción que otros cambios de esquema en algunas versiones. Cuando se active `MARKETING` como rol real a futuro, esa migración debe ir sola.
- Si Fase 0 confirma que las cotizaciones/cuentas corporativas no tienen asesor asignado históricamente, se necesita una decisión explícita sobre el backfill (¿asignar a un usuario por defecto? ¿dejar nulo y tratarlo como visible solo en scope `ALL`?) — no asumir, reportar y esperar decisión de Gustavo antes de aplicar la migración de datos.
- Instrumentar el evento de "inicio" en los formularios acopla lógica de analítica a componentes de negocio; mitigado con el hook único `useActivityTracking`, pero cualquier formulario nuevo de producto/set/medio debe adoptarlo explícitamente o quedará fuera del conteo de productividad.
- Mantener `requireAdmin()` como wrapper evita romper rutas no migradas en este plan, pero dejará dos mecanismos de auth conviviendo temporalmente — documentar cuáles rutas quedan pendientes de migrar a `requireRole()` para una fase de limpieza posterior.
- Un usuario creado con rol `DISPATCHER` no verá ningún módulo (sidebar vacío salvo lo genérico); confirmar que esto es aceptable como comportamiento temporal antes de habilitar la creación de ese rol en producción.

---

## Autorrevisión frente a los requisitos de Gustavo

- Admin: sin cambios, sigue con bypass total — ✅.
- Ventas: hereda cotizaciones + cuentas corporativas, catálogo en modo lectura, sin acceso a biblioteca/motor de reglas/configuración — ✅ (Fases 2, 6).
- Gestor del Catálogo: productos, sets, biblioteca + visor de productividad con conteo por día/semana/mes, tiempos promedio y semáforo contra meta configurable — ✅ (Fases 7, 8).
- Despachador: fuera de alcance funcional, cimiento (enum) + página de visión — ✅ (Fase 9).
- Marketing: fuera de alcance funcional, página de visión separada — ✅ (Fase 9).
- Desarrollo "mínimo pero con cimientos": motor de permisos completo y editable desde ahora (no placeholder), pero sin construir ninguna pieza operativa de Despachador/Marketing — ✅.

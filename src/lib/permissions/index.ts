/**
 * Motor de permisos RBAC (Fase 2 del plan 2026-07-25-rbac-gestion-usuarios).
 *
 * Capa de servicio pura: resuelve qué `módulo:acción` tiene concedido cada rol,
 * con una caché en memoria invalidada por `permissions_version` (sin tocar la BD
 * en cada request — solo se relee cuando la versión cambia, ver decisión 3 del plan).
 */
import { db } from '@/db';
import { permissions, rolePermissions, permissionsVersion, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type UserRole = 'ADMIN' | 'SALES' | 'CATALOG_MANAGER' | 'DISPATCHER' | 'CORPORATE_CLIENT';
export type PermissionAction = 'read' | 'write';

interface SessionUser {
  id?: string;
  role?: string;
}

interface PermissionsCache {
  version: number;
  /** role -> Set de "modulo:accion" concedidos */
  byRole: Map<string, Set<string>>;
}

let cache: PermissionsCache | null = null;

async function getCurrentVersion(): Promise<number> {
  const [row] = await db.select().from(permissionsVersion).limit(1);
  return row?.version ?? 1;
}

async function loadPermissionsFromDb(): Promise<Map<string, Set<string>>> {
  const rows = await db
    .select({ role: rolePermissions.role, module: permissions.module, action: permissions.action })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id));

  const byRole = new Map<string, Set<string>>();
  for (const row of rows) {
    let set = byRole.get(row.role);
    if (!set) {
      set = new Set();
      byRole.set(row.role, set);
    }
    set.add(`${row.module}:${row.action}`);
  }
  return byRole;
}

/**
 * Permisos efectivos de un rol — `ADMIN` siempre tiene bypass total (ver decisión 3/Fase 2
 * del plan), no depende de `role_permissions`. Para el resto, lee de caché en memoria;
 * si `permissions_version` cambió desde la última carga, refresca desde BD.
 */
export async function getPermissionsForRole(role: string): Promise<Set<string>> {
  if (role === 'ADMIN') return ALL_ACCESS;

  const currentVersion = await getCurrentVersion();
  if (!cache || cache.version !== currentVersion) {
    cache = { version: currentVersion, byRole: await loadPermissionsFromDb() };
  }
  return cache.byRole.get(role) ?? new Set();
}

/** Sentinel: nunca se compara literalmente, `hasPermission` trata ADMIN como bypass total. */
const ALL_ACCESS = new Set<string>(['*:*']);

export async function hasPermission(role: string, module: string, action: PermissionAction): Promise<boolean> {
  if (role === 'ADMIN') return true;
  const granted = await getPermissionsForRole(role);
  return granted.has(`${module}:${action}`);
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'ForbiddenError';
  }
}

/**
 * Helper para API routes y Server Components. Verifica sesión + permiso `módulo:acción`.
 * Lanza `Error('Unauthorized')`/`Error('Forbidden')` — mismo contrato que `requireAdmin()`
 * (nunca llama `redirect()`, el caller decide qué hacer con cada error).
 */
export async function requireRole(
  session: { user?: SessionUser | null } | null,
  module: string,
  action: PermissionAction
) {
  if (!session?.user) {
    throw new UnauthorizedError();
  }
  const role = session.user.role;
  if (!role) {
    throw new ForbiddenError();
  }
  const allowed = await hasPermission(role, module, action);
  if (!allowed) {
    throw new ForbiddenError();
  }
  return session;
}

/**
 * Fuerza la relectura de `permissions_version` en la próxima llamada — usado tras un cambio
 * de `role_permissions` (Fase 4, matriz de permisos) para no esperar el TTL implícito de caché.
 * No es estrictamente necesario (la comparación de versión ya lo detecta), pero deja explícito
 * el punto de invalidación para quien edite la matriz.
 */
export function invalidatePermissionsCache() {
  cache = null;
}

/**
 * Verifica que el usuario de la sesión siga activo y que su `sessionVersion` coincida con el
 * valor vigente en BD — cubre cambios de `role`/`is_active` de un usuario específico (decisión
 * 14 del plan), que `permissions_version` NO cubre (esa solo versiona permisos por rol).
 */
export async function isSessionStillValid(userId: string, sessionVersion: number): Promise<boolean> {
  const [user] = await db
    .select({ isActive: users.isActive, sessionVersion: users.sessionVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return false;
  if (!user.isActive) return false;
  if (user.sessionVersion !== sessionVersion) return false;
  return true;
}

/** Mapa ruta (`/admin/...` o `/api/admin/...`) → módulo, usado por `proxy.ts` y por los guards
 * de rutas API. Calcado del inventario de Fase 0 (AdminSidebar/AdminBottomNav) + quote-config/
 * corporate-carts (endpoints activos sin ítem de menú). */
export const ROUTE_MODULE_MAP: Array<{ prefix: string; module: string }> = [
  { prefix: '/admin/usuarios', module: 'usuarios' },
  { prefix: '/admin/permisos', module: 'permisos' },
  { prefix: '/admin/productividad', module: 'productividad' },
  { prefix: '/admin/productos', module: 'productos' },
  { prefix: '/admin/biblioteca', module: 'biblioteca' },
  { prefix: '/admin/prospectos', module: 'prospectos' },
  { prefix: '/admin/banners', module: 'banners' },
  { prefix: '/admin/marcas', module: 'marcas' },
  { prefix: '/admin/tipos-producto', module: 'tipos-producto' },
  { prefix: '/admin/atributos', module: 'atributos' },
  { prefix: '/admin/colores', module: 'colores' },
  { prefix: '/admin/sucursales', module: 'sucursales' },
  { prefix: '/admin/sets', module: 'sets' },
  { prefix: '/admin/cuentas-corporativas', module: 'cuentas-corporativas' },
  { prefix: '/admin/cotizaciones', module: 'cotizaciones' },
  { prefix: '/admin/reglas', module: 'reglas' },
  { prefix: '/admin/papelera', module: 'papelera' },
  { prefix: '/admin/configuracion', module: 'configuracion' },
  { prefix: '/admin/vision-despacho', module: '*' }, // solo ADMIN (Fase 9, ver plan)
  { prefix: '/admin/vision-marketing', module: '*' }, // solo ADMIN (Fase 9, ver plan)
  { prefix: '/api/admin/attribute-values', module: 'atributos' },
  { prefix: '/api/admin/attributes', module: 'atributos' },
  { prefix: '/api/admin/sizes', module: 'atributos' },
  { prefix: '/api/admin/banners', module: 'banners' },
  { prefix: '/api/admin/brands', module: 'marcas' },
  { prefix: '/api/admin/collections', module: 'marcas' },
  { prefix: '/api/admin/colors', module: 'colores' },
  { prefix: '/api/admin/corporate-accounts', module: 'cuentas-corporativas' },
  { prefix: '/api/admin/leads', module: 'prospectos' },
  { prefix: '/api/admin/media', module: 'biblioteca' },
  { prefix: '/api/admin/product-types', module: 'tipos-producto' },
  { prefix: '/api/admin/products', module: 'productos' },
  { prefix: '/api/admin/quote-config', module: 'quote-config' },
  { prefix: '/api/admin/quotes', module: 'cotizaciones' },
  { prefix: '/api/admin/rules', module: 'reglas' },
  { prefix: '/api/admin/sets', module: 'sets' },
  { prefix: '/api/admin/stores', module: 'sucursales' },
  { prefix: '/api/admin/trash', module: 'papelera' },
  { prefix: '/api/admin/activity', module: 'productividad' },
  { prefix: '/api/admin/users', module: 'usuarios' },
  { prefix: '/api/admin/permissions', module: 'permisos' },
];

export function resolveModuleForPath(pathname: string): string | null {
  // Más largo primero: evita que un prefijo corto (ej. /admin/sets) capture
  // por error una ruta más específica que debería mapear a otro módulo.
  const sorted = [...ROUTE_MODULE_MAP].sort((a, b) => b.prefix.length - a.prefix.length);
  const match = sorted.find((entry) => pathname.startsWith(entry.prefix));
  return match?.module ?? null;
}

// ─── Scope de datos para rol SALES (decisión 4 del plan) ───
//
// `OWN`  = el usuario solo lee/edita sus propias cotizaciones/cuentas asignadas
//          (`sales_agent_id = user.id`).
// `ALL`  = el usuario lee todas, pero solo puede editar/eliminar las propias — el
//          filtro de lectura NO aplica, pero sí el guard de escritura.
// Roles distintos de SALES no tienen scope (ven/editan según su propio permiso de
// módulo, sin relación con `sales_agent_id`).

export interface ScopeContext {
  userId: string;
  role: string;
  scopeLevel: 'OWN' | 'ALL';
}

/**
 * Construye el `ScopeContext` de un usuario a partir de su id — el JWT de sesión solo
 * lleva `role` (ver `auth-config.ts`), así que `scopeLevel` se resuelve consultando
 * `users` directamente. Devuelve `null` si el usuario no existe (sesión obsoleta).
 */
export async function getScopeContext(userId: string): Promise<ScopeContext | null> {
  const [user] = await db
    .select({ role: users.role, scopeLevel: users.scopeLevel })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;
  return { userId, role: user.role, scopeLevel: user.scopeLevel };
}

/**
 * Devuelve el `sales_agent_id` por el que debe filtrarse una lectura (`listQuotes`,
 * `getAdminCorporateAccounts`), o `null` si no debe filtrarse (todo otro rol, o
 * SALES con `scopeLevel = ALL`).
 */
export function resolveReadScopeFilter(ctx: ScopeContext): string | null {
  if (ctx.role !== 'SALES') return null;
  return ctx.scopeLevel === 'OWN' ? ctx.userId : null;
}

export class OwnershipError extends Error {
  constructor() {
    super('Forbidden: no puedes modificar un registro asignado a otro asesor de ventas.');
    this.name = 'OwnershipError';
  }
}

/**
 * Verifica que un SALES pueda escribir sobre un registro con este `salesAgentId` —
 * aplica tanto en `OWN` como en `ALL` (la decisión 4 del plan es explícita: "ALL ve
 * todas, pero solo edita las propias"). Otros roles no están sujetos a esta regla
 * (su permiso de módulo ya decide si pueden escribir).
 */
export function assertCanWriteOwnedRecord(ctx: ScopeContext, recordSalesAgentId: string | null): void {
  if (ctx.role !== 'SALES') return;
  if (recordSalesAgentId !== ctx.userId) {
    throw new OwnershipError();
  }
}

// ─── Matriz de permisos editable (Fase 4 del plan) ───
//
// `ADMIN` nunca aparece como fila editable — tiene bypass total en código (ver
// `hasPermission`), no depende de `role_permissions`, así que no se puede auto-restringir
// por error (decisión de Fase 4).
export const EDITABLE_ROLES = ['SALES', 'CATALOG_MANAGER', 'DISPATCHER'] as const;
export type EditableRole = (typeof EDITABLE_ROLES)[number];

export interface PermissionsMatrix {
  modules: string[];
  /** grid[role][modulo] = { read, write } */
  grid: Record<EditableRole, Record<string, { read: boolean; write: boolean }>>;
}

/** Snapshot completo de la matriz — catálogo de módulos + qué tiene concedido cada rol
 * editable. Usado por `/admin/permisos` para pintar el grid inicial. */
export async function getPermissionsMatrix(): Promise<PermissionsMatrix> {
  const allPermissions = await db.select().from(permissions);
  const modules = Array.from(new Set(allPermissions.map((p) => p.module))).sort();

  const grantedRows = await db
    .select({ role: rolePermissions.role, module: permissions.module, action: permissions.action })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id));

  const grid = Object.fromEntries(
    EDITABLE_ROLES.map((role) => [
      role,
      Object.fromEntries(modules.map((module) => [module, { read: false, write: false }])),
    ])
  ) as PermissionsMatrix['grid'];

  for (const row of grantedRows) {
    if (!EDITABLE_ROLES.includes(row.role as EditableRole)) continue; // ignora ADMIN/CORPORATE_CLIENT si hubiera filas
    const cell = grid[row.role as EditableRole]?.[row.module];
    if (cell) cell[row.action as 'read' | 'write'] = true;
  }

  return { modules, grid };
}

/**
 * Reemplaza por completo los permisos de un rol editable con el set recibido, dentro de
 * una transacción, e incrementa `permissions_version` al final — los usuarios afectados
 * ven el cambio aplicado de inmediato (la caché versionada lo detecta en su próxima
 * request), sin necesidad de volver a iniciar sesión (decisión 3 del plan).
 */
export async function saveRolePermissions(
  role: EditableRole,
  grantedModuleActions: Array<{ module: string; action: PermissionAction }>
): Promise<void> {
  await db.transaction(async (tx) => {
    const allPermissions = await tx.select().from(permissions);
    const permissionIdByKey = new Map(allPermissions.map((p) => [`${p.module}:${p.action}`, p.id]));

    const wantedIds = new Set(
      grantedModuleActions
        .map((g) => permissionIdByKey.get(`${g.module}:${g.action}`))
        .filter((id): id is string => !!id)
    );

    const existing = await tx.select().from(rolePermissions).where(eq(rolePermissions.role, role));
    const existingIds = new Set(existing.map((r) => r.permissionId));

    const toInsert = [...wantedIds].filter((id) => !existingIds.has(id));
    const toDelete = existing.filter((r) => !wantedIds.has(r.permissionId));

    if (toInsert.length > 0) {
      await tx.insert(rolePermissions).values(toInsert.map((permissionId) => ({ role, permissionId })));
    }
    for (const row of toDelete) {
      await tx.delete(rolePermissions).where(eq(rolePermissions.id, row.id));
    }

    const [versionRow] = await tx.select().from(permissionsVersion).limit(1);
    if (versionRow) {
      await tx.update(permissionsVersion).set({ version: versionRow.version + 1 }).where(eq(permissionsVersion.id, versionRow.id));
    } else {
      await tx.insert(permissionsVersion).values({ version: 2 });
    }
  });

  invalidatePermissionsCache();
}

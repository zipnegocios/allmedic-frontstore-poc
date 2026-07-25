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

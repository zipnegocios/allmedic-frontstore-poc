import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

interface SessionUser {
  id?: string;
  role?: string;
}

/**
 * @deprecated Usar `requireRole(session, modulo, accion)` de `@/lib/permissions` en rutas
 * nuevas o al migrar una ruta existente (ver Fase 2 del plan RBAC — Riesgos y advertencias:
 * migración gradual pendiente, no se tocan las ~116 llamadas existentes en este plan).
 * Se mantiene como alias de acceso amplio (cualquier rol con al menos un módulo admin
 * concedido) únicamente para no romper las rutas que aún no se migren.
 * Lanza Error('Unauthorized') o Error('Forbidden') — NUNCA llama redirect() directamente,
 * para que funcione tanto en API Route Handlers (que capturan el error) como en
 * Server Components (el caller llama redirect() explícitamente si es necesario).
 */
export async function requireAdmin() {
  const session = await auth();

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const role = (session.user as SessionUser).role;
  if (role !== 'CATALOG_MANAGER' && role !== 'ADMIN' && role !== 'SALES' && role !== 'DISPATCHER') {
    throw new Error('Forbidden');
  }

  return session;
}

/**
 * Versión para Server Components / layouts de página.
 * Redirige al login si no hay sesión o no tiene rol admin.
 * NO usar en API Route Handlers (usar requireAdmin() allí).
 */
export async function requireAdminPage() {
  try {
    return await requireAdmin();
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    redirect(message === 'Forbidden' ? '/admin/login?error=forbidden' : '/admin/login');
  }
}

export function getSessionUserId(session: { user?: SessionUser | null } | null): string | undefined {
  return session?.user?.id;
}

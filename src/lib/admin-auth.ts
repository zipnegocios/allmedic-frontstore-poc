import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

interface SessionUser {
  id?: string;
  role?: string;
}

/**
 * Verifica que el usuario tenga sesión admin activa.
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
  if (role !== 'CATALOG_MANAGER' && role !== 'ADMIN') {
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

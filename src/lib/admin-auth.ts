import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

interface SessionUser {
  id?: string;
  role?: string;
}

export async function requireAdmin() {
  const session = await auth();

  if (!session?.user) {
    redirect('/admin/login');
  }

  const role = (session.user as SessionUser).role;
  if (role !== 'CATALOG_MANAGER' && role !== 'ADMIN') {
    redirect('/admin/login?error=forbidden');
  }

  return session;
}

export function getSessionUserId(session: { user?: SessionUser | null } | null): string | undefined {
  return session?.user?.id;
}

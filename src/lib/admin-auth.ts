import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function requireAdmin() {
  const session = await auth();

  if (!session?.user) {
    redirect('/admin/login');
  }

  const role = (session.user as any).role;
  if (role !== 'CATALOG_MANAGER' && role !== 'ADMIN') {
    redirect('/admin/login?error=forbidden');
  }

  return session;
}

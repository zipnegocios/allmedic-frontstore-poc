import { auth } from '@/lib/auth';

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  const role = (session.user as any).role;
  if (role !== 'CATALOG_MANAGER' && role !== 'ADMIN') {
    throw new Error('Forbidden');
  }
  return session;
}

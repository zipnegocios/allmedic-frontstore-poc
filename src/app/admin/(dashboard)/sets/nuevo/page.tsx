import { redirect } from 'next/navigation';
import SetForm from '@/components/admin/SetForm';
import { requireAdminPage } from '@/lib/admin-auth';
import { requireRole } from '@/lib/permissions';

export default async function NewSetPage() {
  const session = await requireAdminPage();
  try {
    await requireRole(session, 'sets', 'write');
  } catch {
    redirect('/admin/sets');
  }
  return <SetForm />;
}

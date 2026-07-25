import { redirect } from 'next/navigation';
import ProductForm from '@/components/admin/ProductForm';
import { requireAdminPage } from '@/lib/admin-auth';
import { requireRole } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const session = await requireAdminPage();
  try {
    await requireRole(session, 'productos', 'write');
  } catch {
    redirect('/admin/productos');
  }
  return <ProductForm />;
}

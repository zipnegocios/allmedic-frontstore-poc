import { notFound, redirect } from 'next/navigation';
import { getAdminProductById } from '@/lib/admin-data-service';
import ProductForm from '@/components/admin/ProductForm';
import { mapProductDetailToFormData, type AdminProductDetail } from '@/components/admin/product-form/map-product-to-form';
import { requireAdminPage } from '@/lib/admin-auth';
import { requireRole } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const session = await requireAdminPage();
  // El listado ya oculta el enlace de edición sin `productos:write` (Fase 6 del plan RBAC:
  // Ventas ve el catálogo, pero no puede editar) — este guard es la defensa de respaldo si
  // alguien pega la URL directamente.
  try {
    await requireRole(session, 'productos', 'write');
  } catch {
    redirect('/admin/productos');
  }

  const { id } = await params;
  const product = await getAdminProductById(id);

  if (!product) {
    notFound();
  }

  const initialData = mapProductDetailToFormData(product as unknown as AdminProductDetail);

  return <ProductForm productId={id} initialData={initialData as any} />;
}


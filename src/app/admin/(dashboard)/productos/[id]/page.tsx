import { notFound } from 'next/navigation';
import { getAdminProductById } from '@/lib/admin-data-service';
import ProductForm from '@/components/admin/ProductForm';
import { mapProductDetailToFormData, type AdminProductDetail } from '@/components/admin/product-form/map-product-to-form';

export const dynamic = 'force-dynamic';

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const product = await getAdminProductById(id);

  if (!product) {
    notFound();
  }

  const initialData = mapProductDetailToFormData(product as unknown as AdminProductDetail);

  return <ProductForm productId={id} initialData={initialData as any} />;
}


import { notFound } from 'next/navigation';
import { getAdminSetById } from '@/lib/admin-data-service';
import SetForm from '@/components/admin/SetForm';

interface EditSetPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSetPage({ params }: EditSetPageProps) {
  const { id } = await params;
  const set = await getAdminSetById(id);

  if (!set) {
    notFound();
  }

  const initialData = {
    name: set.name,
    slug: set.slug,
    description: set.description || '',
    imageUrl: set.imageUrl || '',
    setGroupId: set.setGroupId || '',
    brandId: set.brandId || '',
    isActive: set.isActive ?? true,
    isFeatured: set.isFeatured ?? false,
    priceManual: set.priceManual ?? '',
    priceManualSale: set.priceManualSale ?? '',
    manualDiscountEnd: set.manualDiscountEnd
      ? new Date(set.manualDiscountEnd).toISOString().slice(0, 16)
      : '',
    items: set.items.map((i) => ({
      productId: i.productId,
      quantityPerSet: i.quantityPerSet ?? 1,
    })),
  };

  return <SetForm setId={id} initialData={initialData} />;
}

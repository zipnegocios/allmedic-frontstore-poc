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

  // `getAdminSetById` devuelve los bloques ya ordenados por blockCode ('A' antes que 'B'), pero
  // sin garantía de tupla fija en el tipo de retorno — se rellena defensivamente por si un set
  // quedó con menos de 2 bloques o menos de 2 opciones por bloque (dato inconsistente).
  const blockAt = (code: 'A' | 'B', index: 0 | 1) => {
    const block = set.blocks[index];
    return {
      blockCode: code,
      quantityPerSet: block?.quantityPerSet ?? 1,
      options: [
        { productId: block?.options[0]?.productId ?? '' },
        { productId: block?.options[1]?.productId ?? '' },
      ] as [{ productId: string }, { productId: string }],
    };
  };

  const initialData = {
    name: set.name,
    slug: set.slug,
    description: set.description || '',
    imageUrl: set.imageUrl || '',
    coverAssetId: set.cover?.assetId || '',
    coverAlt: set.cover?.alt || '',
    secondaryImageUrl: set.secondaryImageUrl || '',
    secondaryCoverAssetId: set.secondaryCover?.assetId || '',
    secondaryCoverAlt: set.secondaryCover?.alt || '',
    colorMode: set.colorMode as 'PAIRED' | 'MIXED',
    isActive: set.isActive ?? true,
    isFeatured: set.isFeatured ?? false,
    priceManual: set.priceManual ?? '',
    priceManualSale: set.priceManualSale ?? '',
    manualDiscountEnd: set.manualDiscountEnd
      ? new Date(set.manualDiscountEnd).toISOString().slice(0, 16)
      : '',
    blocks: [blockAt('A', 0), blockAt('B', 1)] as [ReturnType<typeof blockAt>, ReturnType<typeof blockAt>],
    recommendedItems: set.recommendedItems.map((i) => ({ productId: i.productId })),
  };

  return <SetForm setId={id} initialData={initialData} />;
}

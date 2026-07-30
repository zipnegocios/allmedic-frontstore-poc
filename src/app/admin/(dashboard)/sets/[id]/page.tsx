import { notFound, redirect } from 'next/navigation';
import { getAdminSetById } from '@/lib/admin-data-service';
import SetForm from '@/components/admin/SetForm';
import { requireAdminPage } from '@/lib/admin-auth';
import { requireRole } from '@/lib/permissions';

interface EditSetPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSetPage({ params }: EditSetPageProps) {
  const session = await requireAdminPage();
  // El listado ya oculta el enlace de edición sin `sets:write` (Fase 6 del plan RBAC) —
  // este guard es la defensa de respaldo si alguien pega la URL directamente.
  try {
    await requireRole(session, 'sets', 'write');
  } catch {
    redirect('/admin/sets');
  }

  const { id } = await params;
  const set = await getAdminSetById(id);

  if (!set) {
    notFound();
  }

  // `getAdminSetById` devuelve los bloques ya ordenados por blockCode ('A' antes que 'B'), pero
  // sin garantía de tupla fija en el tipo de retorno — se rellena defensivamente por si un set
  // quedó sin bloques (dato inconsistente). Las opciones NO se rellenan a 2: un bloque con 1
  // sola opción cargada (sin alternativa) es un estado válido, no un dato faltante — rellenar
  // con un segundo slot vacío rompería la validación (`productId` requerido si el slot existe).
  const blockAt = (code: 'A' | 'B', index: 0 | 1) => {
    const block = set.blocks[index];
    return {
      blockCode: code,
      quantityPerSet: block?.quantityPerSet ?? 1,
      options: (block?.options ?? [{ productId: '' }]).map((o) => ({ productId: o.productId ?? '' })),
    };
  };

  const initialData = {
    name: set.name,
    slug: set.slug,
    description: set.description || '',
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
    setColors: set.setColors.map((c) => ({
      colorId: c.colorId,
      sortOrder: c.sortOrder,
      coverAssetId: c.coverAssetId || '',
      coverAlt: c.coverAlt || '',
      imageUrl: c.imageUrl || '',
      secondaryCoverAssetId: c.secondaryCoverAssetId || '',
      secondaryCoverAlt: c.secondaryCoverAlt || '',
      secondaryImageUrl: c.secondaryImageUrl || '',
    })),
  };

  return <SetForm setId={id} initialData={initialData} />;
}

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAdminBrandById, getAdminCollections, getAdminProductTypes } from '@/lib/admin-data-service';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { BrandCollectionsSection } from '@/components/admin/brands/BrandCollectionsSection';
import { BrandProductTypesSection } from '@/components/admin/brands/BrandProductTypesSection';

export default async function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brand = await getAdminBrandById(id);
  if (!brand) notFound();

  const [collections, productTypes] = await Promise.all([
    getAdminCollections(id),
    getAdminProductTypes(id),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <Link href="/admin/marcas">
        <Button variant="outline" size="sm" className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Marcas
        </Button>
      </Link>

      <div className="flex items-center gap-3 mb-8">
        {brand.logoUrl && <img src={brand.logoUrl} alt="" className="w-10 h-10 object-contain" />}
        <h1 className="text-3xl font-bold text-[#111111] break-words">{brand.name}</h1>
      </div>

      <BrandCollectionsSection brandId={id} initialCollections={collections} />

      <div className="mt-8">
        <BrandProductTypesSection brandId={id} initialProductTypes={productTypes} />
      </div>
    </div>
  );
}

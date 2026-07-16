import { notFound } from 'next/navigation';
import { getAdminProductById } from '@/lib/admin-data-service';
import ProductForm from '@/components/admin/ProductForm';

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

  // Transform DB data to form format
  const initialData = {
    slug: product.slug,
    name: product.name,
    description: product.description || '',
    sku: product.sku || '',
    code: product.code || '',
    brandId: product.brandId,
    collectionId: product.collectionId || '',
    productTypeId: product.productTypeId || '',
    gender: product.gender,
    priceNormal: product.priceNormal,
    priceSale: product.priceSale || '',
    discountPct: product.discountPct || undefined,
    discountEnd: product.discountEnd
      ? new Date(product.discountEnd).toISOString().slice(0, 16)
      : '',
    priceWholesale: product.priceWholesale || '',
    priceWholesaleSale: product.priceWholesaleSale || '',
    wholesaleDiscountEnd: product.wholesaleDiscountEnd
      ? new Date(product.wholesaleDiscountEnd).toISOString().slice(0, 16)
      : '',
    visibility: (product.visibility as 'INDIVIDUAL' | 'GROUPS' | 'BOTH') || 'INDIVIDUAL',
    isNew: product.isNew ?? false,
    isBestSeller: product.isBestSeller ?? false,
    isActive: product.isActive ?? true,
    features: (product.features as string[]) || [],
    careInstructions: (product.careInstructions as string[]) || [],
    crossSellId: product.crossSellId || '',
    variants: product.variants.map((v: any) => ({
      id: v.id,
      colorId: v.colorId,
      size: v.size,
      sku: v.sku,
      status: v.status,
      stock: v.stock ?? 0,
      minStock: v.minStock ?? 5,
    })),
    images: product.images.map((i: any) => ({
      id: i.id,
      assetId: i.assetId,
      colorId: i.colorId || '',
      url: i.url,
      storageKey: i.storageKey,
      mimeType: i.mimeType,
      alt: i.alt || '',
      sortOrder: i.sortOrder ?? 0,
    })),
    cover: product.cover
      ? {
          id: product.cover.id,
          assetId: product.cover.assetId,
          url: product.cover.url,
          storageKey: product.cover.storageKey,
          mimeType: product.cover.mimeType,
          alt: product.cover.alt || '',
        }
      : { assetId: '', url: '', storageKey: '', mimeType: '', alt: '' },
  };

  return <ProductForm productId={id} initialData={initialData as any} />;
}


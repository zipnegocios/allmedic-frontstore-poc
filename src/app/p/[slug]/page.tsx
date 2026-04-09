import { Product } from '@/legacy-pages/Product';
import { Footer } from '@/components/layout/Footer';
import { getProductBySlug, getStores, getAllProducts } from '@/lib/data-service';
import { notFound } from 'next/navigation';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, stores, allProducts] = await Promise.all([
    getProductBySlug(slug),
    getStores(),
    getAllProducts(),
  ]);

  if (!product) {
    notFound();
  }

  // Find complementary product
  const complementaryProduct = product.complementaryProduct
    ? allProducts.find(p => p.id === product.complementaryProduct)
    : undefined;

  return (
    <>
      <Product product={product} complementaryProduct={complementaryProduct} />
      <Footer stores={stores} />
    </>
  );
}

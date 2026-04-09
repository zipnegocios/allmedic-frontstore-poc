import { CatalogoContent } from './CatalogoContent';
import { Footer } from '@/components/layout/Footer';
import { getAllProducts, getBrandNames, getColors, getStores } from '@/lib/data-service';

export default async function CatalogoPage() {
  const [products, brandNames, colors, stores] = await Promise.all([
    getAllProducts(),
    getBrandNames(),
    getColors(),
    getStores(),
  ]);

  return (
    <>
      <CatalogoContent
        initialProducts={products}
        brandNames={brandNames}
        availableColors={colors}
      />
      <Footer stores={stores} />
    </>
  );
}

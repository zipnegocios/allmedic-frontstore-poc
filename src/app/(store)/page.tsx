import { Footer } from '@/components/layout/Footer';
import { Home } from '@/legacy-pages/Home';
import { getFeaturedProducts, getHeroSlides, getAllProducts, getBrandsForNav } from '@/lib/data-service';
import { getStores } from '@/lib/data-service';

export default async function HomePage() {
  const [featuredProducts, heroSlides, stores, allProducts, brands] = await Promise.all([
    getFeaturedProducts(),
    getHeroSlides(),
    getStores(),
    getAllProducts(),
    getBrandsForNav(),
  ]);

  return (
    <div className="min-h-screen bg-white">
      <Home heroSlides={heroSlides} featuredProducts={featuredProducts} allProducts={allProducts} brands={brands} />
      <Footer stores={stores} />
    </div>
  );
}

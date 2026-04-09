import { Footer } from '@/components/layout/Footer';
import { Home } from '@/legacy-pages/Home';
import { getFeaturedProducts, getHeroSlides } from '@/lib/data-service';
import { getStores } from '@/lib/data-service';

export default async function HomePage() {
  const [featuredProducts, heroSlides, stores] = await Promise.all([
    getFeaturedProducts(),
    getHeroSlides(),
    getStores(),
  ]);

  return (
    <div className="min-h-screen bg-white">
      <Home heroSlides={heroSlides} featuredProducts={featuredProducts} />
      <Footer stores={stores} />
    </div>
  );
}

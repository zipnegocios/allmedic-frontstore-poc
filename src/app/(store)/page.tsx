import { Footer } from '@/components/layout/Footer';
import { Home } from '@/legacy-pages/Home';
import { getHeroSlides, getStores, getBrandsForNav } from '@/lib/data-service';
import { getActiveCorporateSets, getAllBusinessRules } from '@/lib/corporate-data-service';
import { resolveRules } from '@/lib/rules-engine';

// Precios y reglas son datos en vivo — nunca pre-renderizar en build-time
// (evita fallos de build cuando DATABASE_URL solo está disponible en runtime, ej. Docker/EasyPanel).
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [featuredSets, allSets, heroSlides, stores, brands, rules] = await Promise.all([
    getActiveCorporateSets({ featuredOnly: true }),
    getActiveCorporateSets(),
    getHeroSlides(),
    getStores(),
    getBrandsForNav(),
    getAllBusinessRules(),
  ]);

  const resolved = resolveRules(rules, {});
  const priceVisibilityRules = rules.filter((r) => r.ruleType === 'PRICE_VISIBILITY');

  return (
    <div className="min-h-screen bg-white">
      <Home
        heroSlides={heroSlides}
        featuredSets={featuredSets}
        allSets={allSets}
        priceVisibilityRules={priceVisibilityRules}
        minQuantity={resolved.minQuantity.min}
        brands={brands}
      />
      <Footer stores={stores} />
    </div>
  );
}

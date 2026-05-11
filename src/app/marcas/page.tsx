import { getBrands } from '@/lib/data-service';
import { getStores } from '@/lib/data-service';
import { Footer } from '@/components/layout/Footer';
import { BrandCard } from './BrandCard';

export default async function MarcasPage() {
  const [brands, stores] = await Promise.all([getBrands(), getStores()]);

  return (
    <>
      <main className="min-h-screen bg-white pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-[#111111] mb-4">
              Nuestras Marcas
            </h1>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Trabajamos con las mejores marcas de uniformes medicos para ofrecerte calidad y estilo.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {brands.map((brand) => (
              <BrandCard key={brand.slug} brand={brand} />
            ))}
          </div>
        </div>
      </main>
      <Footer stores={stores} />
    </>
  );
}

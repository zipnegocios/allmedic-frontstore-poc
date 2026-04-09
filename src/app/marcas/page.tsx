import { ArrowRight, Package } from 'lucide-react';
import Link from 'next/link';
import { getBrands } from '@/lib/data-service';
import { Footer } from '@/components/layout/Footer';
import { getStores } from '@/lib/data-service';

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
              <Link
                key={brand.slug}
                href={`/catalogo?brand=${encodeURIComponent(brand.name)}`}
                className="group bg-[#F5F5F7] rounded-xl p-6 sm:p-8 hover:bg-[#111111] transition-all duration-300"
              >
                <div className="aspect-square max-w-[80px] sm:max-w-[100px] mx-auto mb-4 flex items-center justify-center">
                  <img
                    src={`/images/brands/${brand.slug}.png`}
                    alt={brand.name}
                    className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300"
                  />
                </div>

                <h3 className="text-base sm:text-lg font-semibold text-[#111111] group-hover:text-white text-center mb-2 transition-colors">
                  {brand.name}
                </h3>

                <div className="flex items-center justify-center gap-1 text-sm text-gray-500 group-hover:text-gray-300 transition-colors">
                  <Package className="w-4 h-4" strokeWidth={1.5} />
                  <span>{brand.productCount} productos</span>
                </div>

                <div className="mt-4 flex items-center justify-center gap-1 text-sm font-medium text-[#111111] group-hover:text-white opacity-0 group-hover:opacity-100 transition-all">
                  <span>Ver productos</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer stores={stores} />
    </>
  );
}

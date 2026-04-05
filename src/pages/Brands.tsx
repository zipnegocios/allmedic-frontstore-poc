import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { BRANDS } from '@/lib/dummy-data';
import { cn } from '@/lib/utils';

// Brand data with descriptions
const BRAND_DATA: Record<string, { 
  description: string; 
  category: string;
  featured: boolean;
}> = {
  'FIGS': {
    description: 'La marca más innovadora del mundo médico. Tecnología FIONx y diseño contemporáneo.',
    category: 'Premium',
    featured: true,
  },
  "Grey's Anatomy": {
    description: 'El clásico atemporal. Suavidad inigualable con tejido ArcLux.',
    category: 'Clásico',
    featured: true,
  },
  'Skechers': {
    description: 'Tecnología Slip-Resistant para máxima seguridad en largas jornadas.',
    category: 'Performance',
    featured: false,
  },
  'Healing Hands': {
    description: 'Línea Purple Label con acabados de lujo y tejido 360° stretch.',
    category: 'Premium',
    featured: true,
  },
  'WonderWink': {
    description: 'Diseños modernos y funcionales para profesionales exigentes.',
    category: 'Contemporáneo',
    featured: false,
  },
  'Infinity': {
    description: 'Alto rendimiento con tecnología Certainty antimicrobiana.',
    category: 'Performance',
    featured: true,
  },
  'Heartsoul': {
    description: 'Estilo y comodidad para el cuidado de la salud.',
    category: 'Contemporáneo',
    featured: false,
  },
  'Med Couture': {
    description: 'Línea Activate con tejido deportivo y máxima movilidad.',
    category: 'Sport',
    featured: false,
  },
  'Landau': {
    description: 'Batas de laboratorio clásicas de alta calidad.',
    category: 'Clásico',
    featured: false,
  },
  'Koi': {
    description: 'Diseños simples con funcionalidad excepcional. Calidad accesible.',
    category: 'Básico',
    featured: false,
  },
  'Jaanuu': {
    description: 'Alto rendimiento con tecnología SILVADUR antibacteriana.',
    category: 'Premium',
    featured: true,
  },
  'Adar': {
    description: 'Uniformes médicos duraderos y económicos.',
    category: 'Económico',
    featured: false,
  },
  'Carhartt Liberty': {
    description: 'Chaquetas resistentes con estilo Carhartt.',
    category: 'Workwear',
    featured: false,
  },
  'Maevn': {
    description: 'Diseños modernos con excelente relación calidad-precio.',
    category: 'Contemporáneo',
    featured: false,
  },
  'Mandala': {
    description: 'Estilo único para profesionales de la salud.',
    category: 'Contemporáneo',
    featured: false,
  },
};

export function Brands() {
  const featuredBrands = BRANDS.filter(b => BRAND_DATA[b]?.featured);
  const allBrands = BRANDS;

  return (
    <main className="min-h-screen bg-white pt-16">
      {/* Hero Section */}
      <div className="bg-[#111111] text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Nuestras Marcas
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mb-8">
              Representamos las mejores marcas de uniformes médicos del mundo. 
              Cada una con su propia identidad, tecnología y estilo.
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="w-2 h-2 bg-[#34C759] rounded-full" />
              {allBrands.length} marcas disponibles
            </div>
          </div>
        </div>
      </div>

      {/* Featured Brands */}
      <section className="py-16 bg-[#F5F5F7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[#111111] mb-2">
            Marcas Destacadas
          </h2>
          <p className="text-gray-500 mb-8">
            Las favoritas de nuestros clientes
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredBrands.map((brand) => (
              <BrandCard key={brand} brand={brand} featured />
            ))}
          </div>
        </div>
      </section>

      {/* All Brands Grid */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-[#111111] mb-2">
                Todas las Marcas
              </h2>
              <p className="text-gray-500">
                Explora el catálogo completo
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {allBrands.map((brand) => (
              <BrandLogoCard key={brand} brand={brand} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[#F5F5F7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-[#111111] mb-4">
            ¿No encuentras tu marca favorita?
          </h2>
          <p className="text-gray-500 mb-8 max-w-xl mx-auto">
            Estamos constantemente ampliando nuestro catálogo. 
            Contáctanos si buscas una marca específica.
          </p>
          <a
            href="https://wa.me/593999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white font-medium rounded-full hover:opacity-90 transition-opacity"
          >
            Solicitar marca
          </a>
        </div>
      </section>
    </main>
  );
}

interface BrandCardProps {
  brand: string;
  featured?: boolean;
}

function BrandCard({ brand, featured }: BrandCardProps) {
  const data = BRAND_DATA[brand] || {
    description: 'Uniformes médicos de alta calidad.',
    category: 'General',
    featured: false,
  };

  return (
    <Link
      to={`/catalogo?brand=${encodeURIComponent(brand)}`}
      className={cn(
        'group block bg-white rounded-xl overflow-hidden',
        'border border-[#E5E5E5] hover:border-[#111111]',
        'transition-all duration-300 hover:shadow-lg'
      )}
    >
      {/* Logo Area */}
      <div className="aspect-[3/2] bg-[#F5F5F7] flex items-center justify-center p-8">
        <img
          src={`/images/brands/${brand.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '')}.png`}
          alt={brand}
          className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            // Fallback to text logo
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              const fallback = document.createElement('div');
              fallback.className = 'text-2xl md:text-3xl font-bold text-[#111111] text-center';
              fallback.textContent = brand;
              parent.appendChild(fallback);
            }
          }}
        />
      </div>

      {/* Info */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs uppercase tracking-wider text-gray-400">
            {data.category}
          </span>
          {featured && (
            <span className="px-2 py-0.5 bg-[#111111] text-white text-[10px] font-bold uppercase tracking-wider rounded">
              Destacado
            </span>
          )}
        </div>
        <h3 className="text-xl font-bold text-[#111111] mb-2">{brand}</h3>
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
          {data.description}
        </p>
        <div className="flex items-center gap-1 text-sm font-medium text-[#111111] group-hover:gap-2 transition-all">
          Ver productos
          <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
        </div>
      </div>
    </Link>
  );
}

function BrandLogoCard({ brand }: { brand: string }) {
  const data = BRAND_DATA[brand] || { category: 'General' };

  return (
    <Link
      to={`/catalogo?brand=${encodeURIComponent(brand)}`}
      className={cn(
        'group flex flex-col items-center p-6',
        'bg-white rounded-xl border border-[#E5E5E5]',
        'hover:border-[#111111] hover:shadow-md',
        'transition-all duration-300'
      )}
    >
      {/* Logo */}
      <div className="w-full aspect-square max-w-[100px] mb-4 flex items-center justify-center">
        <img
          src={`/images/brands/${brand.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '')}.png`}
          alt={brand}
          className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-110"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              const fallback = document.createElement('div');
              fallback.className = 'text-lg font-bold text-[#111111] text-center';
              fallback.textContent = brand;
              parent.appendChild(fallback);
            }
          }}
        />
      </div>

      {/* Name */}
      <h3 className="text-sm font-semibold text-[#111111] text-center mb-1">
        {brand}
      </h3>
      <span className="text-xs text-gray-400">
        {data.category}
      </span>
    </Link>
  );
}

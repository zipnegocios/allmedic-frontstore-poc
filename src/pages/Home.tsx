import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { HERO_SLIDES, BRANDS, getFeaturedProducts } from '@/lib/dummy-data';
import { ProductCard } from '@/components/catalog/ProductCard';
import { FilterableProductSection } from '@/components/home/FilterableProductSection';
import { cn } from '@/lib/utils';

// Hero Carousel Component
function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const goToPrev = () => {
    setCurrentSlide(prev => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  };

  const goToNext = () => {
    setCurrentSlide(prev => (prev + 1) % HERO_SLIDES.length);
  };

  return (
    <section className="relative h-[60vh] min-h-[400px] max-h-[600px] overflow-hidden">
      {HERO_SLIDES.map((slide, index) => (
        <div
          key={slide.id}
          className={cn(
            'absolute inset-0 transition-opacity duration-700',
            index === currentSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          {/* Background Image */}
          <div className="absolute inset-0 bg-gray-800">
            <div 
              className="w-full h-full bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${slide.image})`,
                backgroundColor: '#2A2A2A'
              }}
            />
            <div className="absolute inset-0 bg-black/50" />
          </div>

          {/* Content */}
          <div className="relative h-full flex items-center">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="max-w-xl">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
                  {slide.title}
                </h1>
                {slide.subtitle && (
                  <p className="text-lg md:text-xl text-white/80 mb-8">
                    {slide.subtitle}
                  </p>
                )}
                <Link
                  to={slide.ctaLink}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#111111] font-medium rounded-full hover:bg-white/90 transition-colors"
                >
                  {slide.cta}
                  <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Navigation Arrows */}
      <button
        onClick={goToPrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
      >
        <ChevronLeft className="w-6 h-6 text-white" strokeWidth={1.5} />
      </button>
      <button
        onClick={goToNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
      >
        <ChevronRight className="w-6 h-6 text-white" strokeWidth={1.5} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {HERO_SLIDES.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-300',
              index === currentSlide ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/70'
            )}
          />
        ))}
      </div>
    </section>
  );
}

// Quick Access Cards Component
function QuickAccessCards() {
  const cards = [
    {
      title: 'Damas',
      image: '/images/category-women.jpg',
      link: '/catalogo?gender=Mujer',
    },
    {
      title: 'Caballeros',
      image: '/images/category-men.jpg',
      link: '/catalogo?gender=Hombre',
    },
    {
      title: 'Accesorios',
      image: '/images/category-accessories.jpg',
      link: '/catalogo?category=Accesorios',
    },
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card, index) => (
            <Link
              key={index}
              to={card.link}
              className="group relative aspect-[4/3] overflow-hidden rounded-lg"
            >
              <div 
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ 
                  backgroundImage: `url(${card.image})`,
                  backgroundColor: '#3A3A3A'
                }}
              />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center">
                <h3 className="text-2xl font-bold text-white">{card.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// Brands Section Component
function BrandsSection() {
  return (
    <section className="py-16 bg-[#F5F5F7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold text-center mb-12">Marcas que representamos</h2>
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-4">
          {BRANDS.slice(0, 14).map((brand, index) => (
            <Link
              key={index}
              to={`/catalogo?brand=${encodeURIComponent(brand)}`}
              className="flex items-center justify-center p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
            >
              <span className="text-sm font-medium text-[#333333] text-center">{brand}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// Featured Products Section Component
function FeaturedProductsSection() {
  const featuredProducts = getFeaturedProducts();

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold">Lo más solicitado</h2>
          <Link
            to="/catalogo"
            className="flex items-center gap-1 text-sm font-medium text-[#333333] hover:text-[#111111] transition-colors"
          >
            Ver todo
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {featuredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

// Main Home Page
export function Home() {
  return (
    <main>
      <HeroCarousel />
      <QuickAccessCards />
      <FilterableProductSection />
      <BrandsSection />
      <FeaturedProductsSection />
    </main>
  );
}

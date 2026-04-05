import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { HERO_SLIDES, getFeaturedProducts } from '@/lib/dummy-data';
import { ProductCard } from '@/components/catalog/ProductCard';
import { ProductListItem } from '@/components/catalog/LayoutSwitcher';
import type { ViewMode } from '@/components/catalog/LayoutSwitcher';
import { LayoutSwitcher } from '@/components/catalog/LayoutSwitcher';
import { FilterableProductSection } from '@/components/home/FilterableProductSection';
import { BrandCarousel } from '@/components/home/BrandCarousel';
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
    <section className="relative w-full h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] min-h-[500px] max-h-[800px] overflow-hidden">
      {HERO_SLIDES.map((slide, index) => (
        <div
          key={slide.id}
          className={cn(
            'absolute inset-0 transition-opacity duration-700',
            index === currentSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          {/* Background Image */}
          <div className="absolute inset-0">
            <div 
              className="w-full h-full bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${slide.image})`,
                backgroundColor: '#1a1a1a'
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          </div>

          {/* Content */}
          <div className="relative h-full flex items-center">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="max-w-xl px-2 sm:px-0">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 sm:mb-4 tracking-tight leading-tight">
                  {slide.title}
                </h1>
                {slide.subtitle && (
                  <p className="text-base sm:text-lg md:text-xl text-white/80 mb-6 sm:mb-8 max-w-md">
                    {slide.subtitle}
                  </p>
                )}
                <Link
                  to={slide.ctaLink}
                  className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-white text-[#111111] font-medium rounded-full hover:bg-white/90 transition-all hover:scale-105 active:scale-95"
                >
                  {slide.cta}
                  <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Bottom Controls Container */}
      <div className="absolute bottom-6 sm:bottom-8 left-0 right-0 flex flex-col items-center gap-4">
        {/* Navigation Arrows - Below CTA, above dots */}
        <div className="flex items-center gap-4">
          <button
            onClick={goToPrev}
            className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/40 transition-all active:scale-95"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={1.5} />
          </button>
          <button
            onClick={goToNext}
            className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/40 transition-all active:scale-95"
            aria-label="Siguiente"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={1.5} />
          </button>
        </div>

        {/* Dots */}
        <div className="flex gap-2">
          {HERO_SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                index === currentSlide ? 'bg-white w-6 sm:w-8' : 'bg-white/40 w-2 hover:bg-white/60'
              )}
              aria-label={`Ir a slide ${index + 1}`}
            />
          ))}
        </div>
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

// Featured Products Section Component
function FeaturedProductsSection() {
  const featuredProducts = getFeaturedProducts();
  // Mobile default: 1 column (grid-1), same as catalog
  const [viewMode, setViewMode] = useState<ViewMode>('grid-1');
  const [itemsPerPage, setItemsPerPage] = useState<number>(8);
  
  // Limit products based on itemsPerPage
  const displayedProducts = featuredProducts.slice(0, itemsPerPage);

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-2xl font-semibold">Lo más solicitado</h2>
          <div className="flex items-center gap-4">
            {/* Desktop: show all column options */}
            <div className="hidden sm:block">
              <LayoutSwitcher
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={setItemsPerPage}
                totalItems={featuredProducts.length}
                showAllColumns={true}
              />
            </div>
            {/* Mobile: show only 1 col, 2 cols, list */}
            <div className="sm:hidden">
              <LayoutSwitcher
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={setItemsPerPage}
                totalItems={featuredProducts.length}
                showAllColumns={false}
              />
            </div>
            <Link
              to="/catalogo"
              className="hidden sm:flex items-center gap-1 text-sm font-medium text-[#333333] hover:text-[#111111] transition-colors"
            >
              Ver todo
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
        <div className={cn(
          'grid gap-4 md:gap-6',
          // Desktop view modes (4, 3, 2 cols)
          viewMode === 'grid-4' && 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4',
          viewMode === 'grid-3' && 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3',
          viewMode === 'grid-2' && 'grid-cols-2 lg:grid-cols-2',
          // Mobile view modes (1, 2 cols)
          viewMode === 'grid-1' && 'grid-cols-1 sm:grid-cols-2',
          viewMode === 'list' && 'grid-cols-1'
        )}>
          {displayedProducts.map(product => (
            viewMode === 'list' ? (
              <ProductListItem 
                key={product.id} 
                product={product}
                onQuickView={() => {}}
              />
            ) : (
              <ProductCard key={product.id} product={product} />
            )
          ))}
        </div>
        <div className="mt-6 sm:hidden">
          <Link
            to="/catalogo"
            className="flex items-center justify-center gap-1 text-sm font-medium text-[#333333] hover:text-[#111111] transition-colors py-3 border border-[#E5E5E5] rounded-lg"
          >
            Ver todo
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}

// Main Home Page
export function Home() {
  return (
    <main className="pt-14 sm:pt-16">
      <HeroCarousel />
      <QuickAccessCards />
      <FilterableProductSection />
      <BrandCarousel />
      <FeaturedProductsSection />
    </main>
  );
}

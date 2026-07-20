'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { ProductCard } from '@/components/catalog/ProductCard';
import { ProductListItem } from '@/components/catalog/LayoutSwitcher';
import type { ViewMode } from '@/components/catalog/LayoutSwitcher';
import { LayoutSwitcher } from '@/components/catalog/LayoutSwitcher';
import { FilterableProductSection } from '@/components/home/FilterableProductSection';
import { BrandCarousel } from '@/components/home/BrandCarousel';
import { CorporateCTA } from '@/components/home/CorporateCTA';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import type { Product, MediaItem, BrandNavItem } from '@/lib/types';

interface HeroSlide {
  id: string;
  desktopMedia: MediaItem;
  mobileMedia: MediaItem | null;
  title: string;
  subtitle?: string;
  cta: string;
  ctaLink: string;
}

// Un slide individual del hero: decide imagen/video y desktop/mobile, con botón de sonido para video.
function HeroSlideMedia({ slide, isActive, priority }: { slide: HeroSlide; isActive: boolean; priority: boolean }) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const media = (isMobile && slide.mobileMedia) ? slide.mobileMedia : slide.desktopMedia;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isActive]);

  if (media.type === 'video') {
    return (
      <>
        <video
          ref={videoRef}
          src={media.url}
          autoPlay
          muted={muted}
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="absolute bottom-6 right-6 z-20 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/40 transition-all"
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
        >
          {muted ? <VolumeX className="w-5 h-5 text-white" strokeWidth={1.5} /> : <Volume2 className="w-5 h-5 text-white" strokeWidth={1.5} />}
        </button>
      </>
    );
  }

  return (
    <Image
      src={media.url}
      alt={slide.title}
      fill
      priority={priority}
      sizes="100vw"
      className="object-cover object-center"
    />
  );
}

// Hero Carousel Component
function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (slides.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const goToSlide = (index: number) => setCurrentSlide(index);
  const goToPrev = () => setCurrentSlide(prev => (prev - 1 + slides.length) % slides.length);
  const goToNext = () => setCurrentSlide(prev => (prev + 1) % slides.length);

  if (slides.length === 0) return null;

  return (
    <section className="relative w-full h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] min-h-[500px] max-h-[800px] overflow-hidden">
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={cn(
            'absolute inset-0 transition-opacity duration-700',
            index === currentSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <div className="absolute inset-0 bg-[#1a1a1a]">
            <HeroSlideMedia slide={slide} isActive={index === currentSlide} priority={index === 0} />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          </div>
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
                  href={slide.ctaLink}
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

      <div className="absolute bottom-6 sm:bottom-8 left-0 right-0 flex flex-col items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={goToPrev} className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/40 transition-all active:scale-95" aria-label="Anterior">
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={1.5} />
          </button>
          <button onClick={goToNext} className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/40 transition-all active:scale-95" aria-label="Siguiente">
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex gap-2">
          {slides.map((_, index) => (
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
    { title: 'Damas', image: 'https://media.allmedicuniforms.com/site/category-women.jpg', link: '/catalogo?gender=Mujer' },
    { title: 'Caballeros', image: 'https://media.allmedicuniforms.com/site/category-men.jpg', link: '/catalogo?gender=Hombre' },
    // `?category=` legacy ya no filtra en `/catalogo` (Fase 4 remanente) — usa el buscador de
    // texto libre (`?q=`), que ya matchea contra `productType?.name` (EAV).
    { title: 'Accesorios', image: 'https://media.allmedicuniforms.com/site/category-accessories.jpg', link: '/catalogo?q=Accesorios' },
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card, index) => (
            <Link key={index} href={card.link} className="group relative aspect-[4/3] overflow-hidden rounded-lg">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" style={{ backgroundImage: `url(${card.image})`, backgroundColor: '#3A3A3A' }} />
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
function FeaturedProductsSection({ products }: { products: Product[] }) {
  // Default to 4 columns on desktop, 2 columns on mobile (handled by responsive classes)
  const [viewMode, setViewMode] = useState<ViewMode>('grid-4');
  const [itemsPerPage, setItemsPerPage] = useState<number>(8);
  const displayedProducts = products.slice(0, itemsPerPage);

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-2xl font-semibold">Lo más solicitado</h2>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <LayoutSwitcher viewMode={viewMode} onViewModeChange={setViewMode} itemsPerPage={itemsPerPage} onItemsPerPageChange={setItemsPerPage} totalItems={products.length} showAllColumns={true} />
            </div>
            <div className="sm:hidden">
              <LayoutSwitcher viewMode={viewMode} onViewModeChange={setViewMode} itemsPerPage={itemsPerPage} onItemsPerPageChange={setItemsPerPage} totalItems={products.length} showAllColumns={false} />
            </div>
            <Link href="/catalogo" className="hidden sm:flex items-center gap-1 text-sm font-medium text-[#333333] hover:text-[#111111] transition-colors">
              Ver todo <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
        <div className={cn(
          'grid gap-4 md:gap-6',
          viewMode === 'grid-4' && 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4',
          viewMode === 'grid-3' && 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3',
          viewMode === 'grid-2' && 'grid-cols-2 lg:grid-cols-2',
          viewMode === 'grid-1' && 'grid-cols-1 sm:grid-cols-2',
          viewMode === 'list' && 'grid-cols-1'
        )}>
          {displayedProducts.map(product => (
            viewMode === 'list' ? (
              <ProductListItem key={product.id} product={product} onQuickView={() => {}} />
            ) : (
              <ProductCard key={product.id} product={product} />
            )
          ))}
        </div>
        <div className="mt-6 sm:hidden">
          <Link href="/catalogo" className="flex items-center justify-center gap-1 text-sm font-medium text-[#333333] hover:text-[#111111] transition-colors py-3 border border-[#E5E5E5] rounded-lg">
            Ver todo <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}

// Main Home Page
export function Home({ heroSlides, featuredProducts, allProducts, brands }: { heroSlides: HeroSlide[]; featuredProducts: Product[]; allProducts?: Product[]; brands?: BrandNavItem[] }) {
  return (
    <main className="pt-14 sm:pt-16">
      {heroSlides && heroSlides.length > 0 && <HeroCarousel slides={heroSlides} />}
      <CorporateCTA />
      <QuickAccessCards />
      {allProducts && allProducts.length > 0 && <FilterableProductSection products={allProducts} />}
      {brands && brands.length > 0 && <BrandCarousel brands={brands} />}
      {featuredProducts && featuredProducts.length > 0 && <FeaturedProductsSection products={featuredProducts} />}
    </main>
  );
}

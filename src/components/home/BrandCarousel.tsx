'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
// Removed dummy brand names import
import type { BrandNavItem } from '@/lib/types';
import { cn } from '@/lib/utils';

const DEFAULT_BRANDS: BrandNavItem[] = [];

// Featured brands with descriptions
const BRAND_INFO: Record<string, { description: string; featured: boolean }> = {
  // Removed brand key to avoid hardcoded mock references
  "Grey's Anatomy": { description: 'El clásico atemporal', featured: true },
  'Skechers': { description: 'Máxima comodidad', featured: false },
  'Healing Hands': { description: 'Lujo y elegancia', featured: true },
  'WonderWink': { description: 'Diseño moderno', featured: false },
  'Infinity': { description: 'Alto rendimiento', featured: true },
  'Heartsoul': { description: 'Estilo y comodidad', featured: false },
  'Med Couture': { description: 'Deportivo y funcional', featured: false },
  'Landau': { description: 'Tradición y calidad', featured: false },
  'Koi': { description: 'Diseños únicos', featured: false },
  'Jaanuu': { description: 'Innovación antibacteriana', featured: true },
  'Adar': { description: 'Calidad accesible', featured: false },
  'Carhartt Liberty': { description: 'Resistencia extrema', featured: false },
  'Maevn': { description: 'Estilo contemporáneo', featured: false },
  'Mandala': { description: 'Arte y espiritualidad', featured: false },
};

export function BrandCarousel({ brands: brandsProp }: { brands?: BrandNavItem[] } = {}) {
  const BRANDS = brandsProp || DEFAULT_BRANDS;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Items per view based on screen size
  const getItemsPerView = () => {
    if (typeof window === 'undefined') return 4;
    if (window.innerWidth < 640) return 2;
    if (window.innerWidth < 1024) return 3;
    return 5;
  };

  const [itemsPerView, setItemsPerView] = useState(5);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
      setItemsPerView(getItemsPerView());
    }, 0);

    const handleResize = () => setItemsPerView(getItemsPerView());
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const maxIndex = Math.max(0, BRANDS.length - itemsPerView);

  // Auto-play
  useEffect(() => {
    if (!isMounted || isPaused || isDragging) return;
    autoPlayRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev >= maxIndex ? 0 : prev + 1;
        return next;
      });
    }, 3000);
    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
    };
  }, [isMounted, isPaused, isDragging, maxIndex]);

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => (prev <= 0 ? maxIndex : prev - 1));
  }, [maxIndex]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
  }, [maxIndex]);

  // Touch/Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (containerRef.current?.offsetLeft || 0));
    setScrollLeft(containerRef.current?.scrollLeft || 0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (containerRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 2;
    if (containerRef.current) {
      containerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].pageX - (containerRef.current?.offsetLeft || 0));
    setScrollLeft(containerRef.current?.scrollLeft || 0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const x = e.touches[0].pageX - (containerRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 2;
    if (containerRef.current) {
      containerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <section className="py-12 sm:py-16 bg-[#F5F5F7] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display uppercase text-h2-mobile sm:text-h2 text-[#111111] mb-2">
              Marcas que representamos
            </h2>
            <p className="text-sm sm:text-base text-gray-500">
              Las mejores marcas de uniformes médicos del mundo
            </p>
          </div>

          {/* Desktop Navigation Arrows */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={goToPrev}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-[#E5E5E5] bg-white hover:border-[#111111] hover:bg-[#111111] hover:text-white transition-all duration-300"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <button
              onClick={goToNext}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-[#E5E5E5] bg-white hover:border-[#111111] hover:bg-[#111111] hover:text-white transition-all duration-300"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Carousel Container */}
        <div
          ref={containerRef}
          className="relative overflow-x-auto scrollbar-hide"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => {
            setIsPaused(false);
            setIsDragging(false);
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Track */}
          <div
            className="flex gap-3 sm:gap-4 transition-transform duration-500 ease-out scrollbar-hide"
            style={{
              transform: `translateX(-${currentIndex * (100 / itemsPerView + 1.5)}%)`,
            }}
          >
            {BRANDS.map((brand, index) => {
              const info = BRAND_INFO[brand.name] || { description: '', featured: false };

              return (
                <Link
                  key={brand.name}
                  href={`/catalogo?brand=${encodeURIComponent(brand.name)}`}
                  className={cn(
                    'flex-shrink-0 group relative',
                    'w-[calc(50%-6px)] sm:w-[calc(33.333%-11px)] lg:w-[calc(20%-13px)]'
                  )}
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  <div className={cn(
                    'bg-white rounded-xl p-2 sm:p-3 border border-[#E5E5E5]',
                    'aspect-[2/1] flex flex-col items-center justify-center relative overflow-hidden',
                    'transition-all duration-300 ease-out',
                    'hover:border-[#111111] hover:shadow-lg hover:-translate-y-1',
                    'active:scale-95'
                  )}>
                    {/* Logo */}
                    <div className="w-[95%] h-[75%] flex items-center justify-center transition-all duration-300 group-hover:-translate-y-2 group-hover:scale-95">
                      {brand.logoUrl ? (
                        <img
                          src={brand.logoUrl}
                          alt={brand.name}
                          className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-110"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              const fallback = document.createElement('div');
                              fallback.className = 'text-xs sm:text-sm font-bold text-[#111111] text-center';
                              fallback.textContent = brand.name;
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      ) : (
                        <span className="text-xs sm:text-sm font-bold text-[#111111] text-center">
                          {brand.name}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <p className="text-xs sm:text-sm text-[#111111] text-center font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute bottom-1.5 sm:bottom-2 left-0 right-0 px-2 truncate pointer-events-none">
                      {brand.name}
                    </p>

                    {/* Featured Badge */}
                    {info.featured && (
                      <span className="absolute top-1.5 right-1.5 px-2 py-0.5 bg-[#111111] text-white text-[9px] font-bold rounded-full">
                        TOP
                      </span>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-[#111111]/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Mobile Navigation Dots */}
        <div className="flex sm:hidden justify-center gap-2 mt-6">
          {Array.from({ length: maxIndex + 1 }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                currentIndex === index ? 'bg-[#111111] w-6' : 'bg-gray-300 w-2'
              )}
              aria-label={`Ir a página ${index + 1}`}
            />
          ))}
        </div>

        {/* Progress Bar */}
        <div className="hidden sm:block mt-8">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#111111] rounded-full transition-all duration-500"
              style={{ width: `${((currentIndex + itemsPerView) / BRANDS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

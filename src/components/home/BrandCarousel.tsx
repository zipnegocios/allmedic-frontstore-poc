'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BRANDS } from '@/lib/dummy-data';
import { cn } from '@/lib/utils';

// Featured brands with descriptions
const BRAND_INFO: Record<string, { description: string; featured: boolean }> = {
  'FIGS': { description: 'Tecnología médica de vanguardia', featured: true },
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

export function BrandCarousel() {
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

  useEffect(() => {
    const handleResize = () => setItemsPerView(getItemsPerView());
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const maxIndex = Math.max(0, BRANDS.length - itemsPerView);

  // Auto-play
  useEffect(() => {
    if (!isPaused && !isDragging) {
      autoPlayRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
      }, 3000);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [isPaused, isDragging, maxIndex]);

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
            <h2 className="text-2xl sm:text-3xl font-bold text-[#111111] mb-2">
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
          className="relative"
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
            className="flex gap-3 sm:gap-4 transition-transform duration-500 ease-out"
            style={{
              transform: `translateX(-${currentIndex * (100 / itemsPerView + 1.5)}%)`,
            }}
          >
            {BRANDS.map((brand, index) => {
              const info = BRAND_INFO[brand] || { description: '', featured: false };
              const logoPath = `/images/brands/${brand.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '')}.png`;
              
              return (
                <Link
                  key={brand}
                  href={`/catalogo?brand=${encodeURIComponent(brand)}`}
                  className={cn(
                    'flex-shrink-0 group relative',
                    'w-[calc(50%-6px)] sm:w-[calc(33.333%-11px)] lg:w-[calc(20%-13px)]'
                  )}
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  <div className={cn(
                    'bg-white rounded-xl p-4 sm:p-6 border border-[#E5E5E5]',
                    'transition-all duration-300 ease-out',
                    'hover:border-[#111111] hover:shadow-lg hover:-translate-y-1',
                    'active:scale-95'
                  )}>
                    {/* Logo */}
                    <div className="aspect-square max-w-[80px] sm:max-w-[100px] mx-auto mb-3 sm:mb-4 flex items-center justify-center">
                      <img
                        src={logoPath}
                        alt={brand}
                        className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-110"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'text-lg sm:text-xl font-bold text-[#111111] text-center';
                            fallback.textContent = brand;
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    </div>

                    {/* Info */}
                    <div className="text-center">
                      <h3 className="text-sm sm:text-base font-semibold text-[#111111] mb-1 truncate">
                        {brand}
                      </h3>
                      <p className="text-xs text-gray-400 line-clamp-1">
                        {info.description}
                      </p>
                    </div>

                    {/* Featured Badge */}
                    {info.featured && (
                      <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-[#111111] text-white text-[10px] font-bold rounded-full">
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

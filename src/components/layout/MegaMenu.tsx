'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, MapPin, Boxes, Tag, Store } from 'lucide-react';
// Removed dummy imports
import type { Product, Store as StoreType, BrandNavItem } from '@/lib/types';
import type { CorporateSetNavItem } from '@/lib/corporate-types';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import { usePriceVisibility } from '@/context/PriceVisibilityContext';
import { cn } from '@/lib/utils';

interface MegaMenuProps {
  isOpen: boolean;
  onClose: () => void;
  products?: Product[];
  brands?: BrandNavItem[];
  stores?: StoreType[];
  sets?: CorporateSetNavItem[];
}


export function MegaMenu({ isOpen, onClose, brands: brandsProp, stores: storesProp, sets: setsProp }: MegaMenuProps) {
  const showPrices = usePriceVisibility();
  const BRANDS = brandsProp || [];
  const STORES = storesProp || [];
  const SETS = setsProp || [];

  const [activeTab, setActiveTab] = useState<'sets' | 'brands' | 'stores'>('sets');
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset index when tab changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [activeTab]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const tabs = [
    { id: 'sets' as const, label: 'Sets Corporativos', icon: Boxes },
    { id: 'brands' as const, label: 'Marcas', icon: Tag },
    { id: 'stores' as const, label: 'Sucursales', icon: Store },
  ];

  const getCarouselItems = () => {
    switch (activeTab) {
      case 'sets':
        return {
          sections: [{
            title: 'Sets Corporativos',
            items: SETS,
            type: 'set' as const,
          }]
        };
      case 'brands':
        return {
          sections: [{
            title: 'Nuestras Marcas',
            items: BRANDS.map(brand => ({
              id: brand.name,
              name: brand.name,
              slug: brand.name.toLowerCase().replace(/\s+/g, '-'),
              logoUrl: brand.logoUrl,
            })),
            type: 'brand' as const
          }]
        };
      case 'stores':
        return {
          sections: [{ 
            title: 'Nuestras Sucursales', 
            items: STORES.map(store => ({ 
              id: store.id, 
              name: store.name, 
              address: store.address,
              hours: store.hours,
              isMain: store.isMain
            })), 
            type: 'store' as const 
          }]
        };
    }
  };

  const { sections } = getCarouselItems();
  const currentSection = sections[currentIndex];

  const goToNext = () => {
    setCurrentIndex(prev => (prev + 1) % sections.length);
  };

  const goToPrev = () => {
    setCurrentIndex(prev => (prev - 1 + sections.length) % sections.length);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-40">
      {/* MegaMenu Panel */}
      <div
        ref={containerRef}
        className="fixed left-0 right-0 top-[56px] sm:top-[64px] bg-white shadow-2xl animate-in slide-in-from-top-2 duration-200"
      >
        {/* Tabs */}
        <div className="border-b border-[#E5E5E5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-1 sm:gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-all border-b-2',
                      activeTab === tab.id
                        ? 'border-[#111111] text-[#111111]'
                        : 'border-transparent text-gray-500 hover:text-[#111111] hover:bg-[#F5F5F7]'
                    )}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Section Header with Navigation */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg sm:text-xl font-bold text-[#111111]">
              {currentSection.title}
            </h3>
            <div className="flex items-center gap-2">
              {/* Section Dots */}
              {sections.length > 1 && (
                <div className="flex items-center gap-1.5 mr-4">
                  {sections.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={cn(
                        'h-2 rounded-full transition-all duration-300',
                        currentIndex === idx ? 'bg-[#111111] w-6' : 'bg-gray-300 w-2 hover:bg-gray-400'
                      )}
                    />
                  ))}
                </div>
              )}
              {/* Navigation Arrows */}
              {sections.length > 1 && (
                <>
                  <button
                    onClick={goToPrev}
                    className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full border border-[#E5E5E5] hover:border-[#111111] hover:bg-[#111111] hover:text-white transition-all"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={goToNext}
                    className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full border border-[#E5E5E5] hover:border-[#111111] hover:bg-[#111111] hover:text-white transition-all"
                  >
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Carousel Content */}
          <div className="overflow-hidden">
            <div 
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {sections.map((section, sectionIdx) => (
                <div 
                  key={sectionIdx}
                  className="w-full flex-shrink-0"
                >
                  {section.type === 'set' && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
                      {section.items.map((set: CorporateSetNavItem) => (
                        <Link
                          key={set.id}
                          href={`/corporativo/s/${set.slug}`}
                          onClick={onClose}
                          className="group"
                        >
                          <div className="relative aspect-product bg-[#F5F5F7] rounded-lg overflow-hidden mb-1 sm:mb-1.5">
                            <MediaGridThumb
                              item={set.cover ?? undefined}
                              fallback="/images/placeholder-product.jpg"
                              alt={set.name}
                              sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, 12vw"
                              fit="cover"
                              className="object-contain group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <p className="font-sans text-[10px] leading-tight font-medium text-[#111111] line-clamp-2 group-hover:underline">{set.name}</p>
                          {showPrices && set.referencePrice !== null && (
                            <p className="font-sans text-[10px] leading-tight font-semibold mt-0.5">
                              ${set.referencePrice.toFixed(2)}
                            </p>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}

                  {section.type === 'brand' && (
                    <div className="flex flex-wrap gap-3 items-center">
                      {section.items.map((brand: any) => (
                        <Link
                          key={brand.id}
                          href={`/catalogo?brand=${encodeURIComponent(brand.name)}`}
                          onClick={onClose}
                          className="group p-1"
                        >
                          <div className="aspect-square max-w-[60px] sm:max-w-[80px] flex items-center justify-center">
                            {brand.logoUrl ? (
                              <img
                                src={brand.logoUrl}
                                alt={brand.name}
                                className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const fallback = document.createElement('div');
                                    fallback.className = 'text-sm font-bold text-[#111111] group-hover:opacity-70 text-center';
                                    fallback.textContent = brand.name;
                                    parent.appendChild(fallback);
                                  }
                                }}
                              />
                            ) : (
                              <span className="text-sm font-bold text-[#111111] group-hover:opacity-70 text-center">
                                {brand.name}
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {section.type === 'store' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {section.items.map((store: any) => (
                        <a
                          key={store.id}
                          href={`https://maps.google.com/?q=${encodeURIComponent(store.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={onClose}
                          className="group flex items-start gap-3 sm:gap-4 p-4 bg-[#F5F5F7] rounded-xl hover:bg-[#111111] transition-colors"
                        >
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-[#111111]" strokeWidth={1.5} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-[#111111] group-hover:text-white truncate">
                                {store.name}
                              </p>
                              {store.isMain && (
                                <span className="px-2 py-0.5 bg-[#111111] group-hover:bg-white text-white group-hover:text-[#111111] text-[10px] font-bold rounded-full flex-shrink-0">
                                  MATRIZ
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 group-hover:text-gray-300 line-clamp-2 mb-1">
                              {store.address}
                            </p>
                            <p className="text-xs text-gray-400 group-hover:text-gray-400">
                              {store.hours}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* View All Link */}
          <div className="mt-6 sm:mt-8 pt-4 border-t border-[#E5E5E5]">
            <Link
              href={activeTab === 'stores' ? '/sucursales' : activeTab === 'brands' ? '/catalogo' : '/corporativo'}
              onClick={onClose}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#111111] hover:underline"
            >
              Ver todo
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

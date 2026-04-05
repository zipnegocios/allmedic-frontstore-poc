import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MapPin, Tag, Package, Store } from 'lucide-react';
import { PRODUCTS, BRANDS, STORES } from '@/lib/dummy-data';
import { cn } from '@/lib/utils';

interface MegaMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

// Get featured products (best sellers)
const getFeaturedProducts = () => PRODUCTS.filter(p => p.isBestSeller).slice(0, 6);

// Get new arrivals
const getNewArrivals = () => PRODUCTS.filter(p => p.isNew).slice(0, 6);

// Get products by category
const getProductsByCategory = (category: string) => 
  PRODUCTS.filter(p => p.category === category).slice(0, 6);

export function MegaMenu({ isOpen, onClose }: MegaMenuProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'brands' | 'stores'>('products');
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
    { id: 'products' as const, label: 'Productos', icon: Package },
    { id: 'brands' as const, label: 'Marcas', icon: Tag },
    { id: 'stores' as const, label: 'Sucursales', icon: Store },
  ];

  const getCarouselItems = () => {
    switch (activeTab) {
      case 'products':
        return {
          sections: [
            { title: 'Más Solicitados', items: getFeaturedProducts(), type: 'product' as const },
            { title: 'Nuevos Ingresos', items: getNewArrivals(), type: 'product' as const },
            { title: 'Camisas', items: getProductsByCategory('Camisas'), type: 'product' as const },
            { title: 'Pantalones', items: getProductsByCategory('Pantalones'), type: 'product' as const },
          ]
        };
      case 'brands':
        return {
          sections: [{ 
            title: 'Nuestras Marcas', 
            items: BRANDS.map(brand => ({ 
              id: brand, 
              name: brand, 
              slug: brand.toLowerCase().replace(/\s+/g, '-'),
              productCount: PRODUCTS.filter(p => p.brand === brand).length
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
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* MegaMenu Panel */}
      <div 
        ref={containerRef}
        className="absolute top-[56px] sm:top-[64px] left-0 right-0 bg-white shadow-2xl animate-in slide-in-from-top-2 duration-200"
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
                  {section.type === 'product' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                      {section.items.map((product: any) => (
                        <Link
                          key={product.id}
                          to={`/p/${product.slug}`}
                          onClick={onClose}
                          className="group"
                        >
                          <div className="aspect-[3/4] bg-[#F5F5F7] rounded-lg overflow-hidden mb-2 sm:mb-3">
                            <img
                              src={product.variants[0]?.images[0] || '/images/placeholder-product.jpg'}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <p className="text-xs text-gray-400 uppercase mb-0.5">{product.brand}</p>
                          <p className="text-sm font-medium text-[#111111] line-clamp-2 group-hover:underline">{product.name}</p>
                          <p className="text-sm font-semibold mt-1">
                            ${(product.priceSale || product.priceNormal).toFixed(2)}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}

                  {section.type === 'brand' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                      {section.items.map((brand: any) => (
                        <Link
                          key={brand.id}
                          to={`/catalogo?brand=${encodeURIComponent(brand.name)}`}
                          onClick={onClose}
                          className="group bg-[#F5F5F7] rounded-xl p-4 sm:p-6 hover:bg-[#111111] transition-colors"
                        >
                          <div className="aspect-square max-w-[60px] sm:max-w-[80px] mx-auto mb-3 flex items-center justify-center">
                            <img
                              src={`/images/brands/${brand.name.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '')}.png`}
                              alt={brand.name}
                              className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  const fallback = document.createElement('div');
                                  fallback.className = 'text-lg font-bold text-[#111111] group-hover:text-white text-center';
                                  fallback.textContent = brand.name;
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          </div>
                          <p className="text-sm font-semibold text-[#111111] group-hover:text-white text-center mb-1">
                            {brand.name}
                          </p>
                          <p className="text-xs text-gray-500 group-hover:text-gray-300 text-center">
                            {brand.productCount} productos
                          </p>
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
              to={activeTab === 'stores' ? '/sucursales' : activeTab === 'brands' ? '/catalogo' : '/catalogo'}
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

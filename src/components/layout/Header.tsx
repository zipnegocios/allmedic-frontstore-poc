'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Search, ShoppingBag, X, ChevronRight, Menu, MapPin, Tag, Home, Grid3X3, Building2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
// Removed dummy search import
import { MegaMenu } from './MegaMenu';
import { CorporateNavCTA } from './CorporateNavCTA';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import { usePriceVisibility } from '@/context/PriceVisibilityContext';
import type { Product, Store, BrandNavItem } from '@/lib/types';
import type { CorporateSetNavItem } from '@/lib/corporate-types';
import { cn } from '@/lib/utils';
import { resolveCoverMedia } from '@/lib/product-cover';

interface HeaderProps {
  onCartClick: () => void;
  products?: Product[];
  brands?: BrandNavItem[];
  stores?: Store[];
  corporateSets?: CorporateSetNavItem[];
}

const navLinks = [
  { label: 'Inicio', href: '/', icon: Home },
  { label: 'Catálogo', href: '/catalogo', icon: Tag },
  { label: 'Marcas', href: '/marcas', icon: Tag },
  { label: 'Tiendas', href: '/sucursales', icon: MapPin },
];

export function Header({ onCartClick, products, brands, stores, corporateSets }: HeaderProps) {
  const { totalItems } = useCart();
  const showPrices = usePriceVisibility();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [megaMenuOpenedBy, setMegaMenuOpenedBy] = useState<'hover' | 'click' | null>(null);
  const isMegaMenuOpen = megaMenuOpenedBy !== null;
  const megaMenuContainerRef = useRef<HTMLDivElement>(null);
  const megaMenuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeMegaMenu = () => {
    if (megaMenuCloseTimeoutRef.current) {
      clearTimeout(megaMenuCloseTimeoutRef.current);
      megaMenuCloseTimeoutRef.current = null;
    }
    setMegaMenuOpenedBy(null);
  };

  // Núcleo común: cancela cierre pendiente y fija modo 'hover' sin pisar 'click'.
  const openMegaMenuInHoverMode = () => {
    if (megaMenuCloseTimeoutRef.current) {
      clearTimeout(megaMenuCloseTimeoutRef.current);
      megaMenuCloseTimeoutRef.current = null;
    }
    setMegaMenuOpenedBy((prev) => (prev === 'click' ? prev : 'hover'));
  };

  // Solo para onMouseEnter: en touch el guard evita que el hover "fantasma" abra el panel.
  const openMegaMenuByHover = () => {
    if (typeof window !== 'undefined' && !window.matchMedia('(hover: hover)').matches) return;
    openMegaMenuInHoverMode();
  };

  // Solo para onFocus: el foco de teclado debe abrir el panel siempre, sin importar el
  // tipo de puntero del dispositivo (accesibilidad en tablet/touch con teclado externo).
  const openMegaMenuByFocus = () => {
    openMegaMenuInHoverMode();
  };

  const scheduleMegaMenuHoverClose = () => {
    setMegaMenuOpenedBy((prev) => {
      if (prev !== 'hover') return prev;
      megaMenuCloseTimeoutRef.current = setTimeout(() => {
        setMegaMenuOpenedBy((current) => (current === 'hover' ? null : current));
      }, 180);
      return prev;
    });
  };

  const toggleMegaMenuByClick = () => {
    setMegaMenuOpenedBy((prev) => (prev !== null ? null : 'click'));
  };

  // Click-outside: solo cierra si el panel fue fijado por click (modo hover se cierra por mouseleave).
  useEffect(() => {
    if (megaMenuOpenedBy !== 'click') return;
    const handleClickOutside = (e: MouseEvent) => {
      if (megaMenuContainerRef.current && !megaMenuContainerRef.current.contains(e.target as Node)) {
        closeMegaMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [megaMenuOpenedBy]);

  // Limpieza del timeout de cierre por hover al desmontar.
  useEffect(() => {
    return () => {
      if (megaMenuCloseTimeoutRef.current) clearTimeout(megaMenuCloseTimeoutRef.current);
    };
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Handle scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (searchQuery.length >= 2) {
      searchDebounceRef.current = setTimeout(() => {
        let results: Product[];
        if (products) {
          const q = searchQuery.toLowerCase();
          results = products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            (p.productType?.name.toLowerCase().includes(q) ?? false) ||
            p.colors.some(c => c.name.toLowerCase().includes(q))
          );
        } else {
          results = [];
        }
        setSearchResults(results.slice(0, 6));
      }, 200);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/catalogo?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const popularSearches = ['Navy', 'Black', 'Scrub', 'Uniforme'];

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <>
      {/* Main Header */}
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          isScrolled
            ? 'bg-white/95 backdrop-blur-md shadow-sm'
            : 'bg-white'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 -ml-2 hover:bg-[#F5F5F7] rounded-full transition-colors"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" strokeWidth={1.5} />
            </button>

            {/* Logo - Animated size on scroll */}
            <Link href="/" className="flex-shrink-0 transition-all duration-300">
              <img
                src="/images/allmedic_logo_black.png"
                alt="AllMedic Uniforms"
                width={160}
                height={48}
                className={cn(
                  'w-auto transition-all duration-300',
                  isScrolled ? 'h-7 sm:h-8' : 'h-10 sm:h-12'
                )}
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {/* MegaMenu trigger container - hover en desktop, click fijo en touch, con panel anidado */}
              <div
                ref={megaMenuContainerRef}
                className="relative"
                onMouseEnter={openMegaMenuByHover}
                onMouseLeave={scheduleMegaMenuHoverClose}
                onFocus={openMegaMenuByFocus}
                onBlur={(e) => {
                  if (!megaMenuContainerRef.current?.contains(e.relatedTarget as Node)) {
                    closeMegaMenu();
                  }
                }}
              >
                <button
                  onClick={toggleMegaMenuByClick}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 font-sans text-body-lg rounded-full transition-all duration-200',
                    isMegaMenuOpen
                      ? 'bg-[#111111] text-white'
                      : 'text-[#333333] hover:bg-[#F5F5F7] hover:text-[#111111]'
                  )}
                >
                  <Grid3X3 className="w-4 h-4" strokeWidth={1.5} />
                  Explorar
                </button>

                <MegaMenu
                  isOpen={isMegaMenuOpen}
                  onClose={closeMegaMenu}
                  products={products}
                  brands={brands}
                  stores={stores}
                  sets={corporateSets}
                />
              </div>

              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'px-4 py-2 font-sans text-body-lg rounded-full transition-all duration-200',
                    isActive(link.href)
                      ? 'bg-[#111111] text-white'
                      : 'text-[#333333] hover:bg-[#F5F5F7] hover:text-[#111111]'
                  )}
                >
                  {link.label}
                </Link>
              ))}

              <CorporateNavCTA className="ml-1" />
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Search Button */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors"
                aria-label="Buscar"
              >
                <Search className="w-5 h-5" strokeWidth={1.5} />
              </button>

              {/* Cart Button */}
              <button
                onClick={onCartClick}
                className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors relative"
                aria-label="Carrito"
              >
                <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
                {isMounted && totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#FF3B30] text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden transition-opacity duration-300',
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* Menu Panel */}
        <div
          className={cn(
            'absolute top-0 left-0 h-full w-[280px] max-w-[85vw] bg-white shadow-2xl',
            'transition-transform duration-300 ease-out',
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#E5E5E5]">
            <img
              src="/images/allmedic_logo_black.png"
              alt="AllMedic Uniforms"
              width={160}
              height={28}
              className="h-7 w-auto"
            />
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors"
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Menu Links */}
          <nav className="p-4">
            <ul className="space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                        isActive(link.href)
                          ? 'bg-[#111111] text-white'
                          : 'text-[#333333] hover:bg-[#F5F5F7]'
                      )}
                    >
                      <Icon className="w-5 h-5" strokeWidth={1.5} />
                      <span className="font-medium">{link.label}</span>
                      {isActive(link.href) && (
                        <ChevronRight className="w-4 h-4 ml-auto" strokeWidth={1.5} />
                      )}
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link
                  href="/corporativo"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                    isActive('/corporativo')
                      ? 'bg-[#111111] text-white'
                      : 'text-[#333333] hover:bg-[#F5F5F7]'
                  )}
                >
                  <Building2 className="w-5 h-5" strokeWidth={1.5} />
                  <span className="font-medium">Ventas al Mayor</span>
                  {isActive('/corporativo') && (
                    <ChevronRight className="w-4 h-4 ml-auto" strokeWidth={1.5} />
                  )}
                </Link>
              </li>
            </ul>
          </nav>

          {/* Menu Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#E5E5E5] bg-white">
            <a
              href="https://wa.me/13164695701"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] text-white font-medium rounded-xl"
            >
              Contactar por WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* Search Modal */}
      <div
        className={cn(
          'fixed inset-0 z-50 transition-opacity duration-300',
          isSearchOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsSearchOpen(false)} />

        {/* Search Panel */}
        <div
          className={cn(
            'absolute top-0 left-0 right-0 bg-white shadow-lg transition-transform duration-300',
            isSearchOpen ? 'translate-y-0' : '-translate-y-full'
          )}
        >
          <div className="max-w-3xl mx-auto px-4 py-4 sm:py-6">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" strokeWidth={1.5} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar productos, marcas, colores..."
                className="w-full pl-12 pr-12 py-3 sm:py-4 text-base sm:text-lg bg-[#F5F5F7] rounded-full focus:outline-none focus:ring-2 focus:ring-[#111111]"
                autoFocus={isSearchOpen}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-16 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full"
                >
                  <X className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-200 rounded-full"
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </form>

            {/* Search Results */}
            <div className="mt-4 sm:mt-6 max-h-[60vh] overflow-y-auto">
              {searchQuery.length >= 2 ? (
                searchResults.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">
                      Resultados de búsqueda
                    </p>
                    {searchResults.map(product => (
                      <Link
                        key={product.id}
                        href={`/p/${product.slug}`}
                        onClick={() => {
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="flex items-center gap-3 sm:gap-4 p-3 hover:bg-[#F5F5F7] rounded-lg transition-colors"
                      >
                        <div className="relative w-12 h-16 sm:w-14 sm:h-18 bg-[#F5F5F7] rounded overflow-hidden flex-shrink-0">
                          <MediaGridThumb
                            item={resolveCoverMedia(product)}
                            fallback="/images/placeholder-product.jpg"
                            alt={product.name}
                            sizes="56px"
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 uppercase">{product.brand}</p>
                          <p className="text-sm font-medium text-[#111111] truncate">{product.name}</p>
                        </div>
                        {showPrices && (
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              ${(product.priceSale || product.priceNormal).toFixed(2)}
                            </p>
                          </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                      </Link>
                    ))}
                    <Link
                      href={`/catalogo?q=${encodeURIComponent(searchQuery)}`}
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="flex items-center justify-center gap-2 p-3 text-sm font-medium text-[#111111] hover:bg-[#F5F5F7] rounded-lg transition-colors"
                    >
                      Ver todos los resultados
                      <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No encontramos resultados para "{searchQuery}"</p>
                  </div>
                )
              ) : (
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">
                    Búsquedas populares
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {popularSearches.map(term => (
                      <button
                        key={term}
                        onClick={() => {
                          setSearchQuery(term);
                          router.push(`/catalogo?q=${encodeURIComponent(term)}`);
                          setIsSearchOpen(false);
                        }}
                        className="px-4 py-2 text-sm bg-[#F5F5F7] rounded-full hover:bg-gray-200 transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </>
  );
}

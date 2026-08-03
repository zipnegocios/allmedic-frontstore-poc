'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Search, X, ChevronRight, Menu, MapPin, Tag, Home, Grid3X3, Building2 } from 'lucide-react';
// Removed dummy search import
import { MegaMenu } from './MegaMenu';
import { CorporateNavCTA } from './CorporateNavCTA';
import { CorporateAccountLink } from '@/components/corporate/CorporateAccountLink';
import { CorporateCartButton } from '@/components/corporate/CorporateCartButton';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import { usePriceVisibility } from '@/context/PriceVisibilityContext';
import { suggestClosestMatch } from '@/lib/fuzzy-match';
import { findSearchMatchedColorId } from '@/lib/set-filter-logic';
import { resolveCardCover } from '@/lib/resolve-card-cover';
import type { Product, Store, BrandNavItem } from '@/lib/types';
import type { CorporateSetNavItem } from '@/lib/corporate-types';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onCartClick: () => void;
  onCorporateCartClick: () => void;
  products?: Product[];
  brands?: BrandNavItem[];
  stores?: Store[];
  corporateSets?: CorporateSetNavItem[];
}

const navLinks = [
  { label: 'Inicio', href: '/', icon: Home },
  { label: 'Marcas', href: '/marcas', icon: Tag },
  { label: 'Tiendas', href: '/sucursales', icon: MapPin },
];

// Renombrado de "Catálogo" a "Productos" para cuando se reactive la venta individual —
// no se incluye en `navLinks` mientras el sitio solo vende sets corporativos.
// { label: 'Productos', href: '/catalogo', icon: Tag },

// `onCartClick` ya no dispara ningún trigger visual en este Header (el shopping bag individual
// se quitó) — se mantiene en la interfaz porque AppShell.tsx sigue pasándola y CartDrawer sigue
// montado; no se destructura para no generar un error de parámetro no usado.
export function Header({ onCorporateCartClick, products, brands, stores, corporateSets }: HeaderProps) {
  const showPrices = usePriceVisibility();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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
  const [searchResults, setSearchResults] = useState<CorporateSetNavItem[]>([]);
  const [searchSuggestion, setSearchSuggestion] = useState<string | null>(null);
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
        let results: CorporateSetNavItem[];
        if (corporateSets) {
          const q = searchQuery.toLowerCase();
          results = corporateSets.filter(s => {
            const haystack = [
              s.name,
              s.brandName ?? '',
              ...s.pieceCodes,
              ...s.colors.map((c) => c.code),
              ...s.colors.map((c) => c.name),
              ...s.collections,
              ...s.productTypes,
              ...Object.values(s.availableStyles).flat(),
            ]
              .join(' ')
              .toLowerCase();
            return haystack.includes(q);
          });
        } else {
          results = [];
        }
        setSearchResults(results.slice(0, 6));
        if (results.length === 0 && corporateSets) {
          const allWords = corporateSets.flatMap((s) => [
            s.name,
            s.brandName ?? '',
            ...s.pieceCodes,
            ...s.colors.map((c) => c.code),
            ...s.colors.map((c) => c.name),
            ...s.collections,
            ...s.productTypes,
            ...Object.values(s.availableStyles).flat(),
          ]);
          setSearchSuggestion(suggestClosestMatch(searchQuery, allWords));
        } else {
          setSearchSuggestion(null);
        }
      }, 200);
    } else {
      setSearchResults([]);
      setSearchSuggestion(null);
    }

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, corporateSets]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/corporativo?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  // Un ejemplo real por cada tipo de parámetro que soporta la búsqueda — no son "búsquedas
  // populares" (no trackeamos consultas), es una muestra de qué se puede escribir en la caja.
  // Se toma el primer valor no vacío presente en `corporateSets` para que el ejemplo siempre
  // devuelva resultados reales al clickearlo.
  const searchExamples = (() => {
    if (!corporateSets) return [];
    const examples: { label: string; value: string }[] = [];
    const firstColor = corporateSets.flatMap((s) => s.colors).find((c) => c.name);
    if (firstColor) examples.push({ label: 'Color', value: firstColor.name });
    const firstCode = corporateSets.flatMap((s) => s.pieceCodes).find((c) => c);
    if (firstCode) examples.push({ label: 'Código', value: firstCode });
    const firstCollection = corporateSets.flatMap((s) => s.collections).find((c) => c);
    if (firstCollection) examples.push({ label: 'Colección', value: firstCollection });
    const firstBrand = corporateSets.map((s) => s.brandName).find((b): b is string => !!b);
    if (firstBrand) examples.push({ label: 'Marca', value: firstBrand });
    return examples;
  })();

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

              {/* Corporate account (Mi cuenta / Iniciar sesión) */}
              <CorporateAccountLink />

              {/* Corporate cart */}
              <CorporateCartButton onClick={onCorporateCartClick} />
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
                placeholder="Buscar sets, marcas, colección, color o código de producto."
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
                    {searchResults.map(set => {
                      // Si el texto buscado matchea un color del set, se usa la portada de
                      // ESE color (mismo comportamiento que el grid de `/corporativo`) — así
                      // buscar "Navy" o un código de color muestra el thumbnail en ese color.
                      const matchedColorId = findSearchMatchedColorId(set, searchQuery);
                      const { cover } = resolveCardCover(set, matchedColorId);
                      return (
                        <Link
                          key={set.id}
                          href={`/corporativo/s/${set.slug}`}
                          onClick={() => {
                            setIsSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="flex items-center gap-3 sm:gap-4 p-3 hover:bg-[#F5F5F7] rounded-lg transition-colors"
                        >
                          <div className="relative w-12 h-16 sm:w-14 sm:h-18 bg-[#F5F5F7] rounded overflow-hidden flex-shrink-0">
                            <MediaGridThumb
                              item={cover ?? undefined}
                              fallback="/images/placeholder-product.jpg"
                              alt={set.name}
                              sizes="56px"
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            {set.brandName && <p className="text-xs text-gray-400 uppercase">{set.brandName}</p>}
                            <p className="text-sm font-medium text-[#111111] truncate">{set.name}</p>
                          </div>
                          {showPrices && set.referencePrice !== null && (
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                ${set.referencePrice.toFixed(2)}
                              </p>
                            </div>
                          )}
                          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                        </Link>
                      );
                    })}
                    <Link
                      href={`/corporativo?q=${encodeURIComponent(searchQuery)}`}
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
                    <p className="text-gray-500">No encontramos resultados para &quot;{searchQuery}&quot;</p>
                    {searchSuggestion && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery(searchSuggestion)}
                        className="mt-2 text-sm text-[#111111] font-medium hover:underline"
                      >
                        ¿Usted quizás quiso decir: <span className="underline">{searchSuggestion}</span>?
                      </button>
                    )}
                  </div>
                )
              ) : (
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">
                    Ejemplo
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {searchExamples.map(({ label, value }) => (
                      <button
                        key={label}
                        onClick={() => {
                          setSearchQuery(value);
                          router.push(`/corporativo?q=${encodeURIComponent(value)}`);
                          setIsSearchOpen(false);
                        }}
                        className="px-4 py-2 text-sm bg-[#F5F5F7] rounded-full hover:bg-gray-200 transition-colors"
                      >
                        <span className="text-gray-400">{label}:</span> {value}
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

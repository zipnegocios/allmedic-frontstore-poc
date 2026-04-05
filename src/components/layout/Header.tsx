import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, X, ChevronRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { searchProducts } from '@/lib/dummy-data';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onCartClick: () => void;
}

export function Header({ onCartClick }: HeaderProps) {
  const { totalItems } = useCart();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  // Handle scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (searchQuery.length >= 3) {
      searchDebounceRef.current = setTimeout(() => {
        const results = searchProducts(searchQuery);
        setSearchResults(results.slice(0, 6));
      }, 250);
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
      navigate(`/catalogo?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const popularSearches = ['FIGS', 'Cherokee', 'Navy', 'Black', 'Scrub'];

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
          isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm' : 'bg-white'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex-shrink-0">
              <img
                src="/images/allmedic_logo_black.png"
                alt="AllMedic Uniforms"
                className="h-8 w-auto"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <Link
                to="/catalogo"
                className="text-sm font-medium text-[#333333] hover:text-[#111111] transition-colors"
              >
                Catálogo
              </Link>
              <Link
                to="/sucursales"
                className="text-sm font-medium text-[#333333] hover:text-[#111111] transition-colors"
              >
                Tiendas
              </Link>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Search Button */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors"
              >
                <Search className="w-5 h-5" strokeWidth={1.5} />
              </button>

              {/* Cart Button */}
              <button
                onClick={onCartClick}
                className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors relative"
              >
                <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#FF3B30] text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search Modal */}
      <div
        className={cn(
          'fixed inset-0 z-50 transition-opacity duration-300',
          isSearchOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" onClick={() => setIsSearchOpen(false)} />

        {/* Search Panel */}
        <div
          className={cn(
            'absolute top-0 left-0 right-0 bg-white shadow-lg transition-transform duration-300',
            isSearchOpen ? 'translate-y-0' : '-translate-y-full'
          )}
        >
          <div className="max-w-3xl mx-auto px-4 py-6">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" strokeWidth={1.5} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {}}
                placeholder="Buscar productos, marcas, colores..."
                className="w-full pl-12 pr-12 py-4 text-lg bg-[#F5F5F7] rounded-full focus:outline-none focus:ring-2 focus:ring-[#111111]"
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
            <div className="mt-6">
              {searchQuery.length >= 3 ? (
                searchResults.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">
                      Resultados de búsqueda
                    </p>
                    {searchResults.map(product => (
                      <Link
                        key={product.id}
                        to={`/p/${product.slug}`}
                        onClick={() => {
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="flex items-center gap-4 p-3 hover:bg-[#F5F5F7] rounded-lg transition-colors"
                      >
                        <div className="w-10 h-12 bg-[#F5F5F7] rounded overflow-hidden flex-shrink-0">
                          <img
                            src={product.variants[0]?.images[0] || '/images/placeholder-product.jpg'}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 uppercase">{product.brand}</p>
                          <p className="text-sm font-medium text-[#111111] truncate">{product.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            ${(product.priceSale || product.priceNormal).toFixed(2)}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                      </Link>
                    ))}
                    <Link
                      to={`/catalogo?q=${encodeURIComponent(searchQuery)}`}
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
                          navigate(`/catalogo?q=${encodeURIComponent(term)}`);
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

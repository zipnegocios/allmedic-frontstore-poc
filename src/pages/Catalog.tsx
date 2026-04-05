import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Grid3X3, LayoutList, X } from 'lucide-react';
import { filterProducts } from '@/lib/dummy-data';
import { ProductCard } from '@/components/catalog/ProductCard';
import { FilterSidebar, FilterButton } from '@/components/catalog/FilterSidebar';
import type { CatalogFilters } from '@/lib/types';
import { cn } from '@/lib/utils';

type SortOption = 'relevance' | 'price-asc' | 'price-desc' | 'newest';

export function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');

  // Parse filters from URL
  const [filters, setFilters] = useState<CatalogFilters>(() => {
    const gender = searchParams.get('gender') as CatalogFilters['gender'];
    const brand = searchParams.get('brand');
    const category = searchParams.get('category');

    return {
      gender: gender || null,
      categories: category ? [category as any] : [],
      brands: brand ? [brand] : [],
      colors: [],
      sizes: [],
      fits: [],
      priceMin: 0,
      priceMax: 200,
    };
  });

  const [searchQuery] = useState(() => searchParams.get('q') || '');

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.gender) params.set('gender', filters.gender);
    if (filters.categories.length === 1) params.set('category', filters.categories[0]);
    if (filters.brands.length === 1) params.set('brand', filters.brands[0]);
    if (searchQuery) params.set('q', searchQuery);
    setSearchParams(params, { replace: true });
  }, [filters, searchQuery, setSearchParams]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let products = filterProducts({
      gender: filters.gender || undefined,
      categories: filters.categories.length > 0 ? filters.categories : undefined,
      brands: filters.brands.length > 0 ? filters.brands : undefined,
      colors: filters.colors.length > 0 ? filters.colors : undefined,
      sizes: filters.sizes.length > 0 ? filters.sizes : undefined,
      fits: filters.fits.length > 0 ? filters.fits : undefined,
      priceMin: filters.priceMin,
      priceMax: filters.priceMax,
    });

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      products = products.filter(
        p =>
          p.name.toLowerCase().includes(query) ||
          p.brand.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.colors.some(c => c.name.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'price-asc':
        products.sort((a, b) => (a.priceSale || a.priceNormal) - (b.priceSale || b.priceNormal));
        break;
      case 'price-desc':
        products.sort((a, b) => (b.priceSale || b.priceNormal) - (a.priceSale || a.priceNormal));
        break;
      case 'newest':
        products.sort((a, b) => (a.isNew === b.isNew ? 0 : a.isNew ? -1 : 1));
        break;
      default:
        // Relevance - keep original order
        break;
    }

    return products;
  }, [filters, sortBy]);

  const handleFilterChange = (newFilters: CatalogFilters) => {
    setFilters(newFilters);
  };

  const activeFilterCount =
    (filters.gender ? 1 : 0) +
    filters.categories.length +
    filters.brands.length +
    filters.colors.length +
    filters.sizes.length +
    filters.fits.length;

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <main className="min-h-screen bg-white pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Catálogo</h1>
          <p className="text-gray-500">
            {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''} encontrado
            {filteredProducts.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E5E5E5]">
          <div className="flex items-center gap-4">
            <FilterButton
              onClick={() => setIsFilterOpen(true)}
              count={activeFilterCount > 0 ? activeFilterCount : undefined}
            />
            {hasActiveFilters && (
              <button
                onClick={() =>
                  setFilters({
                    gender: null,
                    categories: [],
                    brands: [],
                    colors: [],
                    sizes: [],
                    fits: [],
                    priceMin: 0,
                    priceMax: 200,
                  })
                }
                className="hidden sm:flex items-center gap-1 text-sm text-gray-500 hover:text-[#111111] transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden sm:inline">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-sm border border-[#E5E5E5] rounded-lg px-3 py-2 focus:outline-none focus:border-[#111111]"
              >
                <option value="relevance">Relevancia</option>
                <option value="price-asc">Precio: menor a mayor</option>
                <option value="price-desc">Precio: mayor a menor</option>
                <option value="newest">Más recientes</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center border border-[#E5E5E5] rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'grid' ? 'bg-[#111111] text-white' : 'hover:bg-[#F5F5F7]'
                )}
              >
                <Grid3X3 className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'list' ? 'bg-[#111111] text-white' : 'hover:bg-[#F5F5F7]'
                )}
              >
                <LayoutList className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex gap-8">
          {/* Sidebar */}
          <FilterSidebar
            filters={filters}
            onFilterChange={handleFilterChange}
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
          />

          {/* Product Grid */}
          <div className="flex-1">
            {filteredProducts.length > 0 ? (
              <div
                className={cn(
                  'grid gap-4 md:gap-6',
                  viewMode === 'grid'
                    ? 'grid-cols-2 md:grid-cols-3'
                    : 'grid-cols-1'
                )}
              >
                {filteredProducts.map((product) => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    selectedFilterColor={filters.colors.length === 1 ? filters.colors[0] : null}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="w-16 h-16 text-gray-300 mb-4" strokeWidth={1.5} />
                <h3 className="text-lg font-medium text-[#111111] mb-2">
                  No encontramos resultados
                </h3>
                <p className="text-gray-500 max-w-md mb-6">
                  Intenta ajustar tus filtros o busca con términos diferentes
                </p>
                <button
                  onClick={() =>
                    setFilters({
                      gender: null,
                      categories: [],
                      brands: [],
                      colors: [],
                      sizes: [],
                      fits: [],
                      priceMin: 0,
                      priceMax: 200,
                    })
                  }
                  className="px-6 py-2 bg-[#111111] text-white text-sm font-medium rounded-full hover:opacity-80 transition-opacity"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

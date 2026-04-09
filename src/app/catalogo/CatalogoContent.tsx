'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCard } from '@/components/catalog/ProductCard';
import { FilterSidebar, FilterButton } from '@/components/catalog/FilterSidebar';
import { LayoutSwitcher, ProductListItem, type ViewMode } from '@/components/catalog/LayoutSwitcher';
import type { CatalogFilters, Product, ProductColor } from '@/lib/types';
import { cn } from '@/lib/utils';

type SortOption = 'relevance' | 'price-asc' | 'price-desc' | 'newest';

interface CatalogoContentProps {
  initialProducts: Product[];
  brandNames: string[];
  availableColors: ProductColor[];
}

export function CatalogoContent({ initialProducts, brandNames, availableColors }: CatalogoContentProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white pt-16 flex items-center justify-center">Cargando catalogo...</div>}>
      <CatalogoInner initialProducts={initialProducts} brandNames={brandNames} availableColors={availableColors} />
    </Suspense>
  );
}

function CatalogoInner({ initialProducts, brandNames, availableColors }: CatalogoContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid-1');
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [gridSearchQuery, setGridSearchQuery] = useState('');

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

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortBy, itemsPerPage, searchQuery, gridSearchQuery]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.gender) params.set('gender', filters.gender);
    if (filters.categories.length === 1) params.set('category', filters.categories[0]);
    if (filters.brands.length === 1) params.set('brand', filters.brands[0]);
    if (searchQuery) params.set('q', searchQuery);
    const queryString = params.toString();
    router.replace(`/catalogo${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }, [filters, searchQuery, router]);

  const filteredProducts = useMemo(() => {
    let products = [...initialProducts];

    // Apply filters client-side
    if (filters.gender) {
      products = products.filter(p => p.gender === filters.gender || p.gender === 'Unisex');
    }
    if (filters.categories.length > 0) {
      products = products.filter(p => filters.categories.includes(p.category));
    }
    if (filters.brands.length > 0) {
      products = products.filter(p => filters.brands.includes(p.brand));
    }
    if (filters.colors.length > 0) {
      products = products.filter(p => p.colors.some(c => filters.colors.includes(c.name)));
    }
    if (filters.sizes.length > 0) {
      products = products.filter(p => p.availableSizes.some(s => filters.sizes.includes(s)));
    }
    if (filters.fits.length > 0) {
      products = products.filter(p => p.availableFits?.some(f => filters.fits.includes(f)));
    }
    if (filters.priceMin > 0 || filters.priceMax < 200) {
      products = products.filter(p => {
        const price = p.priceSale || p.priceNormal;
        return price >= filters.priceMin && price <= filters.priceMax;
      });
    }

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

    if (gridSearchQuery) {
      const query = gridSearchQuery.toLowerCase();
      products = products.filter(
        p =>
          p.name.toLowerCase().includes(query) ||
          p.brand.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.colors.some(c => c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query)) ||
          p.availableSizes.some(s => s.toLowerCase().includes(query)) ||
          p.variants.some(v => v.sku.toLowerCase().includes(query))
      );
    }

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
        break;
    }

    return products;
  }, [initialProducts, filters, sortBy, searchQuery, gridSearchQuery]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const handleFilterChange = (newFilters: CatalogFilters) => {
    setFilters(newFilters);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Catalogo</h1>
          <p className="text-gray-500">
            {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''} encontrado
            {filteredProducts.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#E5E5E5]">
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

          <div className="flex flex-wrap items-center gap-4">
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
                <option value="newest">Mas recientes</option>
              </select>
            </div>

            <div className="hidden sm:block">
              <LayoutSwitcher
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={setItemsPerPage}
                totalItems={filteredProducts.length}
                showAllColumns={true}
              />
            </div>
            <div className="sm:hidden">
              <LayoutSwitcher
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={setItemsPerPage}
                totalItems={filteredProducts.length}
                showAllColumns={false}
              />
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
            <input
              type="text"
              value={gridSearchQuery}
              onChange={(e) => setGridSearchQuery(e.target.value)}
              placeholder="Buscar en resultados..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111] transition-colors"
            />
            {gridSearchQuery && (
              <button
                onClick={() => setGridSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-3 h-3 text-gray-400" strokeWidth={1.5} />
              </button>
            )}
          </div>
          {gridSearchQuery && (
            <p className="text-xs text-gray-500 mt-2">
              {filteredProducts.length} resultado{filteredProducts.length !== 1 ? 's' : ''} para &quot;{gridSearchQuery}&quot;
            </p>
          )}
        </div>

        <div className="flex gap-8">
          <FilterSidebar
            filters={filters}
            onFilterChange={handleFilterChange}
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            brandNames={brandNames}
            availableColors={availableColors}
          />

          <div className="flex-1">
            {filteredProducts.length > 0 ? (
              <>
                <div
                  className={cn(
                    'grid gap-4 md:gap-6',
                    viewMode === 'grid-4' && 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
                    viewMode === 'grid-3' && 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3',
                    viewMode === 'grid-2' && 'grid-cols-2 lg:grid-cols-2',
                    viewMode === 'grid-1' && 'grid-cols-1 sm:grid-cols-2',
                    viewMode === 'list' && 'grid-cols-1'
                  )}
                >
                  {paginatedProducts.map((product) => (
                    viewMode === 'list' ? (
                      <ProductListItem
                        key={product.id}
                        product={product}
                        onQuickView={() => {}}
                      />
                    ) : (
                      <ProductCard
                        key={product.id}
                        product={product}
                        selectedFilterColor={filters.colors.length === 1 ? filters.colors[0] : null}
                      />
                    )
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#E5E5E5]">
                    <p className="text-sm text-gray-500">
                      Mostrando{' '}
                      <span className="font-medium text-[#111111]">
                        {(currentPage - 1) * itemsPerPage + 1}
                      </span>{' '}
                      -{' '}
                      <span className="font-medium text-[#111111]">
                        {Math.min(currentPage * itemsPerPage, filteredProducts.length)}
                      </span>{' '}
                      de{' '}
                      <span className="font-medium text-[#111111]">{filteredProducts.length}</span>{' '}
                      productos
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={cn(
                          'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          currentPage === 1
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-[#111111] hover:bg-[#F5F5F7]'
                        )}
                      >
                        <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                        <span className="hidden sm:inline">Anterior</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={cn(
                                'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                                currentPage === pageNum
                                  ? 'bg-[#111111] text-white'
                                  : 'text-[#111111] hover:bg-[#F5F5F7]'
                              )}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={cn(
                          'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          currentPage === totalPages
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-[#111111] hover:bg-[#F5F5F7]'
                        )}
                      >
                        <span className="hidden sm:inline">Siguiente</span>
                        <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="w-16 h-16 text-gray-300 mb-4" strokeWidth={1.5} />
                <h3 className="text-lg font-medium text-[#111111] mb-2">
                  No encontramos resultados
                </h3>
                <p className="text-gray-500 max-w-md mb-6">
                  Intenta ajustar tus filtros o busca con terminos diferentes
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

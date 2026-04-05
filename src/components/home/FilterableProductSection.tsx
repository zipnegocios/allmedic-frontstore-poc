import { useProductFilter } from '@/hooks/useProductFilter';
import { HierarchicalFilter } from './HierarchicalFilter';
import { Pagination } from './Pagination';
import { ProductCard } from '@/components/catalog/ProductCard';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FilterableProductSection() {
  const {
    filters,
    filterOptions,
    paginatedProducts,
    currentPage,
    totalPages,
    totalProducts,
    isLoading,
    hasActiveFilters,
    activeFilterCount,
    applyFilters,
    resetFilters,
    goToPage,
  } = useProductFilter(12);

  return (
    <section className="py-16 bg-[#F5F5F7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-[#111111] mb-2">
              Explora nuestro catálogo
            </h2>
            <p className="text-gray-500">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                  Cargando productos...
                </span>
              ) : (
                <>
                  <span className="font-medium text-[#111111]">{totalProducts}</span> productos disponibles
                  {hasActiveFilters && ' con los filtros seleccionados'}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <HierarchicalFilter
            filters={filters}
            filterOptions={filterOptions}
            onFilterChange={applyFilters}
            onReset={resetFilters}
            activeFilterCount={activeFilterCount}
            hasActiveFilters={hasActiveFilters}
          />
        </div>

        {/* Products Grid */}
        <div className={cn('relative min-h-[400px]', isLoading && 'opacity-60 pointer-events-none')}>
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex items-center gap-3 px-6 py-4 bg-white rounded-lg shadow-lg">
                <Loader2 className="w-6 h-6 animate-spin text-[#111111]" strokeWidth={1.5} />
                <span className="text-sm font-medium">Cargando productos...</span>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && paginatedProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 bg-[#F5F5F7] rounded-full flex items-center justify-center mb-4">
                <Search className="w-10 h-10 text-gray-300" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-medium text-[#111111] mb-2">
                No encontramos productos
              </h3>
              <p className="text-gray-500 max-w-md mb-6">
                Intenta ajustar los filtros para ver más resultados
              </p>
              <button
                onClick={resetFilters}
                className="px-6 py-2 bg-[#111111] text-white text-sm font-medium rounded-full hover:opacity-80 transition-opacity"
              >
                Limpiar filtros
              </button>
            </div>
          )}

          {/* Products */}
          {paginatedProducts.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {paginatedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                totalItems={totalProducts}
                itemsPerPage={12}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

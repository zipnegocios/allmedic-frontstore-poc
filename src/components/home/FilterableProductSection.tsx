'use client';

import { useState } from 'react';
import { useProductFilter } from '@/hooks/useProductFilter';
import { HierarchicalFilter } from './HierarchicalFilter';
import { Pagination } from './Pagination';
import { ProductCard } from '@/components/catalog/ProductCard';
import { ProductListItem } from '@/components/catalog/LayoutSwitcher';
import type { ViewMode } from '@/components/catalog/LayoutSwitcher';
import { LayoutSwitcher } from '@/components/catalog/LayoutSwitcher';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FilterableProductSection() {
  // Default to 4 columns on desktop, 1 column on mobile (handled by responsive classes)
  const [viewMode, setViewMode] = useState<ViewMode>('grid-4');
  const [itemsPerPage, setItemsPerPage] = useState<number>(12);
  const [gridSearchQuery, setGridSearchQuery] = useState('');
  
  const {
    filters,
    filterOptions,
    paginatedProducts: originalPaginatedProducts,
    currentPage,
    totalPages,
    totalProducts,
    isLoading,
    hasActiveFilters,
    activeFilterCount,
    applyFilters,
    resetFilters,
    goToPage,
  } = useProductFilter(itemsPerPage);

  // Apply dynamic grid search filter
  const paginatedProducts = gridSearchQuery 
    ? originalPaginatedProducts.filter(p => {
        const query = gridSearchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(query) ||
          p.brand.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.colors.some(c => c.name.toLowerCase().includes(query))
        );
      })
    : originalPaginatedProducts;

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
          
          {/* Layout Switcher */}
          <div className="hidden sm:block">
            <LayoutSwitcher
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              totalItems={totalProducts}
              showAllColumns={true}
            />
          </div>
          <div className="sm:hidden">
            <LayoutSwitcher
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              totalItems={totalProducts}
              showAllColumns={false}
            />
          </div>
        </div>

        {/* Dynamic Search Input */}
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
              {paginatedProducts.length} resultado{paginatedProducts.length !== 1 ? 's' : ''} para "{gridSearchQuery}"
            </p>
          )}
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
              <div className={cn(
                'grid gap-4 md:gap-6',
                // Desktop view modes (4, 3, 2 cols)
                viewMode === 'grid-4' && 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4',
                viewMode === 'grid-3' && 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3',
                viewMode === 'grid-2' && 'grid-cols-2 lg:grid-cols-2',
                // Mobile view modes (1, 2 cols)
                viewMode === 'grid-1' && 'grid-cols-1 sm:grid-cols-2',
                viewMode === 'list' && 'grid-cols-1'
              )}>
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
                      selectedFilterColor={filters.color ? filters.color : null}
                    />
                  )
                ))}
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                totalItems={totalProducts}
                itemsPerPage={itemsPerPage}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

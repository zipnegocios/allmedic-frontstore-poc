'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Star, AlertTriangle, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CorporateSetSummary } from '@/lib/corporate-types';
import { resolveRules, type BusinessRule } from '@/lib/rules-engine';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import { LayoutSwitcher, type ViewMode } from '@/components/catalog/LayoutSwitcher';
import { SetFilterSidebar, SetFilterButton } from '@/components/catalog/SetFilterSidebar';
import { SetListItem } from '@/components/catalog/SetListItem';
import { useSetFilter } from '@/hooks/useSetFilter';
import type { SetSortOption } from '@/lib/set-filter-logic';

interface CorporativoContentProps {
  sets: CorporateSetSummary[];
  /** Solo las reglas PRICE_VISIBILITY — se resuelven por set en el cliente (loop en memoria). */
  priceVisibilityRules: BusinessRule[];
  minQuantity: number;
}

export function CorporativoContent({ sets, priceVisibilityRules, minQuantity }: CorporativoContentProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid-4');

  const {
    filters,
    filterOptions,
    paginatedSets,
    currentPage,
    totalPages,
    totalSets,
    hasActiveFilters,
    activeFilterCount,
    applyFilters,
    resetFilters,
    goToPage,
    sortBy,
    setSortBy,
    itemsPerPage,
    setItemsPerPage,
  } = useSetFilter(sets);

  const showPricesFor = (set: CorporateSetSummary): boolean => {
    const resolved = resolveRules(priceVisibilityRules, {
      setId: set.id,
      brandId: set.brandId,
      productIds: set.productIds,
    });
    return (
      resolved.priceVisibility.showPrices &&
      (resolved.priceVisibility.catalog === 'CORPORATE' || resolved.priceVisibility.catalog === 'BOTH')
    );
  };

  return (
    <main className="pt-14 sm:pt-16 min-h-screen">
      {/* Header */}
      <section className="bg-[#111111] py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-3">
            <Building2 className="w-4 h-4" strokeWidth={1.5} />
            <span>Ventas al Mayor / Compras Corporativas</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Catálogo Corporativo</h1>
          <p className="text-white/70 max-w-2xl">
            Sets de uniformes para instituciones, hospitales y clínicas. Precios referenciales sujetos a
            cotización formal. Compra mínima: <strong>{minQuantity} sets</strong>.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#E5E5E5]">
          <div className="flex items-center gap-4">
            <SetFilterButton
              onClick={() => setIsFilterOpen(true)}
              count={activeFilterCount > 0 ? activeFilterCount : undefined}
            />
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
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
                onChange={(e) => setSortBy(e.target.value as SetSortOption)}
                className="text-sm border border-[#E5E5E5] rounded-lg px-3 py-2 focus:outline-none focus:border-[#111111]"
              >
                <option value="relevance">Relevancia</option>
                <option value="price-asc">Precio: menor a mayor</option>
                <option value="price-desc">Precio: mayor a menor</option>
                <option value="newest">Más recientes</option>
              </select>
            </div>

            <div className="hidden sm:block">
              <LayoutSwitcher
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={setItemsPerPage}
                totalItems={totalSets}
                showAllColumns={true}
              />
            </div>
            <div className="sm:hidden">
              <LayoutSwitcher
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={setItemsPerPage}
                totalItems={totalSets}
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
              value={filters.search}
              onChange={(e) => applyFilters({ search: e.target.value })}
              placeholder="Buscar en resultados..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111] transition-colors"
            />
            {filters.search && (
              <button
                onClick={() => applyFilters({ search: '' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-3 h-3 text-gray-400" strokeWidth={1.5} />
              </button>
            )}
          </div>
          {filters.search && (
            <p className="text-xs text-gray-500 mt-2">
              {totalSets} resultado{totalSets !== 1 ? 's' : ''} para &quot;{filters.search}&quot;
            </p>
          )}
        </div>

        <div className="flex gap-8">
          <SetFilterSidebar
            filters={filters}
            filterOptions={filterOptions}
            onFilterChange={applyFilters}
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
          />

          <div className="flex-1">
            {paginatedSets.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                No hay sets corporativos disponibles con estos filtros.
                {hasActiveFilters && (
                  <div className="mt-4">
                    <button
                      onClick={resetFilters}
                      className="px-6 py-2 bg-[#111111] text-white text-sm font-medium rounded-full hover:opacity-80 transition-opacity"
                    >
                      Limpiar filtros
                    </button>
                  </div>
                )}
              </div>
            ) : (
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
                  {paginatedSets.map((set) =>
                    viewMode === 'list' ? (
                      <SetListItem key={set.id} set={set} showPrices={showPricesFor(set)} />
                    ) : (
                      <Link
                        key={set.id}
                        href={`/corporativo/s/${set.slug}`}
                        className="group border border-[#E5E5E5] rounded-xl overflow-hidden hover:shadow-lg transition-shadow bg-white"
                      >
                        <div className="relative aspect-product bg-[#F5F5F7] overflow-hidden">
                          {set.cover ? (
                            <>
                              <MediaGridThumb
                                item={set.cover}
                                fallback="/images/placeholder-product.jpg"
                                alt={set.name}
                                fit="cover"
                                className={`object-cover transition-opacity duration-300 ${set.secondaryCover ? 'group-hover:opacity-0' : 'group-hover:scale-105 transition-transform duration-500'}`}
                                sizes="400px"
                              />
                              {set.secondaryCover && (
                                <MediaGridThumb
                                  item={set.secondaryCover}
                                  fallback="/images/placeholder-product.jpg"
                                  alt={set.name}
                                  fit="cover"
                                  className="absolute inset-0 object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                  sizes="400px"
                                />
                              )}
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <Building2 className="w-12 h-12" strokeWidth={1} />
                            </div>
                          )}
                          {set.isFeatured && (
                            <span className="absolute top-3 left-3 flex items-center gap-1 bg-white/90 text-xs font-medium px-2 py-1 rounded-full">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              Destacado
                            </span>
                          )}
                        </div>
                        <div className="p-4">
                          {set.brandName && <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{set.brandName}</p>}
                          <h3 className="font-semibold text-[#111111] mb-1">{set.name}</h3>
                          <p className="text-sm text-gray-500 mb-3">
                            {set.pieceCount} {set.pieceCount === 1 ? 'pieza' : 'piezas'}
                          </p>
                          {showPricesFor(set) &&
                            (set.referencePrice !== null ? (
                              <div>
                                <span className="text-lg font-bold text-[#111111]">${set.referencePrice.toFixed(2)}</span>
                                <span className="text-xs text-gray-400 ml-1">/ set referencial</span>
                                {set.hasMissingPrices && (
                                  <span className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                                    <AlertTriangle className="w-3 h-3" /> Precio parcial
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">Precio bajo cotización</span>
                            ))}
                        </div>
                      </Link>
                    )
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#E5E5E5]">
                    <p className="text-sm text-gray-500">
                      Mostrando{' '}
                      <span className="font-medium text-[#111111]">{(currentPage - 1) * itemsPerPage + 1}</span>{' '}
                      -{' '}
                      <span className="font-medium text-[#111111]">
                        {Math.min(currentPage * itemsPerPage, totalSets)}
                      </span>{' '}
                      de <span className="font-medium text-[#111111]">{totalSets}</span> sets
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={cn(
                          'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-[#111111] hover:bg-[#F5F5F7]'
                        )}
                      >
                        <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                        <span className="hidden sm:inline">Anterior</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) pageNum = i + 1;
                          else if (currentPage <= 3) pageNum = i + 1;
                          else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                          else pageNum = currentPage - 2 + i;

                          return (
                            <button
                              key={pageNum}
                              onClick={() => goToPage(pageNum)}
                              className={cn(
                                'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                                currentPage === pageNum ? 'bg-[#111111] text-white' : 'text-[#111111] hover:bg-[#F5F5F7]'
                              )}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={cn(
                          'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-[#111111] hover:bg-[#F5F5F7]'
                        )}
                      >
                        <span className="hidden sm:inline">Siguiente</span>
                        <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

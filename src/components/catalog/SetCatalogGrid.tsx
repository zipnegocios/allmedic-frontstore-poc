'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CorporateSetSummary } from '@/lib/corporate-types';
import { resolveRules, type BusinessRule } from '@/lib/rules-engine';
import { LayoutSwitcher, type ViewMode } from '@/components/catalog/LayoutSwitcher';
import { SetFilterSidebar, SetFilterButton } from '@/components/catalog/SetFilterSidebar';
import { SetListItem } from '@/components/catalog/SetListItem';
import { SetGridCard } from '@/components/catalog/SetGridCard';
import { useSetFilter } from '@/hooks/useSetFilter';
import { buildSetSearchWords, findSearchMatchedColorId, type SetSortOption } from '@/lib/set-filter-logic';
import { suggestClosestMatch } from '@/lib/fuzzy-match';

interface SetCatalogGridProps {
  sets: CorporateSetSummary[];
  priceVisibilityRules: BusinessRule[];
  minQuantity: number;
}

// `minQuantity` se recibe para mantener la misma prop interface que CorporativoContent,
// pero no se usa dentro del grid (solo aparece en el hero de /corporativo).
export function SetCatalogGrid({ sets, priceVisibilityRules }: SetCatalogGridProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid-4');
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('q') ?? undefined;
  const initialBrandName = searchParams.get('brand') ?? undefined;

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
  } = useSetFilter(sets, { search: initialSearch, brandName: initialBrandName });

  const searchSuggestion = useMemo(() => {
    if (paginatedSets.length > 0 || totalSets > 0) return null;
    const query = filters.search.trim();
    if (!query) return null;
    const allWords = sets.flatMap(buildSetSearchWords);
    return suggestClosestMatch(query, allWords);
  }, [paginatedSets.length, totalSets, filters.search, sets]);

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
              {searchSuggestion && (
                <p className="mt-2">
                  <button
                    type="button"
                    onClick={() => applyFilters({ search: searchSuggestion })}
                    className="text-[#111111] font-medium hover:underline"
                  >
                    ¿Usted quizás quiso decir: <span className="underline">{searchSuggestion}</span>?
                  </button>
                </p>
              )}
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
                  viewMode === 'grid-4' && 'grid-cols-1 sm:grid-cols-3 lg:grid-cols-4',
                  viewMode === 'grid-3' && 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3',
                  viewMode === 'grid-2' && 'grid-cols-2 lg:grid-cols-2',
                  viewMode === 'grid-1' && 'grid-cols-1 sm:grid-cols-2',
                  viewMode === 'list' && 'grid-cols-1'
                )}
              >
                {paginatedSets.map((set) => {
                  // Sin color filtrado explícitamente, si el texto de búsqueda matchea un
                  // código/nombre de color del set, se usa ESE color para la portada — así
                  // buscar "Navy" o "AZ-01" muestra la imagen en ese color sin que el usuario
                  // tenga que además clickear el swatch.
                  const effectiveColorId =
                    filters.colorId ?? (filters.search ? findSearchMatchedColorId(set, filters.search) : null);
                  return viewMode === 'list' ? (
                    <SetListItem key={set.id} set={set} showPrices={showPricesFor(set)} activeColorId={effectiveColorId} />
                  ) : (
                    <SetGridCard key={set.id} set={set} activeColorId={effectiveColorId} showPrices={showPricesFor(set)} />
                  );
                })}
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
  );
}

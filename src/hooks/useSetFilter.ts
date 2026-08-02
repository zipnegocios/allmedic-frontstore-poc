import { useState, useMemo, useCallback } from 'react';
import type { CorporateSetSummary } from '@/lib/corporate-types';
import {
  EMPTY_SET_FILTERS,
  matchesSetFilters,
  computeSetFilterOptions,
  sortSets,
  countActiveSetFilters,
  paginate,
  type SetFilterState,
  type SetSortOption,
  type SetFilterOptions,
} from '@/lib/set-filter-logic';

export type { SetFilterOptions, SetStyleFilterOption } from '@/lib/set-filter-logic';

const ITEMS_PER_PAGE_DEFAULT = 20;

export function useSetFilter(
  sets: CorporateSetSummary[],
  initial?: { search?: string; brandName?: string }
) {
  const [filters, setFilters] = useState<SetFilterState>(() => {
    if (!initial) return EMPTY_SET_FILTERS;
    let brandId: string | null = null;
    if (initial.brandName) {
      const match = sets.find(
        (s) => s.brandName?.toLowerCase() === initial.brandName!.toLowerCase()
      );
      brandId = match?.brandId ?? null;
    }
    return {
      ...EMPTY_SET_FILTERS,
      search: initial.search ?? EMPTY_SET_FILTERS.search,
      brandId,
    };
  });
  const [sortBy, setSortBy] = useState<SetSortOption>('relevance');
  const [itemsPerPage, setItemsPerPageState] = useState<number>(ITEMS_PER_PAGE_DEFAULT);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filterOptions: SetFilterOptions = useMemo(
    () => computeSetFilterOptions(sets, filters),
    [sets, filters]
  );

  const filteredSets = useMemo(() => {
    const matched = sets.filter((s) => matchesSetFilters(s, filters));
    return sortSets(matched, sortBy);
  }, [sets, filters, sortBy]);

  const totalSets = filteredSets.length;
  const totalPages = Math.max(1, Math.ceil(totalSets / itemsPerPage));

  const paginatedSets = useMemo(
    () => paginate(filteredSets, currentPage, itemsPerPage),
    [filteredSets, currentPage, itemsPerPage]
  );

  const activeFilterCount = countActiveSetFilters(filters);
  const hasActiveFilters = activeFilterCount > 0 || filters.search.trim().length > 0;

  const applyFilters = useCallback((newFilters: Partial<SetFilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_SET_FILTERS);
    setCurrentPage(1);
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [totalPages]
  );

  const setItemsPerPage = useCallback((count: number) => {
    setItemsPerPageState(count);
    setCurrentPage(1);
  }, []);

  return {
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
  };
}

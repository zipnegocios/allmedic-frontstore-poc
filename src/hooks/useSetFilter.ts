import { useState, useMemo, useCallback } from 'react';
import type { CorporateSetSummary, SetGroupSummary } from '@/lib/corporate-types';
import {
  EMPTY_SET_FILTERS,
  matchesSetFilters,
  sortSets,
  countActiveSetFilters,
  paginate,
  type SetFilterState,
  type SetSortOption,
} from '@/lib/set-filter-logic';

export interface SetFilterOptions {
  groups: SetGroupSummary[];
  categories: string[];
  brands: string[];
  colors: { id: string; name: string; code: string; hex: string }[];
  sizes: string[];
  fits: string[];
}

const ITEMS_PER_PAGE_DEFAULT = 20;

export function useSetFilter(sets: CorporateSetSummary[], groups: SetGroupSummary[]) {
  const [filters, setFilters] = useState<SetFilterState>(EMPTY_SET_FILTERS);
  const [sortBy, setSortBy] = useState<SetSortOption>('relevance');
  const [itemsPerPage, setItemsPerPageState] = useState<number>(ITEMS_PER_PAGE_DEFAULT);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filterOptions: SetFilterOptions = useMemo(() => {
    const categories = new Set<string>();
    const brands = new Set<string>();
    const colorMap = new Map<string, { id: string; name: string; code: string; hex: string }>();
    const sizes = new Set<string>();
    const fits = new Set<string>();
    for (const s of sets) {
      for (const c of s.categories) categories.add(c);
      if (s.brandName) brands.add(s.brandName);
      for (const c of s.colors) if (!colorMap.has(c.id)) colorMap.set(c.id, c);
      for (const sz of s.sizes) sizes.add(sz);
      for (const f of s.fits) fits.add(f);
    }
    return {
      groups,
      categories: Array.from(categories).sort(),
      brands: Array.from(brands).sort(),
      colors: Array.from(colorMap.values()),
      sizes: Array.from(sizes),
      fits: Array.from(fits).sort(),
    };
  }, [sets, groups]);

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

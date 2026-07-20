import { useState, useMemo, useCallback } from 'react';
import type { CorporateSetSummary } from '@/lib/corporate-types';
import {
  EMPTY_SET_FILTERS,
  matchesSetFilters,
  sortSets,
  countActiveSetFilters,
  paginate,
  type SetFilterState,
  type SetSortOption,
} from '@/lib/set-filter-logic';

/** Opción de estilo EAV (ej. "Corte") derivada de `set.availableStyles` — soporta cualquier
 * atributo de estilo presente en los datos, no solo "corte". `label` es el slug capitalizado
 * (no tenemos el `name` del atributo en el payload público, solo su slug estable). Mismo patrón
 * que `StyleFilterOption` en `FilterSidebar.tsx` (catálogo individual). */
export interface SetStyleFilterOption {
  slug: string;
  label: string;
  values: string[];
}

export interface SetFilterOptions {
  /** Nombres de `productTypes` (EAV) presentes entre los sets recibidos — dinámico, sin opción muerta. */
  productTypes: string[];
  brands: string[];
  colors: { id: string; name: string; code: string; hex: string }[];
  sizes: string[];
  styleOptions: SetStyleFilterOption[];
}

const ITEMS_PER_PAGE_DEFAULT = 20;

export function useSetFilter(sets: CorporateSetSummary[]) {
  const [filters, setFilters] = useState<SetFilterState>(EMPTY_SET_FILTERS);
  const [sortBy, setSortBy] = useState<SetSortOption>('relevance');
  const [itemsPerPage, setItemsPerPageState] = useState<number>(ITEMS_PER_PAGE_DEFAULT);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filterOptions: SetFilterOptions = useMemo(() => {
    const productTypes = new Set<string>();
    const brands = new Set<string>();
    const colorMap = new Map<string, { id: string; name: string; code: string; hex: string }>();
    const sizes = new Set<string>();
    const stylesMap = new Map<string, Set<string>>();
    for (const s of sets) {
      for (const t of s.productTypes) productTypes.add(t);
      if (s.brandName) brands.add(s.brandName);
      for (const c of s.colors) if (!colorMap.has(c.id)) colorMap.set(c.id, c);
      for (const sz of s.sizes) sizes.add(sz);
      for (const [slug, values] of Object.entries(s.availableStyles)) {
        if (!stylesMap.has(slug)) stylesMap.set(slug, new Set());
        for (const v of values) stylesMap.get(slug)!.add(v);
      }
    }
    const styleOptions: SetStyleFilterOption[] = Array.from(stylesMap.entries()).map(([slug, values]) => ({
      slug,
      label: slug.charAt(0).toUpperCase() + slug.slice(1),
      values: Array.from(values).sort(),
    }));
    return {
      productTypes: Array.from(productTypes).sort(),
      brands: Array.from(brands).sort(),
      colors: Array.from(colorMap.values()),
      sizes: Array.from(sizes),
      styleOptions,
    };
  }, [sets]);

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

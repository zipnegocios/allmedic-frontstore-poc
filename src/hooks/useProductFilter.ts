import { useState, useCallback, useMemo } from 'react';
import type { Category, Size, Fit } from '@/lib/types';
import { PRODUCTS, AVAILABLE_COLORS, BRANDS } from '@/lib/dummy-data';

export interface FilterState {
  category: Category | null;
  size: Size | null;
  color: string | null;
  brand: string | null;
  collection: string | null;
  style: string | null;
  fit: Fit | null;
}

export interface FilterOptions {
  categories: Category[];
  sizes: Size[];
  colors: { id: string; name: string; hex: string }[];
  brands: string[];
  collections: string[];
  styles: string[];
  fits: Fit[];
}

const COLLECTIONS = ['Infinity', 'Classic', 'Performance', 'Purple Label', 'Activate', 'W123', 'Basics'];
const STYLES = ['V-Neck', 'Round Neck', 'Mock Wrap', 'Asymmetric', 'Sporty', 'Classic Fit', 'Slim Fit'];

const INITIAL_FILTERS: FilterState = {
  category: null,
  size: null,
  color: null,
  brand: null,
  collection: null,
  style: null,
  fit: null,
};

export function useProductFilter(itemsPerPage: number = 12) {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Get available filter options based on current selection (hierarchical filtering)
  const filterOptions: FilterOptions = useMemo(() => {
    // Start with all products and apply active filters to determine available options
    const availableProducts = PRODUCTS;

    // Get unique values from all products for each filter type
    const categories = [...new Set(availableProducts.map(p => p.category))];
    const allSizes = availableProducts.flatMap(p => p.availableSizes);
    const sizes = [...new Set(allSizes)];
    const colors = AVAILABLE_COLORS.slice(0, 20); // Limit to most common colors
    const brands = BRANDS;
    const collections = COLLECTIONS;
    const styles = STYLES;
    const allFits = availableProducts.flatMap(p => p.availableFits || []);
    const fits = [...new Set(allFits)];

    return {
      categories: categories as Category[],
      sizes: sizes as Size[],
      colors,
      brands,
      collections,
      styles,
      fits: fits as Fit[],
    };
  }, []);

  // Filter products based on current filter state
  const filteredProducts = useMemo(() => {
    let result = [...PRODUCTS];

    if (filters.category) {
      result = result.filter(p => p.category === filters.category);
    }

    if (filters.size) {
      result = result.filter(p => p.availableSizes.includes(filters.size!));
    }

    if (filters.color) {
      result = result.filter(p => p.colors.some(c => c.id === filters.color));
    }

    if (filters.brand) {
      result = result.filter(p => p.brand === filters.brand);
    }

    if (filters.collection) {
      // Mock collection filtering - in real app would be based on product tags
      result = result.filter(p => {
        if (filters.collection === 'Infinity') return p.brand === 'Infinity';
        if (filters.collection === 'Purple Label') return p.brand === 'Healing Hands';
        if (filters.collection === 'Activate') return p.brand === 'Med Couture';
        if (filters.collection === 'W123') return p.brand === 'WonderWink';
        if (filters.collection === 'Basics') return p.brand === 'Koi';
        return true;
      });
    }

    if (filters.style) {
      // Mock style filtering based on product name/description
      result = result.filter(p => {
        const name = p.name.toLowerCase();
        if (filters.style === 'V-Neck') return name.includes('v-neck') || name.includes('top');
        if (filters.style === 'Sporty') return p.brand === 'Med Couture' || p.brand === 'Skechers';
        if (filters.style === 'Slim Fit') return name.includes('skinny') || name.includes('yola');
        return true;
      });
    }

    if (filters.fit) {
      result = result.filter(p => p.availableFits?.includes(filters.fit!));
    }

    return result;
  }, [filters]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  // Simulate AJAX loading
  const applyFilters = useCallback((newFilters: Partial<FilterState>) => {
    setIsLoading(true);
    
    // Simulate network delay
    setTimeout(() => {
      setFilters(prev => ({ ...prev, ...newFilters }));
      setCurrentPage(1); // Reset to first page when filters change
      setIsLoading(false);
    }, 300);
  }, []);

  const resetFilters = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      setFilters(INITIAL_FILTERS);
      setCurrentPage(1);
      setIsLoading(false);
    }, 300);
  }, []);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setIsLoading(true);
      setTimeout(() => {
        setCurrentPage(page);
        setIsLoading(false);
      }, 200);
    }
  }, [totalPages]);

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(v => v !== null);
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(v => v !== null).length;
  }, [filters]);

  return {
    filters,
    filterOptions,
    filteredProducts,
    paginatedProducts,
    currentPage,
    totalPages,
    totalProducts: filteredProducts.length,
    isLoading,
    hasActiveFilters,
    activeFilterCount,
    applyFilters,
    resetFilters,
    goToPage,
  };
}

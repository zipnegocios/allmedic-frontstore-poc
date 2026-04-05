import { useState, useMemo, useCallback, useEffect } from 'react';
import { PRODUCTS } from '@/lib/dummy-data';
import type { CatalogFilters } from '@/lib/types';

export interface FilterOptions {
  categories: string[];
  brands: string[];
  colors: { id: string; name: string; hex: string }[];
  sizes: string[];
  fits: string[];
  collections: string[];
  styles: string[];
}

export interface FilterState extends CatalogFilters {}

export function useProductFilter(itemsPerPage: number = 12) {
  const [filters, setFilters] = useState<CatalogFilters>({
    gender: null,
    categories: [],
    category: null,
    brands: [],
    brand: null,
    colors: [],
    color: null,
    sizes: [],
    size: null,
    fits: [],
    fit: null,
    collection: null,
    collections: [],
    style: null,
    styles: [],
    priceMin: 0,
    priceMax: 200,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Get filter options from products
  const filterOptions: FilterOptions = useMemo(() => {
    const categories = [...new Set(PRODUCTS.map(p => p.category))];
    const brands = [...new Set(PRODUCTS.map(p => p.brand))];
    const colors = [...new Map(PRODUCTS.flatMap(p => p.colors).map(c => [c.name, c])).values()];
    const sizes = [...new Set(PRODUCTS.flatMap(p => p.availableSizes))];
    const fits = [...new Set(PRODUCTS.flatMap(p => p.availableFits || []))];

    return {
      categories,
      brands,
      colors: colors.map(c => ({ id: c.id, name: c.name, hex: c.hex })),
      sizes,
      fits,
      collections: [],
      styles: [],
    };
  }, []);

  // Filter products
  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter(product => {
      if (filters.gender && product.gender !== filters.gender && product.gender !== 'Unisex') {
        return false;
      }
      if (filters.categories.length > 0 && !filters.categories.includes(product.category)) {
        return false;
      }
      if (filters.brands.length > 0 && !filters.brands.includes(product.brand)) {
        return false;
      }
      if (filters.colors.length > 0 && !product.colors.some(c => filters.colors.includes(c.name))) {
        return false;
      }
      if (filters.sizes.length > 0 && !product.availableSizes.some(s => filters.sizes.includes(s))) {
        return false;
      }
      if (filters.fits.length > 0 && !product.availableFits?.some(f => filters.fits.includes(f))) {
        return false;
      }
      const price = product.priceSale || product.priceNormal;
      if (price < filters.priceMin || price > filters.priceMax) {
        return false;
      }
      return true;
    });
  }, [filters]);

  // Handle loading state effect
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 100);
    return () => clearTimeout(timer);
  }, [filteredProducts]);

  // Pagination
  const totalProducts = filteredProducts.length;
  const totalPages = Math.ceil(totalProducts / itemsPerPage);
  
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const activeFilterCount = 
    (filters.gender ? 1 : 0) +
    filters.categories.length +
    filters.brands.length +
    filters.colors.length +
    filters.sizes.length +
    filters.fits.length;

  const hasActiveFilters = activeFilterCount > 0;

  const applyFilters = useCallback((newFilters: Partial<CatalogFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      gender: null,
      categories: [],
      category: null,
      brands: [],
      brand: null,
      colors: [],
      color: null,
      sizes: [],
      size: null,
      fits: [],
      fit: null,
      collection: null,
      collections: [],
      style: null,
      styles: [],
      priceMin: 0,
      priceMax: 200,
    });
    setCurrentPage(1);
  }, []);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [totalPages]);

  return {
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
  };
}

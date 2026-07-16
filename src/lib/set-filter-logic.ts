import type { CorporateSetSummary } from './corporate-types';
import type { Gender } from './types';

export interface SetFilterState {
  search: string;
  groups: string[];
  gender: Gender | null;
  categories: string[];
  brands: string[];
  colors: string[];
  sizes: string[];
  fits: string[];
}

export const EMPTY_SET_FILTERS: SetFilterState = {
  search: '',
  groups: [],
  gender: null,
  categories: [],
  brands: [],
  colors: [],
  sizes: [],
  fits: [],
};

export type SetSortOption = 'relevance' | 'price-asc' | 'price-desc' | 'newest';

export function matchesSetFilters(set: CorporateSetSummary, filters: SetFilterState): boolean {
  if (filters.groups.length > 0 && (!set.groupSlug || !filters.groups.includes(set.groupSlug))) {
    return false;
  }
  if (filters.gender && !set.genders.includes(filters.gender)) {
    return false;
  }
  if (filters.categories.length > 0 && !set.categories.some((c) => filters.categories.includes(c))) {
    return false;
  }
  if (filters.brands.length > 0 && (!set.brandName || !filters.brands.includes(set.brandName))) {
    return false;
  }
  if (filters.colors.length > 0 && !set.colors.some((c) => filters.colors.includes(c.id))) {
    return false;
  }
  if (filters.sizes.length > 0 && !set.sizes.some((s) => filters.sizes.includes(s))) {
    return false;
  }
  if (filters.fits.length > 0 && !set.fits.some((f) => filters.fits.includes(f))) {
    return false;
  }

  const query = filters.search.trim().toLowerCase();
  if (query) {
    const haystack = [set.name, set.groupName ?? '', set.brandName ?? '', ...set.pieceNames]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  return true;
}

export function sortSets(sets: CorporateSetSummary[], sortBy: SetSortOption): CorporateSetSummary[] {
  const sorted = [...sets];
  switch (sortBy) {
    case 'price-asc':
      sorted.sort((a, b) => (a.referencePrice ?? Number.POSITIVE_INFINITY) - (b.referencePrice ?? Number.POSITIVE_INFINITY));
      break;
    case 'price-desc':
      sorted.sort((a, b) => (b.referencePrice ?? Number.NEGATIVE_INFINITY) - (a.referencePrice ?? Number.NEGATIVE_INFINITY));
      break;
    case 'newest':
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    default:
      break;
  }
  return sorted;
}

export function countActiveSetFilters(filters: SetFilterState): number {
  return (
    filters.groups.length +
    (filters.gender ? 1 : 0) +
    filters.categories.length +
    filters.brands.length +
    filters.colors.length +
    filters.sizes.length +
    filters.fits.length
  );
}

export function paginate<T>(items: T[], page: number, perPage: number): T[] {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

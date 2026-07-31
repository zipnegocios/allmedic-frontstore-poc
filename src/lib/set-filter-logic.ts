import type { CorporateSetSummary } from './corporate-types';
import type { Gender } from './types';

export interface SetFilterState {
  search: string;
  gender: Gender | null;
  /** Nombres de `productTypes` (EAV) seleccionados — fuente de verdad para el filtro "Tipo de Producto". */
  productTypes: string[];
  /** Selección única — id de marca activo, o null. */
  brandId: string | null;
  /** Selección única — id de colección activa, o null. Matchea si CUALQUIER pieza del set
   * pertenece a esta colección (unión, no intersección). */
  collectionId: string | null;
  /** Selección única (no array) — un color activo a la vez determina tanto el filtrado de
   * cards como qué portada por color se muestra (`resolveCardCover` en `CorporativoContent`). */
  colorId: string | null;
  sizes: string[];
  /** Estilos EAV seleccionados: slug de atributo → valores seleccionados. Ej: `{ corte: ['Regular'] }`. */
  selectedStyles: Record<string, string[]>;
}

export const EMPTY_SET_FILTERS: SetFilterState = {
  search: '',
  gender: null,
  productTypes: [],
  brandId: null,
  collectionId: null,
  colorId: null,
  sizes: [],
  selectedStyles: {},
};

export type SetSortOption = 'relevance' | 'price-asc' | 'price-desc' | 'newest';

export function matchesSetFilters(set: CorporateSetSummary, filters: SetFilterState): boolean {
  if (filters.gender && !set.genders.includes(filters.gender)) {
    return false;
  }
  if (filters.productTypes.length > 0 && !set.productTypes.some((t) => filters.productTypes.includes(t))) {
    return false;
  }
  if (filters.brandId && set.brandId !== filters.brandId) {
    return false;
  }
  if (filters.collectionId && !set.collections.some((c) => c.id === filters.collectionId)) {
    return false;
  }
  if (filters.colorId && !set.colors.some((c) => c.id === filters.colorId)) {
    return false;
  }
  if (filters.sizes.length > 0 && !set.sizes.some((s) => filters.sizes.includes(s))) {
    return false;
  }
  for (const [slug, values] of Object.entries(filters.selectedStyles)) {
    if (values.length === 0) continue;
    const setValues = set.availableStyles[slug] ?? [];
    if (!setValues.some((v) => values.includes(v))) return false;
  }

  const query = filters.search.trim().toLowerCase();
  if (query) {
    const haystack = [set.name, set.brandName ?? '', ...set.pieceNames]
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
    (filters.gender ? 1 : 0) +
    filters.productTypes.length +
    (filters.brandId ? 1 : 0) +
    (filters.collectionId ? 1 : 0) +
    (filters.colorId ? 1 : 0) +
    filters.sizes.length +
    Object.values(filters.selectedStyles).reduce((sum, values) => sum + values.length, 0)
  );
}

export function paginate<T>(items: T[], page: number, perPage: number): T[] {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

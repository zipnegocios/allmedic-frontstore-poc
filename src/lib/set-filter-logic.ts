import type { CorporateSetSummary } from './corporate-types';
import type { Gender, ProductColor } from './types';

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

/** Todas las palabras/frases buscables de un set — nombre, marca, piezas, color (code+nombre),
 * colección, tipo de producto y valores de atributos EAV. Fuente única para el matching de
 * texto (`matchesSetFilters`) y para el pool de sugerencias por aproximación
 * (`suggestClosestMatch` en `SetCatalogGrid`). */
export function buildSetSearchWords(set: CorporateSetSummary): string[] {
  return [
    set.name,
    set.brandName ?? '',
    ...set.pieceNames,
    ...set.colors.map((c) => c.code),
    ...set.colors.map((c) => c.name),
    ...set.collections.map((c) => c.name),
    ...set.productTypes,
    ...Object.values(set.availableStyles).flat(),
  ].filter((w) => w.trim().length > 0);
}

/** Evalúa si `set` matchea `filters`, opcionalmente ignorando UNA categoría (`exclude`) — usado
 * por el facetado (`computeSetFilterOptions`) para calcular qué opciones mostrar dentro de una
 * categoría sin que esa misma categoría se autolimite a lo ya seleccionado. `matchesSetFilters`
 * es el caso sin exclusión. */
export function matchesSetFiltersExcept(
  set: CorporateSetSummary,
  filters: SetFilterState,
  exclude?: keyof SetFilterState
): boolean {
  if (exclude !== 'gender' && filters.gender && !set.genders.includes(filters.gender)) {
    return false;
  }
  if (
    exclude !== 'productTypes' &&
    filters.productTypes.length > 0 &&
    !set.productTypes.some((t) => filters.productTypes.includes(t))
  ) {
    return false;
  }
  if (exclude !== 'brandId' && filters.brandId && set.brandId !== filters.brandId) {
    return false;
  }
  if (
    exclude !== 'collectionId' &&
    filters.collectionId &&
    !set.collections.some((c) => c.id === filters.collectionId)
  ) {
    return false;
  }
  if (exclude !== 'colorId' && filters.colorId && !set.colors.some((c) => c.id === filters.colorId)) {
    return false;
  }
  if (
    exclude !== 'sizes' &&
    filters.sizes.length > 0 &&
    !set.sizes.some((s) => filters.sizes.includes(s))
  ) {
    return false;
  }
  if (exclude !== 'selectedStyles') {
    for (const [slug, values] of Object.entries(filters.selectedStyles)) {
      if (values.length === 0) continue;
      const setValues = set.availableStyles[slug] ?? [];
      if (!setValues.some((v) => values.includes(v))) return false;
    }
  }

  const query = filters.search.trim().toLowerCase();
  if (query) {
    const haystack = buildSetSearchWords(set).join(' ').toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  return true;
}

export function matchesSetFilters(set: CorporateSetSummary, filters: SetFilterState): boolean {
  return matchesSetFiltersExcept(set, filters, undefined);
}

/** Busca en los colores del set uno cuyo código o nombre matchee la búsqueda libre (mismo
 * criterio "includes" que `matchesSetFiltersExcept` usa sobre `buildSetSearchWords`) — permite
 * que el grid muestre la portada de ESE color cuando el usuario buscó por código/nombre de
 * color, sin que tenga que además seleccionar el swatch. Prioriza `pairedColors` (colores
 * realmente comprables, con portada propia en `coversByColor`) sobre `colors` (unión agregada
 * de piezas, puede no tener portada — cae a fallback en `resolveCardCover`). */
export function findSearchMatchedColorId(set: CorporateSetSummary, query: string): string | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const matches = (c: ProductColor) =>
    c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);

  return set.pairedColors.find(matches)?.id ?? set.colors.find(matches)?.id ?? null;
}

/** Opción de estilo EAV (ej. "Corte") derivada de `set.availableStyles` — soporta cualquier
 * atributo de estilo presente en los datos, no solo "corte". `label` es el nombre real del
 * atributo (`set.styleLabels`), con fallback al slug capitalizado si ningún set lo provee. */
export interface SetStyleFilterOption {
  slug: string;
  label: string;
  values: string[];
}

export interface SetFilterOptions {
  /** Nombres de `productTypes` (EAV) presentes entre los sets recibidos — dinámico, sin opción muerta. */
  productTypes: string[];
  brands: { id: string; name: string; logoUrl: string | null }[];
  collections: { id: string; name: string; logoUrl: string | null }[];
  colors: ProductColor[];
  sizes: string[];
  styleOptions: SetStyleFilterOption[];
}

/** Calcula las opciones disponibles por categoría de filtro (facetado): cada categoría se
 * agrega SOLO desde los sets que matchean todos los filtros activos EXCEPTO el de esa misma
 * categoría (`matchesSetFiltersExcept`) — así elegir Marca reduce las opciones de Color/
 * Colección/etc., y viceversa, pero el usuario siempre puede seguir cambiando de opción dentro
 * de la categoría que ya tiene seleccionada. Género no se incluye (son 4 valores fijos, siempre
 * visibles completos). */
export function computeSetFilterOptions(
  sets: CorporateSetSummary[],
  filters: SetFilterState
): SetFilterOptions {
  const setsForProductTypes = sets.filter((s) => matchesSetFiltersExcept(s, filters, 'productTypes'));
  const setsForBrands = sets.filter((s) => matchesSetFiltersExcept(s, filters, 'brandId'));
  const setsForCollections = sets.filter((s) => matchesSetFiltersExcept(s, filters, 'collectionId'));
  const setsForColors = sets.filter((s) => matchesSetFiltersExcept(s, filters, 'colorId'));
  const setsForSizes = sets.filter((s) => matchesSetFiltersExcept(s, filters, 'sizes'));
  const setsForStyles = sets.filter((s) => matchesSetFiltersExcept(s, filters, 'selectedStyles'));

  const productTypes = new Set<string>();
  for (const s of setsForProductTypes) for (const t of s.productTypes) productTypes.add(t);

  const brandsMap = new Map<string, { id: string; name: string; logoUrl: string | null }>();
  for (const s of setsForBrands) {
    if (s.brandId && s.brandName && !brandsMap.has(s.brandId)) {
      brandsMap.set(s.brandId, { id: s.brandId, name: s.brandName, logoUrl: s.brandLogoUrl });
    }
  }

  const collectionsMap = new Map<string, { id: string; name: string; logoUrl: string | null }>();
  for (const s of setsForCollections) {
    for (const c of s.collections) {
      if (!collectionsMap.has(c.id)) collectionsMap.set(c.id, c);
    }
  }

  const colorMap = new Map<string, ProductColor>();
  for (const s of setsForColors) {
    for (const c of s.colors) if (!colorMap.has(c.id)) colorMap.set(c.id, c);
  }

  const sizes = new Set<string>();
  for (const s of setsForSizes) for (const sz of s.sizes) sizes.add(sz);

  const stylesMap = new Map<string, Set<string>>();
  const styleLabelsMap = new Map<string, string>();
  for (const s of setsForStyles) {
    for (const [slug, values] of Object.entries(s.availableStyles)) {
      if (!stylesMap.has(slug)) stylesMap.set(slug, new Set());
      for (const v of values) stylesMap.get(slug)!.add(v);
      if (!styleLabelsMap.has(slug) && s.styleLabels[slug]) {
        styleLabelsMap.set(slug, s.styleLabels[slug]);
      }
    }
  }
  const styleOptions: SetStyleFilterOption[] = Array.from(stylesMap.entries()).map(([slug, values]) => ({
    slug,
    label: styleLabelsMap.get(slug) ?? slug.charAt(0).toUpperCase() + slug.slice(1),
    values: Array.from(values).sort(),
  }));

  return {
    productTypes: Array.from(productTypes).sort(),
    brands: Array.from(brandsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    collections: Array.from(collectionsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    colors: Array.from(colorMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    sizes: Array.from(sizes),
    styleOptions,
  };
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

import { describe, it, expect } from 'vitest';
import {
  matchesSetFilters,
  matchesSetFiltersExcept,
  computeSetFilterOptions,
  sortSets,
  countActiveSetFilters,
  paginate,
  EMPTY_SET_FILTERS,
  type SetFilterState,
} from '../set-filter-logic';
import type { CorporateSetSummary } from '../corporate-types';

function makeSet(overrides: Partial<CorporateSetSummary> = {}): CorporateSetSummary {
  return {
    id: 's1',
    slug: 'set-1',
    name: 'Set Enfermería Básico',
    description: null,
    cover: null,
    secondaryCover: null,
    coversByColor: [],
    brandName: 'AllMedic',
    brandId: 'b1',
    brandLogoUrl: null,
    productIds: ['p1', 'p2'],
    isFeatured: false,
    pieceCount: 2,
    hasRecommendedItems: false,
    referencePrice: 100,
    hasMissingPrices: false,
    colors: [{ id: 'c-navy', name: 'Navy', code: 'NVY', hex: '#1B2A4A', kind: 'SOLID', swatchUrl: null }],
    pairedColors: [{ id: 'c-navy', name: 'Navy', code: 'NVY', hex: '#1B2A4A', kind: 'SOLID', swatchUrl: null }],
    sizes: ['M'],
    genders: ['Unisex'],
    productTypes: ['Camisas'],
    collections: [],
    availableStyles: { corte: ['Regular'] },
    styleLabels: { corte: 'Corte' },
    pieceNames: ['Camisa Clínica', 'Pantalón Cargo'],
    pieceCodes: ['2624A'],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function filters(overrides: Partial<SetFilterState> = {}): SetFilterState {
  return { ...EMPTY_SET_FILTERS, ...overrides };
}

describe('matchesSetFilters', () => {
  it('matches a set when Navy comes from one piece and M comes from a different piece (aggregated, cross-piece AND)', () => {
    // colors=[Navy] aggregated from the shirt, sizes=[M] aggregated from the pants — same set object.
    const set = makeSet({ colors: [{ id: 'c-navy', name: 'Navy', code: 'NVY', hex: '#1B2A4A', kind: 'SOLID', swatchUrl: null }], sizes: ['M'] });
    const result = matchesSetFilters(set, filters({ colorId: 'c-navy', sizes: ['M'] }));
    expect(result).toBe(true);
  });

  it('excludes a set with no piece in Navy when filtering by Navy', () => {
    const set = makeSet({ colors: [{ id: 'c-black', name: 'Black', code: 'BLK', hex: '#000000', kind: 'SOLID', swatchUrl: null }] });
    const result = matchesSetFilters(set, filters({ colorId: 'c-navy' }));
    expect(result).toBe(false);
  });

  it('matches a set that has the filtered color among others', () => {
    const set = makeSet({
      colors: [
        { id: 'c-black', name: 'Black', code: 'BLK', hex: '#000000', kind: 'SOLID', swatchUrl: null },
        { id: 'c-navy', name: 'Navy', code: 'NVY', hex: '#1B2A4A', kind: 'SOLID', swatchUrl: null },
      ],
    });
    const result = matchesSetFilters(set, filters({ colorId: 'c-navy' }));
    expect(result).toBe(true);
  });

  it('search finds a set by a piece name it does not otherwise match by', () => {
    const set = makeSet({ name: 'Set Genérico', pieceNames: ['Camisa Clínica', 'Pantalón Cargo'] });
    const result = matchesSetFilters(set, filters({ search: 'pantalón cargo' }));
    expect(result).toBe(true);
  });

  it('search is case-insensitive and matches set name too', () => {
    const set = makeSet({ name: 'Set Radiología Avanzado' });
    const result = matchesSetFilters(set, filters({ search: 'RADIOLOGÍA' }));
    expect(result).toBe(true);
  });

  it('matches by productTypes (EAV)', () => {
    const set = makeSet({ productTypes: ['Camisas Clínicas'] });
    expect(matchesSetFilters(set, filters({ productTypes: ['Camisas Clínicas'] }))).toBe(true);
    expect(matchesSetFilters(set, filters({ productTypes: ['Pantalones'] }))).toBe(false);
  });

  it('matches by selectedStyles against set.availableStyles', () => {
    const set = makeSet({ availableStyles: { corte: ['Regular', 'Petite'] } });
    expect(matchesSetFilters(set, filters({ selectedStyles: { corte: ['Petite'] } }))).toBe(true);
    expect(matchesSetFilters(set, filters({ selectedStyles: { corte: ['Tall'] } }))).toBe(false);
  });
});

describe('matchesSetFilters — búsqueda ampliada', () => {
  const set = makeSet({
    colors: [
      { id: 'c-wine', name: 'Wine', code: 'WNE', hex: '#7B1E3A', kind: 'SOLID', swatchUrl: null },
      { id: 'c-hunter', name: 'Hunter', code: 'HNT', hex: '#2F4F2F', kind: 'SOLID', swatchUrl: null },
    ],
    collections: [{ id: 'col-1', name: 'Temporada Clínica', logoUrl: null }],
    productTypes: ['Camisas', 'Pantalones'],
    availableStyles: { corte: ['Slim', 'Regular'] },
  });

  it('matchea por código de color', () => {
    expect(matchesSetFilters(set, { ...EMPTY_SET_FILTERS, search: 'WNE' })).toBe(true);
  });

  it('matchea por nombre de color (case-insensitive)', () => {
    expect(matchesSetFilters(set, { ...EMPTY_SET_FILTERS, search: 'hunter' })).toBe(true);
  });

  it('matchea por nombre de colección', () => {
    expect(matchesSetFilters(set, { ...EMPTY_SET_FILTERS, search: 'Temporada Clínica' })).toBe(true);
  });

  it('matchea por tipo de producto', () => {
    expect(matchesSetFilters(set, { ...EMPTY_SET_FILTERS, search: 'Pantalones' })).toBe(true);
  });

  it('matchea por valor de atributo EAV', () => {
    expect(matchesSetFilters(set, { ...EMPTY_SET_FILTERS, search: 'Slim' })).toBe(true);
  });

  it('no matchea texto ausente en ningún campo', () => {
    expect(matchesSetFilters(set, { ...EMPTY_SET_FILTERS, search: 'Turquesa' })).toBe(false);
  });
});

describe('matchesSetFiltersExcept', () => {
  it('ignora el filtro de color al evaluar, pero respeta el resto', () => {
    const set = makeSet({
      brandId: 'b1',
      colors: [{ id: 'c-red', name: 'Red', code: 'RED', hex: '#FF0000', kind: 'SOLID', swatchUrl: null }],
    });
    // brandId coincide, colorId NO coincide (set no tiene c-navy) — pero como excluimos 'colorId',
    // el mismatch de color no debe importar.
    const result = matchesSetFiltersExcept(
      set,
      filters({ brandId: 'b1', colorId: 'c-navy' }),
      'colorId'
    );
    expect(result).toBe(true);
  });

  it('sigue rechazando por otros filtros activos aunque se excluya uno', () => {
    const set = makeSet({ brandId: 'b1' });
    const result = matchesSetFiltersExcept(
      set,
      filters({ brandId: 'b2', colorId: 'c-navy' }),
      'colorId'
    );
    expect(result).toBe(false);
  });

  it('sin exclusión, se comporta igual que matchesSetFilters', () => {
    const set = makeSet({ brandId: 'b1' });
    const withExclude = matchesSetFiltersExcept(set, filters({ brandId: 'b2' }), 'colorId');
    const direct = matchesSetFilters(set, filters({ brandId: 'b2' }));
    expect(withExclude).toBe(direct);
  });
});

describe('computeSetFilterOptions — facetado', () => {
  const setBarcoRojo = makeSet({
    id: 'barco-rojo',
    brandId: 'barco',
    brandName: 'Barco',
    genders: ['Hombre'],
    colors: [{ id: 'c-red', name: 'Red', code: 'RED', hex: '#FF0000', kind: 'SOLID', swatchUrl: null }],
  });
  const setBarcoAzul = makeSet({
    id: 'barco-azul',
    brandId: 'barco',
    brandName: 'Barco',
    genders: ['Mujer'],
    colors: [{ id: 'c-blue', name: 'Blue', code: 'BLU', hex: '#0000FF', kind: 'SOLID', swatchUrl: null }],
  });
  const setLandauVerde = makeSet({
    id: 'landau-verde',
    brandId: 'landau',
    brandName: 'Landau',
    genders: ['Hombre'],
    colors: [{ id: 'c-green', name: 'Green', code: 'GRN', hex: '#00FF00', kind: 'SOLID', swatchUrl: null }],
  });
  const allSets = [setBarcoRojo, setBarcoAzul, setLandauVerde];

  it('sin filtros activos, muestra todas las opciones', () => {
    const options = computeSetFilterOptions(allSets, EMPTY_SET_FILTERS);
    expect(options.brands.map((b) => b.id).sort()).toEqual(['barco', 'landau']);
    expect(options.colors.map((c) => c.id).sort()).toEqual(['c-blue', 'c-green', 'c-red']);
  });

  it('al elegir marca Barco, el filtro de color se reduce a los colores de Barco', () => {
    const options = computeSetFilterOptions(allSets, filters({ brandId: 'barco' }));
    expect(options.colors.map((c) => c.id).sort()).toEqual(['c-blue', 'c-red']);
  });

  it('al elegir marca Barco + género Hombre, el color se reduce aún más (solo Red)', () => {
    const options = computeSetFilterOptions(allSets, filters({ brandId: 'barco', gender: 'Hombre' }));
    expect(options.colors.map((c) => c.id)).toEqual(['c-red']);
  });

  it('al elegir un color, el propio filtro de color sigue mostrando todas sus opciones (auto-exclusión)', () => {
    const options = computeSetFilterOptions(allSets, filters({ brandId: 'barco', colorId: 'c-red' }));
    // El filtro de color se excluye a sí mismo: debe seguir mostrando Red Y Blue (ambos de Barco).
    expect(options.colors.map((c) => c.id).sort()).toEqual(['c-blue', 'c-red']);
  });

  it('colecciones se acotan por marca igual que colores', () => {
    const setBarcoConColeccion = makeSet({
      id: 'barco-col',
      brandId: 'barco',
      brandName: 'Barco',
      collections: [{ id: 'col-verano', name: 'Verano', logoUrl: null }],
    });
    const setLandauConColeccion = makeSet({
      id: 'landau-col',
      brandId: 'landau',
      brandName: 'Landau',
      collections: [{ id: 'col-invierno', name: 'Invierno', logoUrl: null }],
    });
    const options = computeSetFilterOptions(
      [setBarcoConColeccion, setLandauConColeccion],
      filters({ brandId: 'barco' })
    );
    expect(options.collections.map((c) => c.id)).toEqual(['col-verano']);
  });

  it('usa el label real de styleLabels en vez del slug capitalizado', () => {
    const set = makeSet({ availableStyles: { 'corte-tops': ['Regular'] }, styleLabels: { 'corte-tops': 'Modelo de Corte' } });
    const options = computeSetFilterOptions([set], EMPTY_SET_FILTERS);
    const styleOption = options.styleOptions.find((o) => o.slug === 'corte-tops');
    expect(styleOption?.label).toBe('Modelo de Corte');
  });

  it('cae al slug capitalizado si ningún set provee styleLabels para ese slug', () => {
    const set = makeSet({ availableStyles: { talle: ['M'] }, styleLabels: {} });
    const options = computeSetFilterOptions([set], EMPTY_SET_FILTERS);
    const styleOption = options.styleOptions.find((o) => o.slug === 'talle');
    expect(styleOption?.label).toBe('Talle');
  });
});

describe('sortSets', () => {
  const cheap = makeSet({ id: 'cheap', referencePrice: 50, createdAt: '2026-01-01T00:00:00.000Z' });
  const pricey = makeSet({ id: 'pricey', referencePrice: 150, createdAt: '2026-03-01T00:00:00.000Z' });
  const mid = makeSet({ id: 'mid', referencePrice: 100, createdAt: '2026-02-01T00:00:00.000Z' });

  it('sorts price-asc by referencePrice ascending', () => {
    const result = sortSets([pricey, cheap, mid], 'price-asc').map((s) => s.id);
    expect(result).toEqual(['cheap', 'mid', 'pricey']);
  });

  it('sorts price-desc by referencePrice descending', () => {
    const result = sortSets([cheap, pricey, mid], 'price-desc').map((s) => s.id);
    expect(result).toEqual(['pricey', 'mid', 'cheap']);
  });

  it('sorts newest by createdAt descending', () => {
    const result = sortSets([cheap, mid, pricey], 'newest').map((s) => s.id);
    expect(result).toEqual(['pricey', 'mid', 'cheap']);
  });

  it('relevance leaves the original order untouched', () => {
    const result = sortSets([pricey, cheap, mid], 'relevance').map((s) => s.id);
    expect(result).toEqual(['pricey', 'cheap', 'mid']);
  });
});

describe('countActiveSetFilters', () => {
  it('counts zero for empty filters', () => {
    expect(countActiveSetFilters(EMPTY_SET_FILTERS)).toBe(0);
  });

  it('counts each active filter once, arrays by length', () => {
    const count = countActiveSetFilters(
      filters({ gender: 'Mujer', colorId: 'c1' })
    );
    expect(count).toBe(2); // 1 gender + 1 color
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it('returns the first page', () => {
    expect(paginate(items, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('returns a middle page', () => {
    expect(paginate(items, 2, 10)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('returns a partial last page', () => {
    expect(paginate(items, 3, 10)).toEqual([21, 22, 23, 24, 25]);
  });
});

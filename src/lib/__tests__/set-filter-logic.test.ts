import { describe, it, expect } from 'vitest';
import {
  matchesSetFilters,
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
    brandName: 'AllMedic',
    brandId: 'b1',
    productIds: ['p1', 'p2'],
    isFeatured: false,
    pieceCount: 2,
    referencePrice: 100,
    hasMissingPrices: false,
    colors: [{ id: 'c-navy', name: 'Navy', code: 'NVY', hex: '#1B2A4A' }],
    sizes: ['M'],
    genders: ['Unisex'],
    productTypes: ['Camisas'],
    availableStyles: { corte: ['Regular'] },
    pieceNames: ['Camisa Clínica', 'Pantalón Cargo'],
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
    const set = makeSet({ colors: [{ id: 'c-navy', name: 'Navy', code: 'NVY', hex: '#1B2A4A' }], sizes: ['M'] });
    const result = matchesSetFilters(set, filters({ colors: ['c-navy'], sizes: ['M'] }));
    expect(result).toBe(true);
  });

  it('excludes a set with no piece in Navy when filtering by Navy', () => {
    const set = makeSet({ colors: [{ id: 'c-black', name: 'Black', code: 'BLK', hex: '#000000' }] });
    const result = matchesSetFilters(set, filters({ colors: ['c-navy'] }));
    expect(result).toBe(false);
  });

  it('applies OR within a group: Navy OR Black matches a set that only has Black', () => {
    const set = makeSet({ colors: [{ id: 'c-black', name: 'Black', code: 'BLK', hex: '#000000' }] });
    const result = matchesSetFilters(set, filters({ colors: ['c-navy', 'c-black'] }));
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
      filters({ gender: 'Mujer', colors: ['c1'] })
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

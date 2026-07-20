import { describe, it, expect } from 'vitest';
import { findDuplicateSetItemIndexes } from '../set-validation';

describe('findDuplicateSetItemIndexes — anti-duplicados (PLAN-ajustes-admin-sets.md Fase 3.2)', () => {
  it('detecta el mismo producto agregado dos veces', () => {
    const result = findDuplicateSetItemIndexes([
      { productId: 'p1' },
      { productId: 'p1' },
    ]);
    expect(result).toEqual([1]);
  });

  it('no marca nada cuando todos los productos son distintos', () => {
    const result = findDuplicateSetItemIndexes([
      { productId: 'p1' },
      { productId: 'p2' },
    ]);
    expect(result).toEqual([]);
  });

  it('marca cada repetición extra, no solo la segunda', () => {
    const result = findDuplicateSetItemIndexes([
      { productId: 'p1' },
      { productId: 'p1' },
      { productId: 'p1' },
    ]);
    expect(result).toEqual([1, 2]);
  });

  it('lista vacía no produce duplicados', () => {
    expect(findDuplicateSetItemIndexes([])).toEqual([]);
  });
});

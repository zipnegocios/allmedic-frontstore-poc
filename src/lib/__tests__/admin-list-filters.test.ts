import { describe, it, expect } from 'vitest';
import { countActiveFilters } from '../admin-list-filters';

describe('countActiveFilters', () => {
  it('cuenta 0 cuando todos los filtros están en el valor por defecto', () => {
    expect(countActiveFilters(['ALL', 'ALL'])).toBe(0);
  });

  it('cuenta los filtros distintos al valor por defecto', () => {
    expect(countActiveFilters(['DRAFT', 'ALL'])).toBe(1);
    expect(countActiveFilters(['DRAFT', 'CORPORATE'])).toBe(2);
  });

  it('ignora valores vacíos o nulos', () => {
    expect(countActiveFilters(['', null, undefined])).toBe(0);
  });

  it('acepta un valor por defecto distinto de ALL', () => {
    expect(countActiveFilters(['SENT', 'ALL'], 'SENT')).toBe(1);
  });
});

import { describe, it, expect } from 'vitest';
import { productPrice, type EligibleProduct } from '../schema';

function makeProduct(overrides: Partial<EligibleProduct> = {}): EligibleProduct {
  return {
    id: 'p1',
    name: 'Producto',
    slug: 'producto',
    priceWholesale: null,
    priceWholesaleSale: null,
    priceNormal: '10.00',
    visibility: 'GROUPS',
    brandName: null,
    imageUrl: null,
    colors: [],
    sizes: [],
    hasActiveVariant: true,
    ...overrides,
  };
}

describe('productPrice', () => {
  it('retorna null si no se pasa producto', () => {
    expect(productPrice(undefined)).toBeNull();
  });

  it('retorna null si el producto no tiene precio al mayor asignado', () => {
    expect(productPrice(makeProduct())).toBeNull();
  });

  it('prioriza el precio al mayor rebajado sobre el normal al mayor', () => {
    const product = makeProduct({ priceWholesale: '20.00', priceWholesaleSale: '15.00' });
    expect(productPrice(product)).toBe(15);
  });

  it('usa el precio al mayor normal si no hay rebaja', () => {
    const product = makeProduct({ priceWholesale: '20.00' });
    expect(productPrice(product)).toBe(20);
  });
});

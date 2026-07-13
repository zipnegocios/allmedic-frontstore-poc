import { describe, it, expect } from 'vitest';
import { computeLineTotal } from '../line-total';

describe('computeLineTotal', () => {
  it('calcula cantidad × precio sin descuento', () => {
    expect(computeLineTotal({ quantity: 3, unitPrice: 10 })).toBe(30);
  });

  it('aplica descuento porcentual', () => {
    expect(computeLineTotal({ quantity: 2, unitPrice: 100, discountType: 'PERCENTAGE', discountValue: 10 })).toBe(180);
  });

  it('aplica descuento fijo', () => {
    expect(computeLineTotal({ quantity: 2, unitPrice: 100, discountType: 'FIXED', discountValue: 50 })).toBe(150);
  });

  it('no permite importe negativo cuando el descuento fijo excede el bruto', () => {
    expect(computeLineTotal({ quantity: 1, unitPrice: 10, discountType: 'FIXED', discountValue: 999 })).toBe(0);
  });

  it('trata discountType null como descuento fijo (fiel al cálculo original de la tabla)', () => {
    expect(computeLineTotal({ quantity: 2, unitPrice: 10, discountType: null, discountValue: 5 })).toBe(15);
  });

  it('trata discountValue ausente como 0', () => {
    expect(computeLineTotal({ quantity: 2, unitPrice: 10, discountType: 'FIXED' })).toBe(20);
  });
});

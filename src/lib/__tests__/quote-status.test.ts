import { describe, it, expect } from 'vitest';
import { isQuoteExpired } from '../quote-status';

describe('isQuoteExpired', () => {
  it('no está vencida si ya tiene un resultado (outcome)', () => {
    expect(
      isQuoteExpired({ outcome: 'ACCEPTED', expiresAt: '2000-01-01T00:00:00.000Z' })
    ).toBe(false);
  });

  it('no está vencida si no tiene fecha de expiración', () => {
    expect(isQuoteExpired({ outcome: null, expiresAt: null })).toBe(false);
  });

  it('está vencida si no tiene resultado y la fecha ya pasó', () => {
    expect(
      isQuoteExpired({ outcome: null, expiresAt: '2000-01-01T00:00:00.000Z' })
    ).toBe(true);
  });

  it('no está vencida si la fecha de expiración es futura', () => {
    expect(
      isQuoteExpired({ outcome: null, expiresAt: '2999-01-01T00:00:00.000Z' })
    ).toBe(false);
  });
});

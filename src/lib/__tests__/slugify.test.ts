import { describe, it, expect } from 'vitest';
import { slugify } from '../slugify';

describe('slugify', () => {
  it('convierte a minúsculas y separa por guiones', () => {
    expect(slugify('Uniformes Completos')).toBe('uniformes-completos');
  });

  it('elimina caracteres no alfanuméricos', () => {
    expect(slugify('Marca & Co. S.A.')).toBe('marca-co-s-a');
  });

  it('trata acentos y ñ como caracteres no alfanuméricos', () => {
    expect(slugify('Colección Ñandú')).toBe('colecci-n-and');
  });

  it('quita guiones al inicio y al final', () => {
    expect(slugify('  Packs Institucionales  ')).toBe('packs-institucionales');
  });

  it('retorna cadena vacía para texto sin caracteres alfanuméricos', () => {
    expect(slugify('***')).toBe('');
  });
});

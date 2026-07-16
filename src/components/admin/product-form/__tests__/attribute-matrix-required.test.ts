import { describe, it, expect } from 'vitest';
import { getMissingRequiredAttributes } from '../AttributeMatrixSection';
import type { ProductTypeAttributeLink } from '../schema';

function makeLink(overrides: Partial<ProductTypeAttributeLink> = {}): ProductTypeAttributeLink {
  return {
    id: 'link-1',
    productTypeId: 'pt-1',
    attributeId: 'attr-1',
    isRequired: true,
    sortOrder: 0,
    attributeName: 'Corte',
    attributeSlug: 'corte',
    displayType: 'SELECT',
    ...overrides,
  };
}

describe('getMissingRequiredAttributes', () => {
  it('no reporta nada si el tipo de producto no tiene atributos requeridos', () => {
    const links = [makeLink({ isRequired: false })];
    expect(getMissingRequiredAttributes(links, {}, {}, {})).toEqual([]);
  });

  it('reporta un atributo requerido en modo "varía" sin ninguna opción marcada', () => {
    const links = [makeLink({ attributeId: 'a1', isRequired: true })];
    const missing = getMissingRequiredAttributes(links, { a1: 'varying' }, {}, {});
    expect(missing.map((l) => l.attributeId)).toEqual(['a1']);
  });

  it('no reporta un atributo requerido en modo "varía" con al menos una opción marcada', () => {
    const links = [makeLink({ attributeId: 'a1', isRequired: true })];
    const missing = getMissingRequiredAttributes(
      links,
      { a1: 'varying' },
      {},
      { a1: ['val-1'] }
    );
    expect(missing).toEqual([]);
  });

  it('reporta un atributo requerido en modo "fijo" sin valor seleccionado', () => {
    const links = [makeLink({ attributeId: 'a1', isRequired: true })];
    const missing = getMissingRequiredAttributes(links, { a1: 'fixed' }, {}, {});
    expect(missing.map((l) => l.attributeId)).toEqual(['a1']);
  });

  it('no reporta un atributo requerido en modo "fijo" con valor seleccionado', () => {
    const links = [makeLink({ attributeId: 'a1', isRequired: true })];
    const missing = getMissingRequiredAttributes(
      links,
      { a1: 'fixed' },
      { a1: 'val-1' },
      {}
    );
    expect(missing).toEqual([]);
  });

  it('por defecto (sin modo elegido) trata el atributo como "varía", así que reporta si no hay opciones', () => {
    const links = [makeLink({ attributeId: 'a1', isRequired: true })];
    expect(getMissingRequiredAttributes(links, {}, {}, {}).map((l) => l.attributeId)).toEqual(['a1']);
  });

  it('ignora atributos no requeridos aunque estén vacíos', () => {
    const links = [makeLink({ attributeId: 'a1', isRequired: false })];
    expect(getMissingRequiredAttributes(links, { a1: 'varying' }, {}, {})).toEqual([]);
  });

  it('reporta solo los atributos requeridos faltantes entre varios mixtos', () => {
    const links = [
      makeLink({ attributeId: 'a1', isRequired: true, attributeName: 'Corte' }),
      makeLink({ attributeId: 'a2', isRequired: true, attributeName: 'Cuello' }),
      makeLink({ attributeId: 'a3', isRequired: false, attributeName: 'Manga' }),
    ];
    const missing = getMissingRequiredAttributes(
      links,
      { a1: 'varying', a2: 'fixed', a3: 'varying' },
      { a2: 'val-cuello-v' },
      { a1: [] }
    );
    expect(missing.map((l) => l.attributeId)).toEqual(['a1']);
  });
});

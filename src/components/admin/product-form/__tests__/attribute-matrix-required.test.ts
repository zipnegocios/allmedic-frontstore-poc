import { describe, it, expect } from 'vitest';
import { getMissingRequiredStyleAttributes } from '../AttributeStyleSection';
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
    displayType: 'select',
    ...overrides,
  };
}

describe('getMissingRequiredStyleAttributes', () => {
  it('no reporta nada si el tipo de producto no tiene atributos requeridos', () => {
    const links = [makeLink({ isRequired: false })];
    expect(getMissingRequiredStyleAttributes(links, {})).toEqual([]);
  });

  it('reporta un atributo requerido sin valor elegido', () => {
    const links = [makeLink({ attributeId: 'a1', isRequired: true })];
    const missing = getMissingRequiredStyleAttributes(links, {});
    expect(missing.map((l) => l.attributeId)).toEqual(['a1']);
  });

  it('no reporta un atributo requerido con valor elegido', () => {
    const links = [makeLink({ attributeId: 'a1', isRequired: true })];
    const missing = getMissingRequiredStyleAttributes(links, { a1: 'val-1' });
    expect(missing).toEqual([]);
  });

  it('ignora atributos no requeridos aunque estén vacíos', () => {
    const links = [makeLink({ attributeId: 'a1', isRequired: false })];
    expect(getMissingRequiredStyleAttributes(links, {})).toEqual([]);
  });

  it('reporta solo los atributos requeridos faltantes entre varios mixtos', () => {
    const links = [
      makeLink({ attributeId: 'a1', isRequired: true, attributeName: 'Corte' }),
      makeLink({ attributeId: 'a2', isRequired: true, attributeName: 'Cuello' }),
      makeLink({ attributeId: 'a3', isRequired: false, attributeName: 'Manga' }),
    ];
    const missing = getMissingRequiredStyleAttributes(links, { a2: 'val-cuello-v' });
    expect(missing.map((l) => l.attributeId)).toEqual(['a1']);
  });
});

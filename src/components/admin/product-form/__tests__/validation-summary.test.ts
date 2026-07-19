import { describe, it, expect } from 'vitest';
import { buildValidationSummary } from '../validation-summary';
import type { FieldErrors } from 'react-hook-form';
import type { ProductFormData } from '../schema';

function err(message: string) {
  return { type: 'too_small', message };
}

describe('buildValidationSummary', () => {
  it('devuelve lista vacía cuando no hay errores', () => {
    expect(buildValidationSummary({})).toEqual([]);
  });

  it('lista todos los campos top-level inválidos, no solo el primero', () => {
    const errors = {
      code: err('Código de estilo requerido'),
      priceNormal: err('Precio requerido'),
    } as FieldErrors<ProductFormData>;

    const summary = buildValidationSummary(errors);
    expect(summary).toContain('Código de Estilo');
    expect(summary).toContain('Precio Normal');
    expect(summary).toHaveLength(2);
  });

  it('incluye la Portada del Producto (primaria) cuando cover.assetId falla', () => {
    const errors = {
      cover: { assetId: err('Portada requerida') },
    } as FieldErrors<ProductFormData>;

    expect(buildValidationSummary(errors)).toEqual(['Portada del Producto — Imagen Primaria']);
  });

  it('incluye la Portada del Producto (secundaria) cuando secondaryCover.assetId falla', () => {
    const errors = {
      secondaryCover: { assetId: err('Portada secundaria requerida') },
    } as FieldErrors<ProductFormData>;

    expect(buildValidationSummary(errors)).toEqual(['Portada del Producto — Imagen Secundaria']);
  });

  it('reporta cada fila de variante inválida por separado, con los campos exactos que faltan', () => {
    const errors = {
      variants: [
        undefined,
        { colorId: err('Color requerido') },
        { size: err('Talla requerida') },
        { colorId: err('Color requerido'), size: err('Talla requerida') },
      ],
    } as unknown as FieldErrors<ProductFormData>;

    const summary = buildValidationSummary(errors);
    expect(summary).toEqual([
      'Variante 2: falta Color',
      'Variante 3: falta Talla',
      'Variante 4: falta Color y Talla',
    ]);
  });

  it('reporta filas de medios inválidas', () => {
    const errors = {
      images: [{ colorId: err('Color requerido') }],
    } as unknown as FieldErrors<ProductFormData>;

    expect(buildValidationSummary(errors)).toEqual(['Medio 1: falta color asociado']);
  });

  it('combina errores top-level y de variantes en una sola lista completa (caso real reportado: {code, variants})', () => {
    const errors = {
      code: err('Código de estilo requerido'),
      variants: [
        { colorId: err('Color requerido'), size: err('Talla requerida') },
      ],
    } as unknown as FieldErrors<ProductFormData>;

    const summary = buildValidationSummary(errors);
    expect(summary).toEqual(['Código de Estilo', 'Variante 1: falta Color y Talla']);
  });
});

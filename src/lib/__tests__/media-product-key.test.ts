import { describe, it, expect } from 'vitest';
import { buildProductMediaKey, sanitizeCodeSegment, fileNameFromStorageKey, PRODUCT_COVER_SEGMENT } from '../media';

describe('sanitizeCodeSegment', () => {
  it('preserva mayúsculas de códigos de negocio', () => {
    expect(sanitizeCodeSegment('CK3900')).toBe('CK3900');
    expect(sanitizeCodeSegment('BLK')).toBe('BLK');
  });

  it('reemplaza caracteres inválidos por guiones y recorta bordes', () => {
    expect(sanitizeCodeSegment('CK 3900 / Rev.2')).toBe('CK-3900-Rev-2');
    expect(sanitizeCodeSegment('--BLK--')).toBe('BLK');
  });

  it('elimina diacríticos sin perder el resto del texto', () => {
    expect(sanitizeCodeSegment('AZÚL')).toBe('AZUL');
  });
});

describe('buildProductMediaKey', () => {
  it('construye la clave de portada preservando el código de estilo', () => {
    expect(buildProductMediaKey('CK3900', PRODUCT_COVER_SEGMENT, 'Foto Principal.JPG')).toBe(
      'products/CK3900/portada/foto-principal.jpg'
    );
  });

  it('construye la clave de galería por color preservando ambos códigos', () => {
    expect(buildProductMediaKey('CK3900', 'BLK', 'imagen-1.png')).toBe(
      'products/CK3900/BLK/imagen-1.png'
    );
  });

  it('sanea el nombre de archivo en minúsculas como el resto del sistema', () => {
    expect(buildProductMediaKey('2624A', 'WIN', 'Vista Lateral Áéíóú.webp')).toBe(
      'products/2624A/WIN/vista-lateral-aeiou.webp'
    );
  });
});

describe('fileNameFromStorageKey', () => {
  it('extrae el nombre de archivo de una clave con carpetas', () => {
    expect(fileNameFromStorageKey('products/CK3900/BLK/imagen-1.png')).toBe('imagen-1.png');
  });

  it('retorna la clave completa si no tiene carpetas', () => {
    expect(fileNameFromStorageKey('imagen-1.png')).toBe('imagen-1.png');
  });
});

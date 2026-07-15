import { describe, it, expect } from 'vitest';
import { resolveCoverMedia } from '../data-service';
import type { Product, MediaItem } from '../types';

describe('resolveCoverMedia', () => {
  it('retorna la imagen de portada directamente si el producto tiene cover definido', () => {
    const coverImage: MediaItem = {
      url: 'https://media.allmedicuniforms.com/products/cover.jpg',
      type: 'image',
      mimeType: 'image/jpeg',
      width: 800,
      height: 1000,
    };

    const mockProduct = {
      cover: coverImage,
      variants: [
        {
          id: 'v1',
          sku: 'SKU-1',
          colorId: 'color-1',
          size: 'M',
          images: [
            {
              url: 'https://media.allmedicuniforms.com/products/gallery-1.jpg',
              type: 'image',
              mimeType: 'image/jpeg',
              width: 800,
              height: 1000,
            },
          ],
          status: 'AVAILABLE',
        },
      ],
    } as unknown as Product;

    const result = resolveCoverMedia(mockProduct);
    expect(result).toBe(coverImage);
    expect(result.url).toBe('https://media.allmedicuniforms.com/products/cover.jpg');
  });

  it('retorna la primera imagen de variante como fallback si el producto no tiene cover pero sí tiene imágenes en variantes', () => {
    const mockProduct = {
      cover: undefined,
      variants: [
        {
          id: 'v1',
          sku: 'SKU-1',
          colorId: 'color-1',
          size: 'M',
          images: [
            {
              url: 'https://media.allmedicuniforms.com/products/gallery-v1.jpg',
              type: 'image',
              mimeType: 'image/jpeg',
              width: 800,
              height: 1000,
            },
          ],
          status: 'AVAILABLE',
        },
      ],
    } as unknown as Product;

    const result = resolveCoverMedia(mockProduct);
    expect(result.url).toBe('https://media.allmedicuniforms.com/products/gallery-v1.jpg');
  });

  it('retorna la imagen placeholder por defecto si el producto no tiene ninguna imagen asociada', () => {
    const mockProduct = {
      cover: undefined,
      variants: [
        {
          id: 'v1',
          sku: 'SKU-1',
          colorId: 'color-1',
          size: 'M',
          images: [],
          status: 'AVAILABLE',
        },
      ],
    } as unknown as Product;

    const result = resolveCoverMedia(mockProduct);
    expect(result.url).toBe('/images/placeholder-product.jpg');
  });
});

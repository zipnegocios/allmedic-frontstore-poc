import { describe, it, expect } from 'vitest';
import { levenshteinDistance, suggestClosestMatch } from '../fuzzy-match';

describe('levenshteinDistance', () => {
  it('devuelve 0 para strings idénticos', () => {
    expect(levenshteinDistance('cherokee', 'cherokee')).toBe(0);
  });

  it('cuenta la distancia de edición correcta', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });

  it('es simétrica', () => {
    expect(levenshteinDistance('cheroquee', 'cherokee')).toBe(levenshteinDistance('cherokee', 'cheroquee'));
  });
});

describe('suggestClosestMatch', () => {
  const candidates = ['Cherokee', 'Wine', 'Hunter', 'Landau', 'Temporada Clínica Verano'];

  it('sugiere la palabra más cercana dentro del umbral (typo de marca)', () => {
    expect(suggestClosestMatch('cheroquee', candidates)).toBe('Cherokee');
  });

  it('no sugiere nada si no hay ningún candidato razonablemente cercano', () => {
    expect(suggestClosestMatch('xilofonzzz', candidates)).toBeNull();
  });

  it('no sugiere nada si la query ya matchea exacto (case-insensitive)', () => {
    expect(suggestClosestMatch('wine', candidates)).toBeNull();
  });

  it('usa un umbral más estricto para palabras cortas (evita falsos positivos en códigos de color)', () => {
    // "abc" (3 letras) vs "xyz" (3 letras) — distancia 3, muy lejos para una palabra corta.
    expect(suggestClosestMatch('abc', ['xyz'])).toBeNull();
  });

  it('no fuerza una sugerencia lejana aunque exista una palabra parecida en espíritu', () => {
    expect(suggestClosestMatch('climatica', candidates)).toBeNull();
  });
});

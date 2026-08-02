/** Distancia de edición (Levenshtein) entre dos strings — número mínimo de
 * inserciones/eliminaciones/sustituciones para transformar `a` en `b`. */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);
  let currRow = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // eliminación
        currRow[j - 1] + 1, // inserción
        prevRow[j - 1] + cost // sustitución
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }
  return prevRow[n];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // quita acentos
}

/** Umbral de distancia aceptable según longitud de la query — evita sugerencias absurdas en
 * palabras cortas (ej. códigos de color de 3 letras) mientras tolera 2 ediciones en palabras
 * largas (typos reales como "cheroquee" → "cherokee"). */
function maxDistanceFor(length: number): number {
  if (length <= 3) return 1;
  if (length <= 7) return 1;
  return 2;
}

/** Busca, entre `candidates`, la palabra más cercana a `query` por distancia de Levenshtein.
 * Devuelve `null` si `query` ya matchea exacto (substring) contra algún candidato, o si el
 * candidato más cercano supera el umbral. Usado para sugerencias "¿quizás quiso decir...?". */
export function suggestClosestMatch(
  query: string,
  candidates: string[],
  maxDistance?: number
): string | null {
  const normQuery = normalize(query.trim());
  if (!normQuery) return null;

  const uniqueCandidates = Array.from(new Set(candidates.map((c) => c.trim()).filter(Boolean)));

  // Si ya hay un match exacto por substring, no hace falta sugerir nada.
  if (uniqueCandidates.some((c) => normalize(c).includes(normQuery))) return null;

  let best: { candidate: string; distance: number } | null = null;
  for (const candidate of uniqueCandidates) {
    const distance = levenshteinDistance(normQuery, normalize(candidate));
    if (best === null || distance < best.distance) {
      best = { candidate, distance };
    }
  }
  if (!best) return null;

  const threshold = maxDistance ?? maxDistanceFor(normQuery.length);
  return best.distance <= threshold ? best.candidate : null;
}

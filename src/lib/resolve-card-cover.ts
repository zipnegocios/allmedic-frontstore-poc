import type { CorporateSetSummary } from './corporate-types';
import type { MediaItem } from './media';

export interface ResolvedCardCover {
  cover: MediaItem | null;
  secondaryCover: MediaItem | null;
  /** true cuando había un color filtrado pero este set no tiene portada propia para ese color
   * exacto — la card cayó al color por defecto. Dispara el badge "disponible en este color". */
  isFallback: boolean;
}

/** Resuelve qué portada (primaria/secundaria) mostrar en una card del listado de
 * `/corporativo` según el color actualmente filtrado (selección única) — si el set tiene
 * portada propia para ese color, la usa; si no, cae al color por defecto (`coversByColor[0]`,
 * o `cover`/`secondaryCover` ya derivados server-side) y marca `isFallback`. Sin filtro activo,
 * siempre usa el color por defecto sin marcar fallback. Tipo `Pick` (no `CorporateSetSummary`
 * completo) para que también acepte `CorporateSetNavItem`, el tipo liviano del dropdown del
 * Header. */
export function resolveCardCover(
  set: Pick<CorporateSetSummary, 'cover' | 'secondaryCover' | 'coversByColor' | 'colors'>,
  activeColorId: string | null
): ResolvedCardCover {
  const defaultCover: ResolvedCardCover = {
    cover: set.cover,
    secondaryCover: set.secondaryCover,
    isFallback: false,
  };

  if (!activeColorId) return defaultCover;

  const match = set.coversByColor.find((c) => c.colorId === activeColorId);
  if (match) {
    return { cover: match.cover, secondaryCover: match.secondaryCover, isFallback: false };
  }

  // El color filtrado aplica al set (pasó `matchesSetFilters`) pero no tiene portada propia —
  // solo marca fallback si el set efectivamente tiene ese color entre los suyos (evita marcar
  // fallback en sets que ni siquiera deberían aparecer, defensivo si se llama sin filtrar antes).
  const setHasColor = set.colors.some((c) => c.id === activeColorId);
  return { ...defaultCover, isFallback: setHasColor };
}

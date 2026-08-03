'use client';

import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/lib/media';

const GALLERY_RAIL_WINDOW = 4;
const GALLERY_ARROWS_THRESHOLD = 4;

// ── Galería de doble carril (Decisión 13) — compartido entre el PDP inline (Gallery) y el
// Lightbox modal, ambos muestran el mismo carril de miniaturas por bloque. En mobile (< sm) el
// carril pasa de columna vertical (al lado de la imagen) a franja horizontal (arriba/abajo de
// la imagen) — así la imagen central puede ocupar el ancho completo del viewport. Es el mismo
// componente e idéntica lógica de ventana/offset en ambos casos: solo cambia la dirección del
// flex y el ícono de las flechas (Left/Right en vez de Up/Down), el padre decide con `flex-col
// sm:flex-row` en qué orden se apilan A/imagen/B. ──
export function GalleryRail({
  images,
  side,
  focusSide,
  focusIndex,
  onFocus,
  offset,
  setOffset,
}: {
  images: MediaItem[];
  side: 'A' | 'B';
  focusSide: 'A' | 'B';
  focusIndex: number;
  onFocus: (f: { side: 'A' | 'B'; index: number }) => void;
  offset: number;
  setOffset: (updater: (o: number) => number) => void;
}) {
  const total = images.length;
  if (total === 0) return <div className="w-full sm:w-16 flex-shrink-0" />;
  const showArrows = total > GALLERY_ARROWS_THRESHOLD;
  const canPrev = offset > 0;
  const canNext = offset + GALLERY_RAIL_WINDOW < total;
  const visible = Array.from({ length: Math.min(GALLERY_RAIL_WINDOW, total) }, (_, i) => offset + i).filter((i) => i < total);

  return (
    <div className="flex flex-row sm:flex-col items-center justify-center gap-1.5 w-full sm:w-16 flex-shrink-0">
      {showArrows && (
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          className="flex-shrink-0 disabled:opacity-20 text-gray-400 hover:text-[#111111]"
        >
          <ChevronLeft className="w-4 h-4 sm:hidden" />
          <ChevronUp className="w-4 h-4 hidden sm:block" />
        </button>
      )}
      <div className="flex flex-row sm:flex-col gap-1.5">
        {visible.map((idx) => {
          const active = focusSide === side && focusIndex === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onFocus({ side, index: idx })}
              className={cn('relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border-2 bg-[#F5F5F7]', active ? 'border-[#111111]' : 'border-transparent')}
            >
              <MediaGridThumb item={images[idx]} fallback="/images/placeholder-product.jpg" alt="" fit="cover" sizes="64px" className="object-cover" />
            </button>
          );
        })}
      </div>
      {showArrows && (
        <button
          type="button"
          disabled={!canNext}
          onClick={() => setOffset((o) => Math.min(total - GALLERY_RAIL_WINDOW, o + 1))}
          className="flex-shrink-0 disabled:opacity-20 text-gray-400 hover:text-[#111111]"
        >
          <ChevronRight className="w-4 h-4 sm:hidden" />
          <ChevronDown className="w-4 h-4 hidden sm:block" />
        </button>
      )}
    </div>
  );
}

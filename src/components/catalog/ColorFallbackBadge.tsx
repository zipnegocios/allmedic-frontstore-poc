'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** Punto de color en la esquina de una card de set cuando la imagen mostrada es la del color
 * por defecto (no la del color filtrado exacto) — ver `resolveCardCover`. Click/tap abre un
 * Popover táctil (mismo primitive que `MinQuantityInfoPopover`) para no depender de hover. */
export function ColorFallbackBadge({ colorHex, colorName }: { colorHex: string; colorName: string }) {
  return (
    <Popover>
      <PopoverTrigger
        onClick={(e) => e.preventDefault()}
        className="absolute top-3 right-3 w-6 h-6 rounded-full border-2 border-white shadow flex-shrink-0"
        style={{ backgroundColor: colorHex }}
        aria-label={`Disponible en ${colorName} — imagen de referencia`}
      >
        <span className="sr-only">Disponible en {colorName}</span>
      </PopoverTrigger>
      <PopoverContent className="text-sm text-gray-700 w-56" onClick={(e) => e.preventDefault()}>
        Disponible en este color — imagen de referencia
      </PopoverContent>
    </Popover>
  );
}

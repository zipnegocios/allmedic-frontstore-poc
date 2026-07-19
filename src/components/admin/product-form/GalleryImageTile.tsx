'use client';

import { useState } from 'react';
import type { UseFormRegister } from 'react-hook-form';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GripVertical, Trash2, Star, Pencil } from 'lucide-react';
import { MediaThumb } from '@/components/admin/media/MediaThumb';
import { cn } from '@/lib/utils';
import type { ProductFormData } from './schema';

interface GalleryImageTileProps {
  /** Id estable de RHF (`imageField.id`) — identificador para `useSortable`, no el
   * `assetId` del medio (que puede repetirse si el mismo asset se agrega dos veces). */
  fieldId: string;
  absoluteIdx: number;
  storageKey: string;
  mimeType: string;
  alt: string | undefined;
  isPrimary: boolean;
  /** Posición 1-based dentro de la galería del color (según `sortOrder`) — se
   * muestra como badge numérico en las imágenes que no son la principal, y
   * cambia al reordenar (drag o estrella). */
  position: number;
  register: UseFormRegister<ProductFormData>;
  onRemove: () => void;
  onSetPrimary: () => void;
}

/** Miniatura sorteable de la "Galería del Color" — drag handle (GripVertical),
 * eliminar, marcar como imagen principal del color (Star) y editar alt text en un
 * popover (Pencil) sin desplazar el grid. */
export function GalleryImageTile({
  fieldId,
  absoluteIdx,
  storageKey,
  mimeType,
  alt,
  isPrimary,
  position,
  register,
  onRemove,
  onSetPrimary,
}: GalleryImageTileProps) {
  const [altOpen, setAltOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: fieldId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasAlt = Boolean(alt && alt.trim().length > 0);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        // `min-w-0`: sin esto, los items de un grid no se achican más allá de su
        // contenido intrínseco (mínimo implícito `min-width: auto` de CSS Grid) —
        // con textos largos u otros elementos eso podía ensanchar la celda más
        // allá de su columna y desbordar la imagen fuera del recorte del card.
        'relative aspect-square min-w-0 w-full bg-white rounded-lg border overflow-hidden shadow-xs group',
        isDragging && 'opacity-50 z-10'
      )}
    >
      <MediaThumb storageKey={storageKey} mimeType={mimeType} sizes="160px" fit="contain" />

      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 p-1 rounded bg-black/50 text-white cursor-grab active:cursor-grabbing touch-none"
        title="Arrastrar para reordenar"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {/* Estrella: imagen principal del color */}
      <button
        type="button"
        onClick={onSetPrimary}
        className="absolute top-1 right-8 p-1 rounded bg-black/50 hover:bg-black/70"
        title={isPrimary ? 'Imagen principal del color' : 'Marcar como imagen principal del color'}
      >
        <Star className={cn('w-3.5 h-3.5', isPrimary ? 'fill-current text-yellow-400' : 'text-white')} />
      </button>

      {/* Eliminar */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white hover:bg-red-600"
        title="Eliminar de la galería"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <span
        className={cn(
          'absolute bottom-1 left-1 text-[9px] font-semibold px-1.5 py-0.5 rounded',
          isPrimary ? 'bg-yellow-400 text-black' : 'bg-black/60 text-white'
        )}
      >
        {isPrimary ? 'Principal' : position}
      </span>

      {/* Alt text: lápiz + popover */}
      <Popover open={altOpen} onOpenChange={setAltOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="absolute bottom-1 right-1 p-1 rounded bg-white/90 shadow"
            title="Editar texto alternativo"
          >
            <Pencil className={cn('w-3.5 h-3.5', hasAlt ? 'text-emerald-500' : 'text-amber-500')} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
          <Label className="text-[10px] font-semibold text-gray-500">Texto Alternativo</Label>
          <Input
            className="h-8 text-xs mt-1"
            autoFocus
            {...register(`images.${absoluteIdx}.alt`)}
            placeholder="Describe la imagen"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

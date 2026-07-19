'use client';

import { useState } from 'react';
import type { UseFormRegister } from 'react-hook-form';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GripVertical, Trash2, Star, StarHalf, Pencil } from 'lucide-react';
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
  isSecondary: boolean;
  /** Posición 1-based dentro de la galería del color (según `sortOrder`) — se
   * muestra como badge numérico en las imágenes que no son primaria/secundaria, y
   * cambia al reordenar (drag o estrella). */
  position: number;
  register: UseFormRegister<ProductFormData>;
  onRemove: () => void;
  onSetPrimary: () => void;
  onSetSecondary: () => void;
}

/** Miniatura sorteable de la "Galería del Color" — panel de controles apilado a
 * la izquierda (drag, Principal, Secundaria, alt text, eliminar) e imagen vertical
 * a la derecha. Hereda el mismo par primaria/secundaria que "Portada del
 * Producto" (`GeneralPrimarySection`), pero por posición (`sortOrder`) en vez de
 * campos separados: `images[0]` = Principal, `images[1]` = Secundaria. */
export function GalleryImageTile({
  fieldId,
  absoluteIdx,
  storageKey,
  mimeType,
  alt,
  isPrimary,
  isSecondary,
  position,
  register,
  onRemove,
  onSetPrimary,
  onSetSecondary,
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
  const badgeLabel = isPrimary ? 'Principal' : isSecondary ? 'Secundaria' : String(position);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        // `min-w-0`: sin esto, los items de un grid no se achican más allá de su
        // contenido intrínseco (mínimo implícito `min-width: auto` de CSS Grid).
        'min-w-0 w-full bg-white rounded-lg border overflow-hidden shadow-xs',
        isDragging && 'opacity-50 z-10'
      )}
    >
      <div className="flex">
        {/* Panel de controles apilado */}
        <div className="flex flex-col items-center gap-1 p-1.5 bg-gray-50 border-r shrink-0">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="w-7 h-7 flex items-center justify-center rounded bg-white border text-gray-500 cursor-grab active:cursor-grabbing touch-none"
            title="Arrastrar para reordenar"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onSetPrimary}
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded border',
              isPrimary ? 'bg-yellow-400 border-yellow-400' : 'bg-white hover:bg-gray-100'
            )}
            title={isPrimary ? 'Imagen principal del color' : 'Marcar como imagen principal del color'}
          >
            <Star className={cn('w-3.5 h-3.5', isPrimary ? 'fill-current text-black' : 'text-gray-500')} />
          </button>

          <button
            type="button"
            onClick={onSetSecondary}
            disabled={isPrimary}
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded border',
              isSecondary ? 'bg-sky-400 border-sky-400' : 'bg-white hover:bg-gray-100',
              isPrimary && 'opacity-40 cursor-not-allowed hover:bg-white'
            )}
            title={
              isPrimary
                ? 'Ya es la imagen principal — elige otra imagen para la secundaria'
                : isSecondary
                  ? 'Imagen secundaria del color (hover)'
                  : 'Marcar como imagen secundaria del color (hover)'
            }
          >
            <StarHalf className={cn('w-3.5 h-3.5', isSecondary ? 'fill-current text-black' : 'text-gray-500')} />
          </button>

          <Popover open={altOpen} onOpenChange={setAltOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded bg-white border"
                title="Editar texto alternativo"
              >
                <Pencil className={cn('w-3.5 h-3.5', hasAlt ? 'text-emerald-500' : 'text-amber-500')} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start" side="right">
              <Label className="text-[10px] font-semibold text-gray-500">Texto Alternativo</Label>
              <Input
                className="h-8 text-xs mt-1"
                autoFocus
                {...register(`images.${absoluteIdx}.alt`)}
                placeholder="Describe la imagen"
              />
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={onRemove}
            className="w-7 h-7 flex items-center justify-center rounded bg-white border text-red-500 hover:bg-red-50"
            title="Eliminar de la galería"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Imagen — vertical, más alta que ancha (entre 9:16 y un retrato menos
            extremo) */}
        <div className="relative flex-1 min-w-0 aspect-[2/3] bg-white">
          <MediaThumb storageKey={storageKey} mimeType={mimeType} sizes="200px" fit="contain" />
        </div>
      </div>

      <div
        className={cn(
          'text-center text-[10px] font-semibold py-1',
          isPrimary ? 'bg-yellow-400 text-black' : isSecondary ? 'bg-sky-400 text-black' : 'bg-gray-100 text-gray-500'
        )}
      >
        {badgeLabel}
      </div>
    </div>
  );
}

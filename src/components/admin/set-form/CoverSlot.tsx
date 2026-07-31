'use client';

import type { UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ImageIcon } from 'lucide-react';
import type { SetFormData } from './schema';

/** Slot de portada (primaria o secundaria) reusado tanto por la portada única legacy como por
 * cada fila de "Portadas por color" — "Elegir portada" (acción primaria) explora las galerías
 * de las piezas ya agregadas al set (referencia viva, el caso de uso principal en Set × Color);
 * "Subir nueva" (secundaria) abre el picker en modo especial para subir un archivo propio. */
export function CoverSlot({
  label,
  required,
  imageUrl,
  altFieldName,
  error,
  hasPieces,
  onOpenSpecial,
  onOpenContent,
  register,
}: {
  label: string;
  required?: boolean;
  imageUrl: string | undefined;
  altFieldName: `setColors.${number}.coverAlt` | `setColors.${number}.secondaryCoverAlt`;
  error: string | undefined;
  hasPieces: boolean;
  onOpenSpecial: () => void;
  onOpenContent: () => void;
  register: UseFormRegister<SetFormData>;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}{required ? ' *' : ''}</Label>
      <div className="flex items-center gap-3">
        <div className="w-16 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-4 h-4 text-gray-300" />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Button type="button" size="sm" variant="outline" onClick={onOpenContent} disabled={!hasPieces}>
            Elegir portada
          </Button>
          <Button type="button" size="sm" variant="ghost" className="text-xs h-auto py-1" onClick={onOpenSpecial}>
            {imageUrl ? 'Cambiar (subir)' : 'Subir nueva'}
          </Button>
        </div>
      </div>
      {!hasPieces && (
        <p className="text-xs text-amber-600">Agrega piezas al set para poder elegir portada desde sus galerías.</p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {imageUrl && (
        <Input placeholder="Texto alternativo" {...register(altFieldName)} className="h-8 text-xs" />
      )}
    </div>
  );
}

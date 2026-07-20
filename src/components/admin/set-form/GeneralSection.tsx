'use client';

import type { Control, UseFormRegister, UseFormWatch, FieldErrors } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageIcon } from 'lucide-react';
import type { SetFormData } from './schema';

interface GeneralSectionProps {
  register: UseFormRegister<SetFormData>;
  control: Control<SetFormData>;
  errors: FieldErrors<SetFormData>;
  watch: UseFormWatch<SetFormData>;
  hasPieces: boolean;
  /** `mode` distingue las dos formas de elegir portada (paridad con productos):
   * `special` sube/elige un archivo propio del set; `content` explora las
   * galerías de las piezas ya agregadas al set (referencia viva). Cada slot
   * (primaria/secundaria) puede usar un modo distinto. */
  onOpenPicker: (target: 'cover' | 'secondaryCover', mode: 'special' | 'content') => void;
}

function CoverSlot({
  label,
  imageUrl,
  altRegisterName,
  error,
  hasPieces,
  onOpenSpecial,
  onOpenContent,
  register,
}: {
  label: string;
  imageUrl: string | undefined;
  altRegisterName: 'coverAlt' | 'secondaryCoverAlt';
  error: string | undefined;
  hasPieces: boolean;
  onOpenSpecial: () => void;
  onOpenContent: () => void;
  register: UseFormRegister<SetFormData>;
}) {
  return (
    <div className="space-y-2">
      <Label>{label} *</Label>
      <div className="flex items-center gap-3">
        <div className="w-16 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-4 h-4 text-gray-300" />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Button type="button" size="sm" variant="outline" onClick={onOpenSpecial}>
            {imageUrl ? 'Cambiar (subir)' : 'Subir nueva'}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="text-xs h-auto py-1" onClick={onOpenContent} disabled={!hasPieces}>
            Elegir de las piezas
          </Button>
        </div>
      </div>
      {!hasPieces && (
        <p className="text-xs text-amber-600">Agrega piezas al set para poder elegir portada desde sus galerías.</p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {imageUrl && (
        <Input placeholder="Texto alternativo" {...register(altRegisterName)} className="h-8 text-xs" />
      )}
    </div>
  );
}

/**
 * Contenido de "Datos generales" (nombre, slug, descripción, portada,
 * marca, flags Activo/Destacado). Extraído para reutilizarse sin cambios
 * tanto en la vista desktop (Card secuencial) como en el paso 1 del wizard
 * mobile — el paso 1 del wizard coincide 1:1 con este Card, así que no hay
 * duplicación de JSX entre presentaciones.
 */
export function GeneralSection({ register, control, errors, watch, hasPieces, onOpenPicker }: GeneralSectionProps) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input id="slug" {...register('slug')} />
            {errors.slug && <p className="text-sm text-red-500">{errors.slug.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea id="description" {...register('description')} rows={3} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CoverSlot
            label="Portada primaria"
            imageUrl={watch('imageUrl')}
            altRegisterName="coverAlt"
            error={errors.coverAssetId?.message}
            hasPieces={hasPieces}
            onOpenSpecial={() => onOpenPicker('cover', 'special')}
            onOpenContent={() => onOpenPicker('cover', 'content')}
            register={register}
          />
          <CoverSlot
            label="Portada secundaria"
            imageUrl={watch('secondaryImageUrl')}
            altRegisterName="secondaryCoverAlt"
            error={errors.secondaryCoverAssetId?.message}
            hasPieces={hasPieces}
            onOpenSpecial={() => onOpenPicker('secondaryCover', 'special')}
            onOpenContent={() => onOpenPicker('secondaryCover', 'content')}
            register={register}
          />
        </div>

        <p className="text-xs text-gray-500">
          La marca del set se calcula sola a partir de las piezas: si todas son de la misma marca, se
          muestra esa; si son de varias marcas, el set aparece como "Multi-marca".
        </p>

        <div className="flex gap-6 pt-2">
          <div className="flex items-center gap-2">
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />}
            />
            <Label>Activo</Label>
          </div>
          <div className="flex items-center gap-2">
            <Controller
              name="isFeatured"
              control={control}
              render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />}
            />
            <Label>Destacado</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

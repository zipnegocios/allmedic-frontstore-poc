'use client';

import type { Control, FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageIcon, Trash2 } from 'lucide-react';
import { MediaThumb } from '@/components/admin/media/MediaThumb';
import type { ProductFormData } from './schema';
import { VISIBILITY_OPTIONS } from './schema';

interface GeneralPrimarySectionProps {
  control: Control<ProductFormData>;
  register: UseFormRegister<ProductFormData>;
  watch: UseFormWatch<ProductFormData>;
  setValue: UseFormSetValue<ProductFormData>;
  errors: FieldErrors<ProductFormData>;
  embedded: boolean;
  onPickTarget: (target: 'cover' | 'secondaryCover') => void;
}

/** Contenido "siempre visible" de la ficha General: Portada (primaria + secundaria),
 * Nombre/Slug/Descripción, Visibilidad y badges — el bloque principal del producto,
 * sin colapsar (a diferencia de Clasificación/Precios/Características/Cuidado). */
export function GeneralPrimarySection({
  control,
  register,
  watch,
  setValue,
  errors,
  embedded,
  onPickTarget,
}: GeneralPrimarySectionProps) {
  return (
    <Card className="border-2 border-gray-200 dark:border-gray-800">
      <CardContent className="p-6 space-y-5">
        {/* ─── Portada: primaria + secundaria ─── */}
        <div>
          <h3 className="text-base font-semibold text-[#111111] flex items-center gap-1.5">
            Portada del Producto <span className="text-red-500">*</span>
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Se muestran en los listados del catálogo. La secundaria habilita un
            crossfade al pasar el mouse sobre la card (desaparece si el usuario
            elige un color específico).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CoverPicker
              label="Imagen Primaria *"
              required
              storageKey={watch('cover.storageKey')}
              mimeType={watch('cover.mimeType')}
              url={watch('cover.url')}
              altRegisterField={register('cover.alt')}
              onPick={() => onPickTarget('cover')}
              onRemove={() => {
                setValue('cover.assetId', '');
                setValue('cover.url', '');
                setValue('cover.storageKey', '');
                setValue('cover.mimeType', '');
                setValue('cover.alt', '');
              }}
            />
            <CoverPicker
              label="Imagen Secundaria *"
              required
              storageKey={watch('secondaryCover.storageKey')}
              mimeType={watch('secondaryCover.mimeType')}
              url={watch('secondaryCover.url')}
              altRegisterField={register('secondaryCover.alt')}
              onPick={() => onPickTarget('secondaryCover')}
              onRemove={() => {
                setValue('secondaryCover.assetId', '');
                setValue('secondaryCover.url', '');
                setValue('secondaryCover.storageKey', '');
                setValue('secondaryCover.mimeType', '');
                setValue('secondaryCover.alt', '');
              }}
            />
          </div>
        </div>

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
          <Textarea id="description" {...register('description')} rows={4} />
        </div>

        <div className="space-y-2 pt-2">
          <Label htmlFor="visibility">Visibilidad *</Label>
          <Controller
            name="visibility"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="visibility">
                  <SelectValue placeholder="Seleccionar visibilidad" />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map((v) => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-gray-500">
            {VISIBILITY_OPTIONS.find((v) => v.value === watch('visibility'))?.description}
          </p>
          {embedded && watch('visibility') === 'INDIVIDUAL' && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5">
              Con visibilidad &quot;Solo Individual&quot; este producto no aparecerá como pieza elegible en
              ningún set corporativo — cámbiala a &quot;Solo Grupos&quot; o &quot;Ambos&quot; si vas a usarlo aquí.
            </p>
          )}
        </div>

        <div className="flex gap-6 pt-2">
          <div className="flex items-center gap-2">
            <Controller
              name="isNew"
              control={control}
              render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />}
            />
            <Label>Nuevo</Label>
          </div>
          <div className="flex items-center gap-2">
            <Controller
              name="isBestSeller"
              control={control}
              render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />}
            />
            <Label>Best Seller</Label>
          </div>
          <div className="flex items-center gap-2">
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />}
            />
            <Label>Activo</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CoverPickerProps {
  label: string;
  required?: boolean;
  storageKey: string | undefined;
  mimeType: string | undefined;
  url: string | undefined;
  altRegisterField: ReturnType<UseFormRegister<ProductFormData>>;
  onPick: () => void;
  onRemove: () => void;
}

function CoverPicker({ label, required, storageKey, mimeType, url, altRegisterField, onPick, onRemove }: CoverPickerProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-gray-700">{label}</Label>
        <Button type="button" variant="outline" size="sm" onClick={onPick} className="h-7 text-[10px] bg-white">
          <ImageIcon className="w-3 h-3 mr-1" />
          {url ? 'Cambiar' : 'Elegir'}
        </Button>
      </div>
      {storageKey ? (
        <div className="flex gap-3 p-3 bg-gray-50 rounded-lg border items-start">
          <div className="relative w-20 h-20 bg-white rounded-lg overflow-hidden border flex-shrink-0 shadow-sm">
            <MediaThumb storageKey={storageKey} mimeType={mimeType ?? ''} sizes="80px" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <Input className="h-7 text-xs bg-white" {...altRegisterField} placeholder="Texto alternativo" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-1.5 text-[10px]"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Quitar
            </Button>
          </div>
        </div>
      ) : (
        <div className="border border-dashed rounded-lg p-4 text-center text-gray-400 text-[11px] flex flex-col items-center justify-center gap-1.5">
          <ImageIcon className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
          <span>{required ? 'Requerida' : 'Opcional'}</span>
        </div>
      )}
    </div>
  );
}

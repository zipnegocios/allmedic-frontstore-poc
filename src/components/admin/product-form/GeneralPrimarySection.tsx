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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ImageIcon, Trash2, Info } from 'lucide-react';
import { MediaThumb } from '@/components/admin/media/MediaThumb';
import type { Color, ProductFormData } from './schema';
import { COVER_SOURCE_OPTIONS, VISIBILITY_OPTIONS } from './schema';
import { cn } from '@/lib/utils';

interface GeneralPrimarySectionProps {
  control: Control<ProductFormData>;
  register: UseFormRegister<ProductFormData>;
  watch: UseFormWatch<ProductFormData>;
  setValue: UseFormSetValue<ProductFormData>;
  errors: FieldErrors<ProductFormData>;
  embedded: boolean;
  colors: Color[];
  /** Sin código de estilo válido no hay carpeta (`products/{codigo}/...`) donde
   * ubicar los medios — se deshabilita la sección hasta que se declare uno. */
  codeMissing: boolean;
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
  colors,
  codeMissing,
  onPickTarget,
}: GeneralPrimarySectionProps) {
  const coverSource = watch('coverSource') ?? 'CUSTOM';
  const images = watch('images') ?? [];
  const variants = watch('variants') ?? [];
  const firstColorId = variants[0]?.colorId;
  const firstColor = colors.find((c) => c.id === firstColorId);
  const firstColorImages = firstColorId
    ? images.filter((img) => img.colorId === firstColorId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    : [];

  return (
    <Card className="border-2 border-gray-200 dark:border-gray-800">
      <CardContent className="p-6 space-y-5">
        {/* ─── Portada: origen + primaria/secundaria ─── */}
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-semibold text-[#111111] flex items-center gap-1.5">
              Portada del Producto <span className="text-red-500">*</span>
            </h3>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="text-gray-400 hover:text-gray-600" aria-label="Ayuda sobre origen de portada">
                  <Info className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="text-xs space-y-2 max-w-xs">
                {COVER_SOURCE_OPTIONS.map((opt) => (
                  <p key={opt.value}><span className="font-semibold">{opt.label}:</span> {opt.description}</p>
                ))}
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Se muestran en los listados del catálogo. La secundaria habilita un
            crossfade al pasar el mouse sobre la card (desaparece si el usuario
            elige un color específico).
          </p>

          {codeMissing && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5 mb-3">
              Declara un Código de Estilo válido arriba para habilitar la portada — define
              la carpeta del producto en el bucket de medios.
            </p>
          )}

          {/* Switcher de origen */}
          <Controller
            name="coverSource"
            control={control}
            render={({ field }) => (
              <div className={cn('flex gap-2 mb-4 rounded-lg border p-1 bg-gray-50 w-fit', codeMissing && 'opacity-50 pointer-events-none')}>
                {COVER_SOURCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={codeMissing}
                    onClick={() => field.onChange(opt.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                      field.value === opt.value
                        ? 'bg-white shadow-sm text-[#111111]'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          />

          {coverSource === 'CUSTOM' ? (
            <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', codeMissing && 'opacity-50 pointer-events-none')}>
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
          ) : (
            <div className="rounded-lg border border-dashed p-4 bg-gray-50">
              <p className="text-xs text-gray-500 mb-3">
                Vista previa de lo que se hereda del primer color
                {firstColor ? <> (<span className="font-medium">{firstColor.name}</span>)</> : ''}:
              </p>
              {firstColorImages.length >= 2 ? (
                <div className="grid grid-cols-2 gap-3">
                  {['Primaria', 'Secundaria'].map((label, idx) => (
                    <div key={label} className="space-y-1">
                      <div className="relative w-full aspect-square bg-white rounded-lg overflow-hidden border shadow-sm">
                        <MediaThumb storageKey={firstColorImages[idx].storageKey ?? ''} mimeType={firstColorImages[idx].mimeType ?? ''} sizes="200px" />
                      </div>
                      <p className="text-[10px] text-gray-500 text-center">{label}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5">
                  El primer color todavía no tiene 2 imágenes en su galería (pestaña
                  &quot;Variantes y Medios&quot;) — agrégalas para que la portada pública se resuelva.
                </p>
              )}
            </div>
          )}
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

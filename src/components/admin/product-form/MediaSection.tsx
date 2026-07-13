'use client';

import type { Control, UseFormRegister, UseFormWatch, FieldArrayWithId } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageIcon, Trash2 } from 'lucide-react';
import { MediaThumb } from '@/components/admin/media/MediaThumb';
import type { ProductFormData, Color } from './schema';
import { SELECT_EMPTY_VALUE } from './schema';

interface MediaSectionProps {
  control: Control<ProductFormData>;
  register: UseFormRegister<ProductFormData>;
  watch: UseFormWatch<ProductFormData>;
  colors: Color[];
  imageFields: FieldArrayWithId<ProductFormData, 'images', 'id'>[];
  removeImage: (index: number) => void;
  onPickTarget: (target: number | 'append') => void;
}

/**
 * Contenido de "Medios del Producto" (fotos/video por color, vía
 * `MediaPicker`). Extraído para reutilizarse sin cambios tanto en el tab
 * "Medios" de desktop como en el paso 5 del wizard mobile — coincide 1:1
 * con ese tab, sin duplicar JSX entre presentaciones. El `MediaPicker`
 * (dialog modal) permanece en `ProductForm` porque es compartido/único.
 */
export function MediaSection({
  control,
  register,
  watch,
  colors,
  imageFields,
  removeImage,
  onPickTarget,
}: MediaSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Medios del Producto</h3>
          <p className="text-xs text-gray-500">
            El primer medio (orden 0) es la portada. Si es un video, se reproduce mudo y en loop en tarjetas/catálogo dentro de su ventana de vista previa configurada en la Media Library.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => onPickTarget('append')}>
          <ImageIcon className="w-4 h-4 mr-2" />
          Agregar desde Media Library
        </Button>
      </div>

      {imageFields.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            No hay medios. Agrega fotos o videos desde la Media Library.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {imageFields.map((field, index) => (
            <Card key={field.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {watch(`images.${index}.storageKey`) ? (
                      <MediaThumb
                        storageKey={watch(`images.${index}.storageKey`)!}
                        mimeType={watch(`images.${index}.mimeType`) ?? ''}
                        sizes="80px"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">Sin medio</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => onPickTarget(index)}>
                      <ImageIcon className="w-3.5 h-3.5 mr-2" />
                      {watch(`images.${index}.url`) ? 'Cambiar medio' : 'Elegir medio'}
                    </Button>
                    <div>
                      <Label className="text-xs">Alt</Label>
                      <Input className="text-xs" {...register(`images.${index}.alt`)} placeholder="Texto alternativo" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label className="text-xs">Color asociado</Label>
                    <Controller
                      name={`images.${index}.colorId`}
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || SELECT_EMPTY_VALUE} onValueChange={(value) => field.onChange(value === SELECT_EMPTY_VALUE ? '' : value)}>
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Sin color específico" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SELECT_EMPTY_VALUE}>Sin color específico</SelectItem>
                            {colors.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: c.hex }} />
                                  {c.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Orden</Label>
                    <Input className="text-xs w-16" type="number" inputMode="numeric" {...register(`images.${index}.sortOrder`)} />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeImage(index)}
                    className="text-red-500 mt-5"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

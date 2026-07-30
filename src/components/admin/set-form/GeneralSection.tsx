'use client';

import type { Control, UseFormRegister, FieldErrors } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import type { SetFormData } from './schema';

interface GeneralSectionProps {
  register: UseFormRegister<SetFormData>;
  control: Control<SetFormData>;
  errors: FieldErrors<SetFormData>;
}

/**
 * Contenido de "Datos generales" (nombre, slug, descripción, marca, flags
 * Activo/Destacado). Extraído para reutilizarse sin cambios tanto en la vista
 * desktop (Card secuencial) como en el paso 1 del wizard mobile — el paso 1
 * del wizard coincide 1:1 con este Card, así que no hay duplicación de JSX
 * entre presentaciones. Las portadas viven en su propia sección
 * (`SetColorsSection`, "Portadas por color") desacoplada de esta.
 */
export function GeneralSection({ register, control, errors }: GeneralSectionProps) {
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

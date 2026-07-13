'use client';

import type { Control, UseFormRegister, UseFormWatch, FieldErrors } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageIcon } from 'lucide-react';
import type { SetFormData, SetGroup, Brand } from './schema';
import { SELECT_EMPTY_VALUE } from './schema';

interface GeneralSectionProps {
  register: UseFormRegister<SetFormData>;
  control: Control<SetFormData>;
  errors: FieldErrors<SetFormData>;
  watch: UseFormWatch<SetFormData>;
  groups: SetGroup[];
  brands: Brand[];
  onOpenPicker: () => void;
}

/**
 * Contenido de "Datos generales" (nombre, slug, descripción, portada, grupo,
 * marca, flags Activo/Destacado). Extraído para reutilizarse sin cambios
 * tanto en la vista desktop (Card secuencial) como en el paso 1 del wizard
 * mobile — el paso 1 del wizard coincide 1:1 con este Card, así que no hay
 * duplicación de JSX entre presentaciones.
 */
export function GeneralSection({ register, control, errors, watch, groups, brands, onOpenPicker }: GeneralSectionProps) {
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Imagen de portada</Label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                {watch('imageUrl') ? (
                  <img src={watch('imageUrl')} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-gray-300" />
                )}
              </div>
              <Button type="button" size="sm" variant="outline" onClick={onOpenPicker}>
                {watch('imageUrl') ? 'Cambiar' : 'Elegir imagen'}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Grupo de Sets</Label>
            <Controller
              name="setGroupId"
              control={control}
              render={({ field }) => (
                <Select value={field.value || SELECT_EMPTY_VALUE} onValueChange={(v) => field.onChange(v === SELECT_EMPTY_VALUE ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_EMPTY_VALUE}>Sin grupo</SelectItem>
                    {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label>Marca (opcional)</Label>
            <Controller
              name="brandId"
              control={control}
              render={({ field }) => (
                <Select value={field.value || SELECT_EMPTY_VALUE} onValueChange={(v) => field.onChange(v === SELECT_EMPTY_VALUE ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Multi-marca" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_EMPTY_VALUE}>Multi-marca</SelectItem>
                    {brands.map(b => (
                      <SelectItem key={b.id} value={b.id} disabled={!b.isActive}>
                        {b.name}{!b.isActive ? ' (Inactiva)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

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

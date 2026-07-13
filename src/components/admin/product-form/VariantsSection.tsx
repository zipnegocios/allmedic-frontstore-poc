'use client';

import type { Control, UseFormRegister, FieldArrayWithId } from 'react-hook-form';
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
import { Plus, Trash2 } from 'lucide-react';
import type { ProductFormData, Color } from './schema';
import { SIZES, FITS, STATUSES, SELECT_EMPTY_VALUE } from './schema';

interface VariantsSectionProps {
  control: Control<ProductFormData>;
  register: UseFormRegister<ProductFormData>;
  colors: Color[];
  variantFields: FieldArrayWithId<ProductFormData, 'variants', 'id'>[];
  appendVariant: (value: ProductFormData['variants'][number]) => void;
  removeVariant: (index: number) => void;
}

/**
 * Contenido de "Variantes del Producto" (color + talla + fit + SKU + estado
 * + stock + stock mínimo). Extraído para reutilizarse sin cambios tanto en
 * el tab "Variantes" de desktop como en el paso 4 del wizard mobile — el
 * paso 4 del wizard coincide 1:1 con este tab, así que no hay duplicación
 * de JSX entre presentaciones.
 */
export function VariantsSection({
  control,
  register,
  colors,
  variantFields,
  appendVariant,
  removeVariant,
}: VariantsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Variantes del Producto</h3>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            appendVariant({
              colorId: '',
              size: 'M',
              fit: '',
              sku: '',
              status: 'AVAILABLE',
              stock: 0,
              minStock: 5,
            })
          }
        >
          <Plus className="w-4 h-4 mr-2" />
          Agregar Variante
        </Button>
      </div>

      {variantFields.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            No hay variantes. Agrega al menos una variante (color + talla + SKU).
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {variantFields.map((field, index) => (
            <Card key={field.id}>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Color *</Label>
                    <Controller
                      name={`variants.${index}.colorId`}
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Color" />
                          </SelectTrigger>
                          <SelectContent>
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
                  <div className="space-y-1">
                    <Label className="text-xs">Talla *</Label>
                    <Controller
                      name={`variants.${index}.size`}
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Talla" />
                          </SelectTrigger>
                          <SelectContent>
                            {SIZES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fit</Label>
                    <Controller
                      name={`variants.${index}.fit`}
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || SELECT_EMPTY_VALUE} onValueChange={(value) => field.onChange(value === SELECT_EMPTY_VALUE ? '' : value)}>
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Fit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SELECT_EMPTY_VALUE}>—</SelectItem>
                            {FITS.map((f) => (
                              <SelectItem key={f} value={f}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">SKU *</Label>
                    <Input className="text-xs" {...register(`variants.${index}.sku`)} placeholder="SKU" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Estado</Label>
                    <Controller
                      name={`variants.${index}.status`}
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stock</Label>
                    <Input className="text-xs" type="number" inputMode="numeric" {...register(`variants.${index}.stock`)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stock Mín.</Label>
                    <Input className="text-xs" type="number" inputMode="numeric" {...register(`variants.${index}.minStock`)} />
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVariant(index)}
                      className="text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

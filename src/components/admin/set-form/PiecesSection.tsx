'use client';

import type { Control, UseFormRegister, FieldErrors, FieldArrayWithId } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { AlertTriangle, ImageIcon, Pencil, Plus, Trash2, ChevronsUpDown } from 'lucide-react';
import type { SetFormData, EligibleProduct } from './schema';
import { productPrice } from './schema';

interface PricePreview {
  total: number;
  hasMissing: boolean;
}

interface PiecesSectionProps {
  control: Control<SetFormData>;
  register: UseFormRegister<SetFormData>;
  errors: FieldErrors<SetFormData>;
  fields: FieldArrayWithId<SetFormData, 'items', 'id'>[];
  items: SetFormData['items'];
  products: EligibleProduct[];
  append: (value: SetFormData['items'][number]) => void;
  remove: (index: number) => void;
  pieceComboOpen: number | null;
  setPieceComboOpen: (index: number | null) => void;
  onOpenProductDrawer: (target: { productId?: string; targetIndex: number }) => void;
  pricePreview: PricePreview;
}

/**
 * Contenido de "Piezas del Set" (selector de productos elegibles + cantidad
 * por pieza + vista previa de precio referencial). Extraído para
 * reutilizarse sin cambios tanto en la vista desktop (Card secuencial) como
 * en el paso 2 del wizard mobile.
 */
export function PiecesSection({
  control,
  register,
  errors,
  fields,
  items,
  products,
  append,
  remove,
  pieceComboOpen,
  setPieceComboOpen,
  onOpenProductDrawer,
  pricePreview,
}: PiecesSectionProps) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Piezas del Set</h3>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                append({ productId: '', quantityPerSet: 1 });
                onOpenProductDrawer({ targetIndex: fields.length });
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear producto nuevo
            </Button>
            <Button type="button" variant="outline" onClick={() => append({ productId: '', quantityPerSet: 1 })}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar pieza
            </Button>
          </div>
        </div>
        {errors.items && typeof errors.items.message === 'string' && (
          <p className="text-sm text-red-500">{errors.items.message}</p>
        )}

        {fields.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            No hay piezas agregadas. Agrega al menos una pieza (producto con visibilidad &quot;Solo Grupos&quot; o &quot;Ambos&quot;).
          </p>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => {
              const productId = items[index]?.productId;
              const product = products.find((p) => p.id === productId);
              const price = productPrice(product);
              const warnings: string[] = [];
              if (product) {
                if (product.visibility === 'INDIVIDUAL') {
                  warnings.push('Visibilidad "Solo Individual" — no aparecerá en ningún set corporativo hasta que la cambies.');
                }
                if (price === null) {
                  warnings.push('Sin precio al mayor asignado — no aporta al precio automático del set.');
                }
                if (!product.hasActiveVariant) {
                  warnings.push('Sin variantes activas — no está disponible en ningún color/talla.');
                }
              }
              return (
                <div key={field.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-end gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {product?.imageUrl ? (
                        <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Producto *</Label>
                      <Controller
                        name={`items.${index}.productId`}
                        control={control}
                        render={({ field: selectField }) => (
                          <Popover open={pieceComboOpen === index} onOpenChange={(open) => setPieceComboOpen(open ? index : null)}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between font-normal"
                              >
                                {product ? `${product.name}${product.brandName ? ` (${product.brandName})` : ''}` : 'Buscar producto...'}
                                <ChevronsUpDown className="w-4 h-4 opacity-50 ml-2 flex-shrink-0" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[420px] max-w-[calc(100vw-2rem)] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Buscar por nombre o marca..." />
                                <CommandList>
                                  <CommandEmpty>Sin resultados.</CommandEmpty>
                                  <CommandGroup>
                                    {products.map((p) => (
                                      <CommandItem
                                        key={p.id}
                                        value={`${p.name} ${p.brandName ?? ''}`}
                                        onSelect={() => {
                                          selectField.onChange(p.id);
                                          setPieceComboOpen(null);
                                        }}
                                      >
                                        <div className="w-8 h-8 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                                          {p.imageUrl ? (
                                            <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                              <ImageIcon className="w-3 h-3" />
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm truncate">{p.name}</p>
                                          <p className="text-xs text-gray-400 truncate">
                                            {p.brandName ?? 'Sin marca'} · {productPrice(p) !== null ? `$${productPrice(p)!.toFixed(2)}` : 'Sin precio'}
                                          </p>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                      />
                    </div>

                    <div className="w-28 space-y-1">
                      <Label className="text-xs">Cantidad por set</Label>
                      <Input type="number" min={1} inputMode="numeric" {...register(`items.${index}.quantityPerSet`)} />
                    </div>

                    <div className="w-24 text-sm text-right">
                      {productId && (
                        price !== null ? (
                          <span className="text-gray-600">${price.toFixed(2)}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600 text-xs justify-end">
                            <AlertTriangle className="w-3 h-3" /> Sin precio
                          </span>
                        )
                      )}
                    </div>

                    {productId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenProductDrawer({ productId, targetIndex: index })}
                        title="Editar producto"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {product && (product.colors.length > 0 || product.sizes.length > 0) && (
                    <div className="flex items-center gap-3 pl-16 text-xs text-gray-500">
                      {product.colors.length > 0 && (
                        <div className="flex items-center gap-1">
                          {product.colors.map((c) => (
                            <span
                              key={c.id}
                              className="w-3 h-3 rounded-full border border-gray-300"
                              style={{ backgroundColor: c.hex }}
                              title={c.name}
                            />
                          ))}
                        </div>
                      )}
                      {product.sizes.length > 0 && <span>Tallas: {product.sizes.join(', ')}</span>}
                    </div>
                  )}

                  {warnings.length > 0 && (
                    <div className="pl-16 space-y-1">
                      {warnings.map((w, i) => (
                        <p key={i} className="flex items-center gap-1.5 text-xs text-amber-600">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          {w}
                          <button
                            type="button"
                            className="underline hover:no-underline"
                            onClick={() => onOpenProductDrawer({ productId, targetIndex: index })}
                          >
                            Completar en la ficha
                          </button>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Vista previa de precio referencial ── */}
        {fields.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <span className="font-medium">Precio referencial del set (suma automática)</span>
              <span className="text-2xl font-bold text-[#111111]">${pricePreview.total.toFixed(2)}</span>
            </div>
            {pricePreview.hasMissing && (
              <Badge variant="destructive" className="mt-2 gap-1">
                <AlertTriangle className="w-3 h-3" />
                Una o más piezas no tienen precio al mayor asignado
              </Badge>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Suma automática de precios al mayor (o rebajado al mayor si aplica) × cantidad por set.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

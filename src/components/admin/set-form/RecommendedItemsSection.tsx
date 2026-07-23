'use client';

import type { Control, FieldArrayWithId } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ImageIcon, Pencil, Plus, Trash2, ChevronsUpDown } from 'lucide-react';
import type { SetFormData, EligibleProduct } from './schema';
import { productPrice } from './schema';

interface RecommendedItemsSectionProps {
  control: Control<SetFormData>;
  fields: FieldArrayWithId<SetFormData, 'recommendedItems', 'id'>[];
  items: SetFormData['recommendedItems'];
  products: EligibleProduct[];
  append: (value: SetFormData['recommendedItems'][number]) => void;
  remove: (index: number) => void;
  comboOpenIndex: number | null;
  setComboOpenIndex: (index: number | null) => void;
  onOpenProductDrawer: (target: { productId?: string; recommendedIndex: number }) => void;
}

/**
 * "Piezas recomendadas" — sugerencias opcionales de la misma colección/marca (chaqueta, bata,
 * gorro, accesorio). Lista libre sin límite y sin cantidad propia: el cliente la agrega a su
 * cotización de forma independiente (color/talla/cantidad propios), sin relación con los bloques
 * ni con el precio referencial del set (Decisión 2 del plan).
 */
export function RecommendedItemsSection({
  control,
  fields,
  items,
  products,
  append,
  remove,
  comboOpenIndex,
  setComboOpenIndex,
  onOpenProductDrawer,
}: RecommendedItemsSectionProps) {
  const usedProductIds = items.map((i) => i.productId).filter(Boolean);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">Piezas recomendadas</h3>
            <p className="text-xs text-gray-500 mt-1">
              Sugerencias opcionales de la misma colección o marca. El cliente las agrega a su cotización de forma
              libre — color, talla y cantidad propios, sin relación con la cantidad de sets. No afectan el precio
              referencial del set.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const index = fields.length;
                append({ productId: '' });
                onOpenProductDrawer({ recommendedIndex: index });
              }}
            >
              <Plus className="w-4 h-4 mr-1" /> Crear producto nuevo
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '' })}>
              <Plus className="w-4 h-4 mr-1" /> Agregar pieza
            </Button>
          </div>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">No hay piezas recomendadas agregadas. Son opcionales.</p>
        ) : (
          <div className="space-y-2">
            {fields.map((field, index) => {
              const productId = items[index]?.productId;
              const product = products.find((p) => p.id === productId);
              const price = productPrice(product);

              return (
                <div key={field.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 flex-shrink-0 overflow-hidden">
                    {product?.imageUrl ? (
                      <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <Controller
                      name={`recommendedItems.${index}.productId`}
                      control={control}
                      render={({ field: selectField }) => (
                        <Popover open={comboOpenIndex === index} onOpenChange={(open) => setComboOpenIndex(open ? index : null)}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                              <span className="truncate">
                                {product ? `${product.name}${product.brandName ? ` (${product.brandName})` : ''}` : 'Buscar producto...'}
                              </span>
                              <ChevronsUpDown className="w-4 h-4 opacity-50 ml-2 flex-shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[420px] max-w-[calc(100vw-2rem)] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar por nombre, código, marca o colección..." />
                              <CommandList>
                                <CommandEmpty>Sin resultados.</CommandEmpty>
                                <CommandGroup>
                                  {products.map((p) => {
                                    const alreadyUsed = p.id !== productId && usedProductIds.includes(p.id);
                                    return (
                                      <CommandItem
                                        key={p.id}
                                        disabled={alreadyUsed}
                                        value={`${p.name} ${p.code ?? ''} ${p.sku ?? ''} ${p.brandName ?? ''} ${p.collectionName ?? ''}`}
                                        onSelect={() => {
                                          if (alreadyUsed) return;
                                          selectField.onChange(p.id);
                                          setComboOpenIndex(null);
                                        }}
                                        className={alreadyUsed ? 'opacity-50 cursor-not-allowed' : undefined}
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
                                          <p className="text-sm truncate">{p.name}{p.code ? ` (${p.code})` : ''}</p>
                                          <p className="text-xs text-gray-400 truncate">
                                            {alreadyUsed
                                              ? 'Ya está en las recomendadas'
                                              : `${p.brandName ?? 'Sin marca'}${p.collectionName ? ` · ${p.collectionName}` : ''} · ${productPrice(p) !== null ? `$${productPrice(p)!.toFixed(2)}` : 'Sin precio'}`}
                                          </p>
                                        </div>
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}
                    />
                  </div>

                  <p className="text-sm text-gray-500 flex-shrink-0 w-16 text-right">
                    {price !== null ? `$${price.toFixed(2)}` : '—'}
                  </p>

                  {productId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0"
                      title="Editar producto"
                      onClick={() => onOpenProductDrawer({ productId, recommendedIndex: index })}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="flex-shrink-0">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

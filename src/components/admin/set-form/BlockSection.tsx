'use client';

import type { Control, UseFormRegister, FieldErrors } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { AlertTriangle, ImageIcon, Pencil, Sparkles, ChevronsUpDown } from 'lucide-react';
import type { SetFormData, EligibleProduct } from './schema';
import { productPrice } from './schema';

interface BlockSectionProps {
  blockIndex: 0 | 1;
  blockCode: 'A' | 'B';
  control: Control<SetFormData>;
  register: UseFormRegister<SetFormData>;
  errors: FieldErrors<SetFormData>;
  products: EligibleProduct[];
  optionComboOpen: string | null; // `${blockIndex}-${optionIndex}` | null
  setOptionComboOpen: (key: string | null) => void;
  onOpenProductDrawer: (target: { productId?: string; blockIndex: 0 | 1; optionIndex: 0 | 1 }) => void;
  selectedProductIds: string[]; // todos los productId ya usados en cualquier bloque, para evitar duplicados
  optionProductIds: [string, string]; // productId de las 2 opciones de ESTE bloque
}

/**
 * Un bloque de alternancia (A o B) — exactamente 2 piezas alternativas, cada una con atajos de
 * crear producto nuevo / editar producto, y un solo campo "Cantidad por set" en la cabecera
 * (compartido por sus 2 opciones, no por fila). Sin botón para agregar una tercera opción ni
 * para quitar las existentes — el bloque siempre tiene exactamente 2 (Decisión 1 del plan).
 */
export function BlockSection({
  blockIndex,
  blockCode,
  control,
  register,
  errors,
  products,
  optionComboOpen,
  setOptionComboOpen,
  onOpenProductDrawer,
  selectedProductIds,
  optionProductIds,
}: BlockSectionProps) {
  const blockErrors = errors.blocks?.[blockIndex];
  const prices = optionProductIds.map((id) => productPrice(products.find((p) => p.id === id)));
  let cheapestIdx = -1;
  let cheapestPrice = Infinity;
  prices.forEach((p, idx) => {
    if (p !== null && p < cheapestPrice) {
      cheapestPrice = p;
      cheapestIdx = idx;
    }
  });

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            Bloque {blockCode}
            <Badge variant="outline" className="font-normal text-xs">2 / 2 piezas — fijo</Badge>
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            El cliente final elige 1 de estas 2 opciones en la ficha pública. Este bloque no admite agregar ni quitar
            piezas — cada una puede editarse o reemplazarse por un producto nuevo con los íconos de la derecha.
          </p>
        </div>

        <div className="space-y-3">
          {([0, 1] as const).map((optionIndex) => {
            const productId = optionProductIds[optionIndex];
            const product = products.find((p) => p.id === productId);
            const price = productPrice(product);
            const comboKey = `${blockIndex}-${optionIndex}`;
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
            const fieldError = blockErrors?.options?.[optionIndex]?.productId;

            return (
              <div key={optionIndex} className="p-3 border rounded-lg space-y-2">
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
                      name={`blocks.${blockIndex}.options.${optionIndex}.productId`}
                      control={control}
                      render={({ field: selectField }) => (
                        <Popover open={optionComboOpen === comboKey} onOpenChange={(open) => setOptionComboOpen(open ? comboKey : null)}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                              {product ? `${product.name}${product.brandName ? ` (${product.brandName})` : ''}` : 'Buscar producto...'}
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
                                    const alreadyUsed = p.id !== productId && selectedProductIds.includes(p.id);
                                    return (
                                      <CommandItem
                                        key={p.id}
                                        disabled={alreadyUsed}
                                        value={`${p.name} ${p.code ?? ''} ${p.sku ?? ''} ${p.brandName ?? ''} ${p.collectionName ?? ''}`}
                                        onSelect={() => {
                                          if (alreadyUsed) return;
                                          selectField.onChange(p.id);
                                          setOptionComboOpen(null);
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
                                              ? 'Ya está en este set'
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
                    {fieldError && <p className="text-xs text-red-500">{fieldError.message}</p>}
                  </div>

                  <div className="text-right flex-shrink-0 w-24">
                    {productId && (
                      price !== null ? (
                        <>
                          <p className="text-sm font-semibold">${price.toFixed(2)}</p>
                          {cheapestIdx === optionIndex && (
                            <Badge variant="secondary" className="mt-1 text-xs">más económica</Badge>
                          )}
                        </>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 text-xs justify-end">
                          <AlertTriangle className="w-3 h-3" /> Sin precio
                        </span>
                      )
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    title="Crear producto nuevo para esta pieza"
                    onClick={() => onOpenProductDrawer({ blockIndex, optionIndex })}
                  >
                    <Sparkles className="w-4 h-4" />
                  </Button>
                  {productId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0"
                      title="Editar producto"
                      onClick={() => onOpenProductDrawer({ productId, blockIndex, optionIndex })}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
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
                          onClick={() => onOpenProductDrawer({ productId, blockIndex, optionIndex })}
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

        <div className="flex items-center gap-3 pt-3 border-t">
          <Label className="text-xs text-gray-500 whitespace-nowrap">
            Cantidad por set <span className="text-gray-400">(una sola, aplica sin importar cuál de las 2 elija el cliente)</span>
          </Label>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            className="w-20"
            {...register(`blocks.${blockIndex}.quantityPerSet`)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

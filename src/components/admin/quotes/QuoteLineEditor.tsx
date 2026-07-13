'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { computeLineTotal } from './quote-line-editor/line-total';

export type DiscountType = 'PERCENTAGE' | 'FIXED';

export interface PricingBreakdownEntry {
  ruleId: string;
  ruleName: string;
  kind: string;
  amount: number;
}

export interface EditableQuoteItem {
  id?: string;
  kind: 'CATALOG' | 'FREE';
  productId?: string | null;
  variantId?: string | null;
  setId?: string | null;
  size?: string | null;
  color?: string | null;
  description: string;
  quantity: number;
  suggestedUnitPrice?: number | null;
  unitPrice: number;
  discountType?: DiscountType | null;
  discountValue?: number;
  taxRateOverride?: number | null;
  pricingBreakdown?: PricingBreakdownEntry[] | null;
  sortOrder: number;
}

interface CatalogOption {
  id: string;
  name: string;
}

// Contenido del desglose de precio del motor de reglas — compartido entre el
// Popover de la tabla (desktop) y el de las tarjetas (mobile), sin duplicar
// el JSX ni el criterio de cuándo mostrarlo (`pricingBreakdown` con al menos
// una entrada).
function PriceBreakdownContent({ item }: { item: EditableQuoteItem }) {
  return (
    <>
      <p className="font-medium mb-1">Desglose del motor de reglas</p>
      {item.pricingBreakdown!.map((b, i) => (
        <div key={i} className="flex justify-between py-0.5">
          <span>{b.ruleName}</span>
          <span>-${b.amount.toFixed(2)}</span>
        </div>
      ))}
      {item.suggestedUnitPrice != null && (
        <p className="mt-2 text-gray-500">Sugerido: ${Number(item.suggestedUnitPrice).toFixed(2)}</p>
      )}
    </>
  );
}

export function QuoteLineEditor({
  items,
  onChange,
  channel,
}: {
  items: EditableQuoteItem[];
  onChange: (items: EditableQuoteItem[]) => void;
  channel: 'CORPORATE' | 'RETAIL';
}) {
  const isMobile = useIsMobile();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([]);
  const [openBreakdown, setOpenBreakdown] = useState<number | null>(null);

  useEffect(() => {
    if (!catalogOpen) return;
    const timeout = setTimeout(() => {
      const url = channel === 'CORPORATE'
        ? '/api/admin/sets'
        : `/api/admin/products?search=${encodeURIComponent(catalogSearch)}&limit=20`;
      fetch(url)
        .then((r) => r.json())
        .then((d) => {
          const list = channel === 'CORPORATE' ? (d.sets ?? []) : (d.products ?? []);
          const filtered = channel === 'CORPORATE'
            ? list.filter((s: { name: string }) => s.name.toLowerCase().includes(catalogSearch.toLowerCase()))
            : list;
          setCatalogOptions(filtered.map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
        })
        .catch(() => setCatalogOptions([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [catalogOpen, catalogSearch, channel]);

  function addCatalogItem(option: CatalogOption) {
    const nextItem: EditableQuoteItem = {
      kind: 'CATALOG',
      setId: channel === 'CORPORATE' ? option.id : null,
      productId: channel === 'RETAIL' ? option.id : null,
      description: option.name,
      quantity: 1,
      unitPrice: 0,
      suggestedUnitPrice: null,
      discountValue: 0,
      sortOrder: items.length,
    };
    onChange([...items, nextItem]);
    setCatalogOpen(false);
    setCatalogSearch('');
  }

  function addFreeItem() {
    onChange([
      ...items,
      { kind: 'FREE', description: '', quantity: 1, unitPrice: 0, discountValue: 0, sortOrder: items.length },
    ]);
  }

  function updateItem(index: number, patch: Partial<EditableQuoteItem>) {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    onChange(next);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index).map((it, i) => ({ ...it, sortOrder: i })));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((it, i) => ({ ...it, sortOrder: i })));
  }

  const catalogSearchPanel = (
    <>
      <Input
        placeholder="Buscar por nombre..."
        value={catalogSearch}
        onChange={(e) => setCatalogSearch(e.target.value)}
        autoFocus
      />
      <div className="max-h-72 overflow-y-auto divide-y">
        {catalogOptions.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Sin resultados</p>
        ) : (
          catalogOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="w-full text-left py-2 px-1 hover:bg-gray-50 text-sm min-h-11 md:min-h-0"
              onClick={() => addCatalogItem(opt)}
            >
              {opt.name}
            </button>
          ))
        )}
      </div>
    </>
  );

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <Button variant="outline" size="sm" className="gap-2 min-h-11 md:h-8 md:min-h-0" onClick={() => setCatalogOpen(true)}>
          <Plus className="w-4 h-4" />
          Agregar del catálogo
        </Button>
        <ResponsiveDialog
          open={catalogOpen}
          onOpenChange={(open) => {
            setCatalogOpen(open);
            if (!open) setCatalogSearch('');
          }}
          title={channel === 'CORPORATE' ? 'Buscar set' : 'Buscar producto'}
        >
          <div className="space-y-3">{catalogSearchPanel}</div>
        </ResponsiveDialog>
        <Button variant="outline" size="sm" className="gap-2 min-h-11 md:h-8 md:min-h-0" onClick={addFreeItem}>
          <Plus className="w-4 h-4" />
          Agregar línea libre
        </Button>
      </div>

      {isMobile ? (
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-center py-6 text-gray-500 text-sm">
              Sin líneas todavía — agrega del catálogo o una línea libre.
            </p>
          ) : (
            items.map((item, index) => {
              const lineTotal = computeLineTotal(item);
              const differsFromSuggested =
                item.suggestedUnitPrice != null && Number(item.suggestedUnitPrice) !== Number(item.unitPrice);
              const hasBreakdown = !!item.pricingBreakdown && item.pricingBreakdown.length > 0;

              return (
                <Card key={index}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs text-gray-500 mb-1 block">Descripción</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, { description: e.target.value })}
                          disabled={item.kind === 'CATALOG'}
                          className="text-sm"
                        />
                      </div>
                      <div className="flex gap-1 shrink-0 pt-5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-11 w-11"
                          onClick={() => moveItem(index, -1)}
                          disabled={index === 0}
                          aria-label="Mover línea arriba"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-11 w-11"
                          onClick={() => moveItem(index, 1)}
                          disabled={index === items.length - 1}
                          aria-label="Mover línea abajo"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-11 w-11 text-red-500"
                          onClick={() => removeItem(index)}
                          aria-label="Eliminar línea"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Talla</Label>
                        <Input
                          value={item.size ?? ''}
                          onChange={(e) => updateItem(index, { size: e.target.value || null })}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Color</Label>
                        <Input
                          value={item.color ?? ''}
                          onChange={(e) => updateItem(index, { color: e.target.value || null })}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Cantidad</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, { quantity: Number(e.target.value) || 1 })}
                          className="text-sm min-h-11"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">P. Unit.</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) || 0 })}
                            className={`text-sm min-h-11 ${differsFromSuggested ? 'border-amber-400' : ''}`}
                          />
                          {hasBreakdown && (
                            <Popover open={openBreakdown === index} onOpenChange={(o) => setOpenBreakdown(o ? index : null)}>
                              <PopoverTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0" title="Ver desglose">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent side="bottom" align="start" className="w-64 text-xs">
                                <PriceBreakdownContent item={item} />
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500 mb-1 block">Descuento</Label>
                        <Select
                          value={item.discountType ?? 'NONE'}
                          onValueChange={(v) => updateItem(index, { discountType: v === 'NONE' ? null : (v as DiscountType) })}
                        >
                          <SelectTrigger className="text-xs min-h-11"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">Sin descuento</SelectItem>
                            <SelectItem value="PERCENTAGE">% Porcentaje</SelectItem>
                            <SelectItem value="FIXED">$ Fijo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {item.discountType && (
                        <div className="w-24">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={item.discountValue ?? 0}
                            onChange={(e) => updateItem(index, { discountValue: Number(e.target.value) || 0 })}
                            className="text-sm min-h-11"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center border-t pt-2 text-sm">
                      <span className="text-gray-500">Importe</span>
                      <span className="font-medium">${lineTotal.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-24">Talla</TableHead>
              <TableHead className="w-24">Color</TableHead>
              <TableHead className="w-20">Cant.</TableHead>
              <TableHead className="w-28">P. Unit.</TableHead>
              <TableHead className="w-24">Desc.</TableHead>
              <TableHead className="w-28 text-right">Importe</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-gray-500 text-sm">
                  Sin líneas todavía — agrega del catálogo o una línea libre.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => {
                const lineTotal = computeLineTotal(item);
                const differsFromSuggested =
                  item.suggestedUnitPrice != null && Number(item.suggestedUnitPrice) !== Number(item.unitPrice);

                return (
                  <TableRow key={index}>
                    <TableCell>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(index, { description: e.target.value })}
                        disabled={item.kind === 'CATALOG'}
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.size ?? ''}
                        onChange={(e) => updateItem(index, { size: e.target.value || null })}
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.color ?? ''}
                        onChange={(e) => updateItem(index, { color: e.target.value || null })}
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: Number(e.target.value) || 1 })}
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) || 0 })}
                          className={`text-sm ${differsFromSuggested ? 'border-amber-400' : ''}`}
                        />
                        {item.pricingBreakdown && item.pricingBreakdown.length > 0 && (
                          <Popover open={openBreakdown === index} onOpenChange={(o) => setOpenBreakdown(o ? index : null)}>
                            <PopoverTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" title="Ver desglose">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 text-xs">
                              <PriceBreakdownContent item={item} />
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Select
                          value={item.discountType ?? 'NONE'}
                          onValueChange={(v) => updateItem(index, { discountType: v === 'NONE' ? null : (v as DiscountType) })}
                        >
                          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">—</SelectItem>
                            <SelectItem value="PERCENTAGE">%</SelectItem>
                            <SelectItem value="FIXED">$</SelectItem>
                          </SelectContent>
                        </Select>
                        {item.discountType && (
                          <Input
                            type="number"
                            step="0.01"
                            value={item.discountValue ?? 0}
                            onChange={(e) => updateItem(index, { discountValue: Number(e.target.value) || 0 })}
                            className="text-sm w-16"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">${lineTotal.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveItem(index, -1)} disabled={index === 0}>
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1}>
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => removeItem(index)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';

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

export function QuoteLineEditor({
  items,
  onChange,
  channel,
}: {
  items: EditableQuoteItem[];
  onChange: (items: EditableQuoteItem[]) => void;
  channel: 'CORPORATE' | 'RETAIL';
}) {
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

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Agregar del catálogo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{channel === 'CORPORATE' ? 'Buscar set' : 'Buscar producto'}</DialogTitle>
            </DialogHeader>
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
                    className="w-full text-left py-2 px-1 hover:bg-gray-50 text-sm"
                    onClick={() => addCatalogItem(opt)}
                  >
                    {opt.name}
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="sm" className="gap-2" onClick={addFreeItem}>
          <Plus className="w-4 h-4" />
          Agregar línea libre
        </Button>
      </div>

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
              const gross = item.quantity * item.unitPrice;
              const discount = item.discountType === 'PERCENTAGE'
                ? gross * ((item.discountValue ?? 0) / 100)
                : (item.discountValue ?? 0);
              const lineTotal = Math.max(0, gross - Math.min(discount, gross));
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
                            <p className="font-medium mb-1">Desglose del motor de reglas</p>
                            {item.pricingBreakdown.map((b, i) => (
                              <div key={i} className="flex justify-between py-0.5">
                                <span>{b.ruleName}</span>
                                <span>-${b.amount.toFixed(2)}</span>
                              </div>
                            ))}
                            {item.suggestedUnitPrice != null && (
                              <p className="mt-2 text-gray-500">Sugerido: ${Number(item.suggestedUnitPrice).toFixed(2)}</p>
                            )}
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
    </div>
  );
}

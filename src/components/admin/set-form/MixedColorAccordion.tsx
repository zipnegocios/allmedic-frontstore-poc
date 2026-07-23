'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CollapsibleSection } from '@/components/admin/product-form/CollapsibleSection';
import { ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-react';
import type { EligibleProduct, SetColorComboData } from './schema';

interface MixedColorAccordionProps {
  setId: string | undefined;
  /** Lista aplanada de las 4 opciones de bloque (2 bloques × 2 opciones) — nunca piezas recomendadas. */
  items: Array<{ productId: string }>;
  products: EligibleProduct[];
}

/**
 * Acordeón del modo "Piezas mezcladas por color" — el admin cura combinaciones fijas de color
 * por pieza (ej. Pieza A en BLACK + Pieza B en WINE). Estas combinaciones reemplazan por completo
 * la selección libre de color que hacía el comprador en el armador público (SetDetailContent.tsx
 * lee `colorCombos` en vez de dejar elegir color por pieza cuando el set está en este modo).
 */
export function MixedColorAccordion({ setId, items, products }: MixedColorAccordionProps) {
  const [combos, setCombos] = useState<SetColorComboData[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);

  const pieces = items
    .map((item) => products.find((p) => p.id === item.productId))
    .filter((p): p is EligibleProduct => Boolean(p));

  const refreshCombos = useCallback(async () => {
    if (!setId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sets/${setId}/color-combos`);
      if (res.ok) setCombos((await res.json()).combos || []);
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    refreshCombos();
  }, [refreshCombos]);

  function startDraft() {
    const initial: Record<string, string> = {};
    for (const piece of pieces) initial[piece.id] = '';
    setDraft(initial);
  }

  async function saveDraft() {
    if (!setId || !draft) return;
    const comboItems = pieces.map((p) => ({ productId: p.id, colorCode: draft[p.id] }));
    if (comboItems.some((i) => !i.colorCode)) {
      toast.error('Elige un color para cada pieza de la combinación');
      return;
    }
    try {
      const res = await fetch(`/api/admin/sets/${setId}/color-combos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: comboItems }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al guardar la combinación');
      }
      toast.success('Combinación agregada');
      setDraft(null);
      await refreshCombos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar la combinación');
    }
  }

  async function toggleActive(combo: SetColorComboData) {
    if (!setId) return;
    await fetch(`/api/admin/sets/${setId}/color-combos/${combo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !combo.isActive }),
    });
    await refreshCombos();
  }

  async function move(combo: SetColorComboData, direction: -1 | 1) {
    if (!setId) return;
    const sorted = [...combos].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((c) => c.id === combo.id);
    const swapWith = sorted[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      fetch(`/api/admin/sets/${setId}/color-combos/${combo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: swapWith.sortOrder }),
      }),
      fetch(`/api/admin/sets/${setId}/color-combos/${swapWith.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: combo.sortOrder }),
      }),
    ]);
    await refreshCombos();
  }

  async function remove(combo: SetColorComboData) {
    if (!setId) return;
    if (!confirm('¿Eliminar esta combinación?')) return;
    await fetch(`/api/admin/sets/${setId}/color-combos/${combo.id}`, { method: 'DELETE' });
    await refreshCombos();
  }

  function colorLabel(productId: string, colorCode: string) {
    const product = products.find((p) => p.id === productId);
    const color = product?.colors.find((c) => c.code === colorCode);
    return { name: color?.name ?? colorCode, hex: color?.hex ?? '#ccc' };
  }

  return (
    <CollapsibleSection title="Piezas del Set mezcladas por color" defaultOpen>
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Define combinaciones específicas de color por pieza — el comprador solo podrá elegir
          entre las combinaciones que agregues aquí, no colores libres por pieza.
        </p>

        {!setId ? (
          <p className="text-sm text-gray-500">Guarda el set primero para poder gestionar sus combinaciones de color.</p>
        ) : pieces.length === 0 ? (
          <p className="text-sm text-gray-500">Agrega piezas al set antes de crear combinaciones.</p>
        ) : (
          <>
            {loading ? (
              <p className="text-sm text-gray-500">Cargando combinaciones...</p>
            ) : combos.length === 0 && !draft ? (
              <p className="text-sm text-gray-500 py-2">No hay combinaciones agregadas.</p>
            ) : (
              <div className="space-y-2">
                {[...combos].sort((a, b) => a.sortOrder - b.sortOrder).map((combo, idx, arr) => (
                  <div key={combo.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1 flex flex-wrap items-center gap-3">
                      {combo.items.map((i) => {
                        const { name, hex } = colorLabel(i.productId, i.colorCode);
                        const product = products.find((p) => p.id === i.productId);
                        return (
                          <span key={i.productId} className="inline-flex items-center gap-1.5 text-sm">
                            <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: hex }} />
                            {product?.name ?? i.productId}: {name}
                          </span>
                        );
                      })}
                    </div>
                    <Switch checked={combo.isActive} onCheckedChange={() => toggleActive(combo)} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => move(combo, -1)} disabled={idx === 0}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => move(combo, 1)} disabled={idx === arr.length - 1}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(combo)} className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {draft ? (
              <div className="p-3 border rounded-lg space-y-3">
                {pieces.map((piece) => (
                  <div key={piece.id} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
                    <span className="text-sm">{piece.name}{piece.code ? ` (${piece.code})` : ''}</span>
                    <Select value={draft[piece.id] ?? ''} onValueChange={(v) => setDraft((prev) => ({ ...(prev ?? {}), [piece.id]: v }))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona un color..." /></SelectTrigger>
                      <SelectContent>
                        {piece.colors.map((c) => (
                          <SelectItem key={c.id} value={c.code}>
                            <span className="inline-flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full border border-gray-300 inline-block" style={{ backgroundColor: c.hex }} />
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={saveDraft}>Guardar combinación</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={startDraft}>
                <Plus className="w-4 h-4 mr-2" />
                Agregar combinación
              </Button>
            )}
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}

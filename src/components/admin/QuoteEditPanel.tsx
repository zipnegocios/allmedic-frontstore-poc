'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_ORDER } from '@/lib/quote-status';

interface QuoteHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string | Date | null;
}

interface QuoteEditPanelProps {
  quoteId: string;
  currentStatus: string;
  currentQuotedTotal: string | null;
  currentInternalNotes: string | null;
  history: QuoteHistoryEntry[];
}

export function QuoteEditPanel({
  quoteId,
  currentStatus,
  currentQuotedTotal,
  currentInternalNotes,
  history,
}: QuoteEditPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [quotedTotal, setQuotedTotal] = useState(currentQuotedTotal ?? '');
  const [internalNotes, setInternalNotes] = useState(currentInternalNotes ?? '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          quotedTotal: quotedTotal || undefined,
          internalNotes: internalNotes || undefined,
          note: note || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Cotización actualizada');
      setNote('');
      router.refresh();
    } catch {
      toast.error('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 mt-6">
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold">Gestión de la cotización</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Estado</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUOTE_STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>{QUOTE_STATUS_LABELS[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">Total cotizado (precios reales)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={quotedTotal}
                onChange={(e) => setQuotedTotal(e.target.value)}
                placeholder="Ej. 1250.00"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Notas internas</label>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Notas visibles solo para el equipo de ventas"
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">Nota del cambio (queda en el historial)</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Se ajustó precio de piezas fuera de talla estándar"
              rows={2}
            />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">Historial de estados</h3>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">Sin cambios de estado registrados todavía.</p>
          ) : (
            <div className="space-y-3">
              {history.map((h) => (
                <div key={h.id} className="flex items-start gap-3 text-sm border-l-2 border-[#E5E5E5] pl-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {h.fromStatus && (
                        <>
                          <Badge variant="secondary" className="text-xs">
                            {QUOTE_STATUS_LABELS[h.fromStatus]?.label ?? h.fromStatus}
                          </Badge>
                          <span className="text-gray-400">→</span>
                        </>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {QUOTE_STATUS_LABELS[h.toStatus]?.label ?? h.toStatus}
                      </Badge>
                    </div>
                    {h.note && <p className="text-gray-600 mt-1">{h.note}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {h.createdAt ? new Date(h.createdAt).toLocaleString('es-EC') : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

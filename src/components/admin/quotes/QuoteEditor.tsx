'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { RefreshCw, Download, Mail, Globe, Check, X } from 'lucide-react';
import { QuoteLineEditor, type EditableQuoteItem } from './QuoteLineEditor';
import { computeQuoteTotals } from '@/lib/quotes/totals';
import { QUOTE_STATUS_LABELS, QUOTE_OUTCOME_LABELS } from '@/lib/quote-status';

interface TaxPreset { id: string; name: string; rate: string; pricesIncludeTaxDefault: boolean; isActive: boolean }
interface ValidityPreset { id: string; name: string; days: number; isActive: boolean }

export interface QuoteEditorData {
  id: string;
  quoteNumber: string | null;
  status: 'DRAFT' | 'FINAL';
  outcome: 'ACCEPTED' | 'REJECTED' | null;
  channel: 'CORPORATE' | 'RETAIL';
  accountId: string | null;
  leadId: string | null;
  customerName: string;
  customerIdNumber: string | null;
  customerContactName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  customerCity: string | null;
  taxPresetId: string | null;
  taxRate: string;
  pricesIncludeTax: boolean;
  discountType: 'PERCENTAGE' | 'FIXED' | null;
  discountValue: string;
  validityPresetId: string | null;
  validityDays: number | null;
  expiresAt: string | null;
  notes: string | null;
  pdfKey: string | null;
  sentByEmailAt: string | null;
  publishedToPortalAt: string | null;
  items: EditableQuoteItem[];
}

function toNum(v: string | number | null | undefined): number {
  return v == null ? 0 : Number(v);
}

export function QuoteEditor({ initialQuote }: { initialQuote: QuoteEditorData }) {
  const router = useRouter();
  const [quote, setQuote] = useState(initialQuote);
  const [items, setItems] = useState<EditableQuoteItem[]>(initialQuote.items);
  const [propagate, setPropagate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [taxPresets, setTaxPresets] = useState<TaxPreset[]>([]);
  const [validityPresets, setValidityPresets] = useState<ValidityPreset[]>([]);

  useEffect(() => {
    fetch('/api/admin/quote-config/tax-presets').then((r) => r.json()).then((d) => setTaxPresets(d.presets ?? []));
    fetch('/api/admin/quote-config/validity-presets').then((r) => r.json()).then((d) => setValidityPresets(d.presets ?? []));
  }, []);

  const totals = useMemo(
    () =>
      computeQuoteTotals(
        items.map((i) => ({
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountType: i.discountType,
          discountValue: i.discountValue,
          taxRateOverride: i.taxRateOverride,
        })),
        { taxRate: toNum(quote.taxRate), pricesIncludeTax: quote.pricesIncludeTax, discountType: quote.discountType, discountValue: toNum(quote.discountValue) }
      ),
    [items, quote.taxRate, quote.pricesIncludeTax, quote.discountType, quote.discountValue]
  );

  const isFinal = quote.status === 'FINAL';
  const isExpired = !quote.outcome && !!quote.expiresAt && new Date(quote.expiresAt) < new Date();

  const buildPatch = useCallback(() => ({
    customerName: quote.customerName,
    customerIdNumber: quote.customerIdNumber,
    customerContactName: quote.customerContactName,
    customerEmail: quote.customerEmail,
    customerPhone: quote.customerPhone,
    customerAddress: quote.customerAddress,
    customerCity: quote.customerCity,
    taxPresetId: quote.taxPresetId,
    taxRate: toNum(quote.taxRate),
    pricesIncludeTax: quote.pricesIncludeTax,
    discountType: quote.discountType,
    discountValue: toNum(quote.discountValue),
    validityPresetId: quote.validityPresetId,
    validityDays: quote.validityDays,
    expiresAt: quote.expiresAt,
    notes: quote.notes,
    items,
    propagateToProfile: propagate,
  }), [quote, items, propagate]);

  async function saveDraft(showToast = true) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPatch()),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json();
      setQuote(updated);
      setItems(updated.items);
      if (showToast) toast.success('Cotización guardada');
      return updated;
    } catch {
      toast.error('Error al guardar la cotización');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveClick() {
    if (isFinal) {
      setConfirmRegenerate(true);
      return;
    }
    await saveDraft();
  }

  async function confirmSaveFinal() {
    setConfirmRegenerate(false);
    await saveDraft();
    toast.info('El PDF se regeneró con los cambios');
  }

  async function handleRecalculate() {
    const saved = await saveDraft(false);
    if (!saved) return;
    setRecalculating(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}/recalculate`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json();
      setQuote(updated);
      setItems(updated.items.map((i: EditableQuoteItem) => ({
        ...i,
        unitPrice: Number(i.unitPrice) === 0 && i.suggestedUnitPrice != null ? Number(i.suggestedUnitPrice) : Number(i.unitPrice),
      })));
      toast.success('Sugeridos recalculados');
    } catch {
      toast.error('Error al recalcular sugeridos');
    } finally {
      setRecalculating(false);
    }
  }

  async function handleFinalize() {
    const saved = await saveDraft(false);
    if (!saved) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}/finalize`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setQuote(data);
      setItems(data.items);
      toast.success(`Cotización definitiva generada: ${data.quoteNumber}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar la definitiva');
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(action: 'send-email' | 'publish', label: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setQuote(data);
      toast.success(label);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Error: ${label}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleOutcome(outcome: 'ACCEPTED' | 'REJECTED') {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setQuote(data);
      toast.success(outcome === 'ACCEPTED' ? 'Marcada como Aceptada' : 'Marcada como Rechazada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar el resultado');
    } finally {
      setSaving(false);
    }
  }

  function applyValidityPreset(presetId: string) {
    const preset = validityPresets.find((p) => p.id === presetId);
    if (!preset) return;
    const expiresAt = new Date(Date.now() + preset.days * 24 * 60 * 60 * 1000);
    setQuote({ ...quote, validityPresetId: preset.id, validityDays: preset.days, expiresAt: expiresAt.toISOString() });
  }

  function applyTaxPreset(presetId: string) {
    const preset = taxPresets.find((p) => p.id === presetId);
    if (!preset) return;
    setQuote({ ...quote, taxPresetId: preset.id, taxRate: preset.rate, pricesIncludeTax: preset.pricesIncludeTaxDefault });
  }

  const statusInfo = QUOTE_STATUS_LABELS[quote.status] ?? { label: quote.status, variant: 'secondary' as const };
  const outcomeInfo = quote.outcome ? QUOTE_OUTCOME_LABELS[quote.outcome] : null;

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">
            {quote.quoteNumber ?? 'Cotización — Borrador'}
          </h1>
          <div className="flex gap-2 mt-2">
            <Badge variant={outcomeInfo?.variant ?? statusInfo.variant}>{outcomeInfo?.label ?? statusInfo.label}</Badge>
            {isExpired && <Badge variant="destructive">Vencida</Badge>}
            {quote.sentByEmailAt && <Badge variant="outline" className="gap-1"><Mail className="w-3 h-3" />Enviada</Badge>}
            {quote.publishedToPortalAt && <Badge variant="outline" className="gap-1"><Globe className="w-3 h-3" />Publicada</Badge>}
          </div>
        </div>
        <Button variant="ghost" onClick={() => router.push('/admin/cotizaciones')}>Volver al listado</Button>
      </div>

      {/* Datos del cliente */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Datos del cliente</h2>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <Checkbox checked={propagate} onCheckedChange={(v) => setPropagate(!!v)} />
              Actualizar también la ficha del cliente
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="mb-1 block">Nombre / Razón social</Label>
              <Input value={quote.customerName} onChange={(e) => setQuote({ ...quote, customerName: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block">RUC / Cédula</Label>
              <Input value={quote.customerIdNumber ?? ''} onChange={(e) => setQuote({ ...quote, customerIdNumber: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block">Contacto</Label>
              <Input value={quote.customerContactName ?? ''} onChange={(e) => setQuote({ ...quote, customerContactName: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block">Correo</Label>
              <Input value={quote.customerEmail ?? ''} onChange={(e) => setQuote({ ...quote, customerEmail: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block">Teléfono</Label>
              <Input value={quote.customerPhone ?? ''} onChange={(e) => setQuote({ ...quote, customerPhone: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block">Ciudad</Label>
              <Input value={quote.customerCity ?? ''} onChange={(e) => setQuote({ ...quote, customerCity: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block">Dirección</Label>
              <Input value={quote.customerAddress ?? ''} onChange={(e) => setQuote({ ...quote, customerAddress: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Líneas */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Líneas</h2>
            <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={recalculating} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
              Recalcular sugeridos
            </Button>
          </div>
          <QuoteLineEditor items={items} onChange={setItems} channel={quote.channel} />
        </CardContent>
      </Card>

      {/* Totales */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-semibold">Impuestos y descuento</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1 block">Preset de impuesto</Label>
              <Select value={quote.taxPresetId ?? 'NONE'} onValueChange={(v) => v !== 'NONE' && applyTaxPreset(v)}>
                <SelectTrigger><SelectValue placeholder="Sin preset" /></SelectTrigger>
                <SelectContent>
                  {taxPresets.filter((p) => p.isActive).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({Number(p.rate)}%)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block">Tasa (%)</Label>
              <Input type="number" step="0.01" value={quote.taxRate} onChange={(e) => setQuote({ ...quote, taxRate: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={quote.pricesIncludeTax} onCheckedChange={(v) => setQuote({ ...quote, pricesIncludeTax: v })} />
              <Label>Los precios ya incluyen el impuesto</Label>
            </div>
            <div className="flex gap-2">
              <Select
                value={quote.discountType ?? 'NONE'}
                onValueChange={(v) => setQuote({ ...quote, discountType: v === 'NONE' ? null : (v as 'PERCENTAGE' | 'FIXED') })}
              >
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sin descuento global</SelectItem>
                  <SelectItem value="PERCENTAGE">% Porcentaje</SelectItem>
                  <SelectItem value="FIXED">$ Fijo</SelectItem>
                </SelectContent>
              </Select>
              {quote.discountType && (
                <Input
                  type="number"
                  step="0.01"
                  value={quote.discountValue}
                  onChange={(e) => setQuote({ ...quote, discountValue: e.target.value })}
                />
              )}
            </div>
          </div>

          <div className="border-t pt-4 space-y-1 text-sm max-w-xs ml-auto">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>${totals.subtotal.toFixed(2)}</span></div>
            {totals.totalDiscount > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Descuento</span><span>-${totals.totalDiscount.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-500">Impuesto</span><span>${totals.totalTax.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-base border-t pt-1 mt-1"><span>Total</span><span>${totals.total.toFixed(2)}</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Vigencia */}
      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold mb-4">Vigencia</h2>
          <div className="grid grid-cols-3 gap-4 items-end">
            <div>
              <Label className="mb-1 block">Preset</Label>
              <Select value={quote.validityPresetId ?? 'NONE'} onValueChange={(v) => v !== 'NONE' && applyValidityPreset(v)}>
                <SelectTrigger><SelectValue placeholder="Sin preset" /></SelectTrigger>
                <SelectContent>
                  {validityPresets.filter((p) => p.isActive).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block">Días</Label>
              <Input
                type="number"
                value={quote.validityDays ?? ''}
                onChange={(e) => setQuote({ ...quote, validityDays: Number(e.target.value) || null })}
              />
            </div>
            <div className="text-sm">
              <p className="text-gray-500">Vence:</p>
              <p className="font-medium">{quote.expiresAt ? new Date(quote.expiresAt).toLocaleDateString('es-EC') : '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notas */}
      <Card>
        <CardContent className="p-6">
          <Label className="mb-1 block">Notas</Label>
          <Textarea value={quote.notes ?? ''} onChange={(e) => setQuote({ ...quote, notes: e.target.value })} rows={3} />
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2 sticky bottom-4 bg-white/95 backdrop-blur p-4 rounded-lg border shadow-sm">
        <Button onClick={handleSaveClick} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        {!isFinal && (
          <Button variant="secondary" onClick={handleFinalize} disabled={saving || items.length === 0}>
            Generar cotización definitiva
          </Button>
        )}
        {isFinal && (
          <>
            <Button variant="outline" asChild className="gap-2">
              <a href={`/api/admin/quotes/${quote.id}/pdf`} target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4" /> Descargar PDF
              </a>
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={saving || !quote.customerEmail}
              title={!quote.customerEmail ? 'La cotización no tiene correo de cliente' : undefined}
              onClick={() => handleAction('send-email', 'Cotización enviada por correo')}
            >
              <Mail className="w-4 h-4" /> Enviar por correo
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={saving || quote.channel !== 'CORPORATE' || !quote.accountId}
              title={quote.channel !== 'CORPORATE' || !quote.accountId ? 'Solo disponible para cotizaciones corporativas con cuenta vinculada' : undefined}
              onClick={() => handleAction('publish', 'Publicada en el portal del cliente')}
            >
              <Globe className="w-4 h-4" /> Publicar en portal
            </Button>
            {!quote.outcome && (
              <>
                <Button variant="outline" className="gap-2 text-green-700" onClick={() => handleOutcome('ACCEPTED')}>
                  <Check className="w-4 h-4" /> Marcar Aceptada
                </Button>
                <Button variant="outline" className="gap-2 text-red-700" onClick={() => handleOutcome('REJECTED')}>
                  <X className="w-4 h-4" /> Marcar Rechazada
                </Button>
              </>
            )}
          </>
        )}
      </div>

      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Esta cotización ya es definitiva</AlertDialogTitle>
            <AlertDialogDescription>
              Al guardar se regenerará el PDF sobre el mismo enlace. La versión anterior dejará de estar disponible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSaveFinal}>Guardar y regenerar PDF</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

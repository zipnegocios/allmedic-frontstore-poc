'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface CorporateAccountOption {
  id: string;
  razonSocial: string;
  ruc: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
}

interface LeadOption {
  id: string;
  customerName: string;
  customerCity: string;
  customerPhone: string | null;
}

type ChannelChoice = 'CORPORATE' | 'RETAIL';
type SourceChoice = 'EXISTING' | 'NEW';

export default function NewQuotePage() {
  const router = useRouter();
  const [channel, setChannel] = useState<ChannelChoice>('CORPORATE');
  const [source, setSource] = useState<SourceChoice>('EXISTING');
  const [accounts, setAccounts] = useState<CorporateAccountOption[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);

  const [inline, setInline] = useState({
    customerName: '', customerIdNumber: '', customerContactName: '',
    customerEmail: '', customerPhone: '', customerAddress: '', customerCity: '',
  });

  useEffect(() => {
    setSelectedId('');
    if (channel === 'CORPORATE') {
      fetch('/api/admin/corporate-accounts?status=APPROVED')
        .then((r) => r.json())
        .then((d) => setAccounts(d.accounts ?? []))
        .catch(() => toast.error('Error al cargar cuentas corporativas'));
    } else {
      fetch('/api/admin/leads?limit=100')
        .then((r) => r.json())
        .then((d) => setLeads(d.leads ?? []))
        .catch(() => toast.error('Error al cargar prospectos'));
    }
  }, [channel]);

  async function handleCreate() {
    setSaving(true);
    try {
      let payload: Record<string, unknown>;

      if (source === 'EXISTING') {
        if (!selectedId) {
          toast.error('Selecciona un cliente');
          setSaving(false);
          return;
        }
        if (channel === 'CORPORATE') {
          const acc = accounts.find((a) => a.id === selectedId);
          if (!acc) return;
          payload = {
            channel, accountId: acc.id,
            customerName: acc.razonSocial, customerIdNumber: acc.ruc,
            customerContactName: acc.contactName, customerEmail: acc.email,
            customerPhone: acc.phone, customerCity: acc.city,
          };
        } else {
          const lead = leads.find((l) => l.id === selectedId);
          if (!lead) return;
          payload = {
            channel, leadId: lead.id,
            customerName: lead.customerName, customerPhone: lead.customerPhone,
            customerCity: lead.customerCity,
          };
        }
      } else {
        if (!inline.customerName.trim()) {
          toast.error('El nombre del cliente es obligatorio');
          setSaving(false);
          return;
        }
        payload = { channel, ...inline };
      }

      const res = await fetch('/api/admin/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      const quote = await res.json();
      router.push(`/admin/cotizaciones/${quote.id}`);
    } catch {
      toast.error('Error al crear la cotización');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-[#111111] mb-6">Nueva cotización</h1>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div>
            <Label className="mb-2 block">Canal</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as ChannelChoice)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CORPORATE">Corporativo</SelectItem>
                <SelectItem value="RETAIL">Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Origen del cliente</Label>
            <Select value={source} onValueChange={(v) => setSource(v as SourceChoice)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EXISTING">
                  {channel === 'CORPORATE' ? 'Cuenta corporativa existente' : 'Prospecto existente'}
                </SelectItem>
                <SelectItem value="NEW">Cliente nuevo (captura inline)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {source === 'EXISTING' ? (
            <div>
              <Label className="mb-2 block">Cliente</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger>
                <SelectContent>
                  {channel === 'CORPORATE'
                    ? accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.razonSocial} — {a.ruc}</SelectItem>
                      ))
                    : leads.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.customerName} — {l.customerCity}</SelectItem>
                      ))}
                </SelectContent>
              </Select>
              {channel === 'CORPORATE' && accounts.length === 0 && (
                <p className="text-xs text-gray-500 mt-2">No hay cuentas corporativas aprobadas.</p>
              )}
              {channel === 'RETAIL' && leads.length === 0 && (
                <p className="text-xs text-gray-500 mt-2">No hay prospectos registrados.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="mb-1 block">Nombre / Razón social *</Label>
                <Input value={inline.customerName} onChange={(e) => setInline({ ...inline, customerName: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block">RUC / Cédula</Label>
                <Input value={inline.customerIdNumber} onChange={(e) => setInline({ ...inline, customerIdNumber: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block">Contacto</Label>
                <Input value={inline.customerContactName} onChange={(e) => setInline({ ...inline, customerContactName: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block">Correo</Label>
                <Input value={inline.customerEmail} onChange={(e) => setInline({ ...inline, customerEmail: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block">Teléfono</Label>
                <Input value={inline.customerPhone} onChange={(e) => setInline({ ...inline, customerPhone: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block">Ciudad</Label>
                <Input value={inline.customerCity} onChange={(e) => setInline({ ...inline, customerCity: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block">Dirección</Label>
                <Input value={inline.customerAddress} onChange={(e) => setInline({ ...inline, customerAddress: e.target.value })} />
              </div>
            </div>
          )}

          <Button onClick={handleCreate} disabled={saving} className="w-full">
            {saving ? 'Creando...' : 'Crear borrador'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

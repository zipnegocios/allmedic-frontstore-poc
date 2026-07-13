'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MediaPicker } from '@/components/admin/media/MediaPicker';
import { resolveMediaUrl } from '@/lib/media';
import Image from 'next/image';

interface CompanySettings {
  id: string;
  logoMediaId: string | null;
  razonSocial: string;
  ruc: string;
  address: string | null;
  phones: string | null;
  email: string | null;
  website: string | null;
  footerNote: string | null;
}

export function CompanySettingsForm() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/quote-config/company-settings')
      .then((r) => r.json())
      .then((d: CompanySettings | null) => setSettings(d))
      .catch(() => toast.error('Error al cargar datos de empresa'));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/quote-config/company-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Datos de empresa actualizados');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <p className="text-sm text-gray-500">Cargando...</p>;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <Label className="mb-2 block">Logo (para el membrete del PDF)</Label>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <Image src={logoUrl} alt="Logo" width={120} height={60} className="object-contain border rounded" />
            ) : (
              <div className="w-[120px] h-[60px] border rounded flex items-center justify-center text-xs text-gray-400">
                Sin logo
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              Seleccionar de la Biblioteca
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block">Razón social</Label>
            <Input value={settings.razonSocial} onChange={(e) => setSettings({ ...settings, razonSocial: e.target.value })} />
          </div>
          <div>
            <Label className="mb-1 block">RUC</Label>
            <Input value={settings.ruc} onChange={(e) => setSettings({ ...settings, ruc: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label className="mb-1 block">Dirección</Label>
            <Input value={settings.address ?? ''} onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
          </div>
          <div>
            <Label className="mb-1 block">Teléfonos</Label>
            <Input value={settings.phones ?? ''} onChange={(e) => setSettings({ ...settings, phones: e.target.value })} />
          </div>
          <div>
            <Label className="mb-1 block">Correo</Label>
            <Input value={settings.email ?? ''} onChange={(e) => setSettings({ ...settings, email: e.target.value })} />
          </div>
          <div>
            <Label className="mb-1 block">Sitio web</Label>
            <Input value={settings.website ?? ''} onChange={(e) => setSettings({ ...settings, website: e.target.value })} />
          </div>
        </div>
        <div>
          <Label className="mb-1 block">Nota de pie de página (PDF)</Label>
          <Textarea value={settings.footerNote ?? ''} onChange={(e) => setSettings({ ...settings, footerNote: e.target.value })} rows={2} />
        </div>

        <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
      </CardContent>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        folder="SITE"
        segments={['cotizaciones']}
        multiple={false}
        onConfirm={(assets) => {
          const asset = assets[0];
          if (asset) {
            setSettings({ ...settings, logoMediaId: asset.id });
            setLogoUrl(resolveMediaUrl(asset.storageKey));
          }
          setPickerOpen(false);
        }}
      />
    </Card>
  );
}

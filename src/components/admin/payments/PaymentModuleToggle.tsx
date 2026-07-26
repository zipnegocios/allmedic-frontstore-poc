'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export function PaymentModuleToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch('/api/admin/payment-settings')
      .then((r) => r.json())
      .then((d) => setEnabled(d.enabled ?? false))
      .catch(() => toast.error('Error al cargar el estado del módulo de Honorarios Staff'));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle() {
    if (enabled === null) return;
    const next = !enabled;
    setSaving(true);
    setEnabled(next);
    const res = await fetch('/api/admin/payment-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error('Error al actualizar el módulo de Honorarios Staff');
      load();
      return;
    }
    toast.success(next ? 'Módulo de Honorarios Staff activado' : 'Módulo de Honorarios Staff desactivado');
  }

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <h2 className="font-semibold mb-1">Honorarios Staff</h2>
        <p className="text-sm text-gray-500 mb-4">
          Interruptor maestro del módulo de pagos por productividad al staff interno. Apagado,
          la sección &quot;Honorarios Staff&quot; se oculta del panel para todos los roles y
          sus rutas devuelven 403, sin importar los permisos concedidos.
        </p>
        <div className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Módulo de Honorarios Staff</p>
            <p className="text-xs text-gray-500">{enabled ? 'Activo — visible en el panel' : 'Inactivo — oculto en el panel'}</p>
          </div>
          <Switch checked={enabled ?? false} disabled={enabled === null || saving} onCheckedChange={toggle} />
        </div>
      </CardContent>
    </Card>
  );
}

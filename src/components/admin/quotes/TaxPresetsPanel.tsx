'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdminListCard } from '@/components/admin/AdminListCard';

interface TaxPreset {
  id: string;
  name: string;
  rate: string;
  pricesIncludeTaxDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

export function TaxPresetsPanel() {
  const [presets, setPresets] = useState<TaxPreset[]>([]);
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState('');
  const [newIncludes, setNewIncludes] = useState(true);

  const load = useCallback(() => {
    fetch('/api/admin/quote-config/tax-presets')
      .then((r) => r.json())
      .then((d) => setPresets(d.presets ?? []))
      .catch(() => toast.error('Error al cargar presets de impuestos'));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!newName.trim() || !newRate) {
      toast.error('Nombre y tasa son obligatorios');
      return;
    }
    const res = await fetch('/api/admin/quote-config/tax-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, rate: Number(newRate), pricesIncludeTaxDefault: newIncludes, sortOrder: presets.length }),
    });
    if (!res.ok) { toast.error('Error al crear preset'); return; }
    setNewName(''); setNewRate(''); setNewIncludes(true);
    load();
  }

  async function toggleActive(preset: TaxPreset) {
    await fetch(`/api/admin/quote-config/tax-presets/${preset.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !preset.isActive }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/quote-config/tax-presets/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <h2 className="font-semibold mb-4">Presets de impuestos</h2>

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tasa</TableHead>
                <TableHead>Precios incluyen impuesto (default)</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {presets.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-6">Sin presets de impuestos configurados — crea el primero.</TableCell></TableRow>
              ) : presets.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{Number(p.rate)}%</TableCell>
                  <TableCell>{p.pricesIncludeTaxDefault ? 'Sí' : 'No'}</TableCell>
                  <TableCell><Switch checked={p.isActive} onCheckedChange={() => toggleActive(p)} /></TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="text-red-500" onClick={() => remove(p.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Vista tarjetas (mobile) — misma fuente de datos y handlers que la tabla */}
        <div className="md:hidden">
          {presets.length === 0 ? (
            <p className="text-center text-gray-500 py-6">Sin presets de impuestos configurados — crea el primero.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {presets.map((p) => (
                <AdminListCard
                  key={p.id}
                  title={p.name}
                  subtitle={`${Number(p.rate)}% · ${p.pricesIncludeTaxDefault ? 'Incluye impuesto por defecto' : 'No incluye impuesto por defecto'}`}
                  inlineControl={
                    <div className="flex items-center gap-2">
                      <Switch checked={p.isActive} onCheckedChange={() => toggleActive(p)} />
                      <span className="text-xs text-gray-500">{p.isActive ? 'Activo' : 'Inactivo'}</span>
                    </div>
                  }
                  actions={[
                    {
                      key: 'delete',
                      label: 'Eliminar',
                      icon: <Trash2 className="w-4 h-4" />,
                      variant: 'destructive',
                      onSelect: () => remove(p.id),
                    },
                  ]}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:items-end mt-4 pt-4 border-t">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Nombre</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder='Ej. "IVA 15%"' />
          </div>
          <div className="w-full md:w-28">
            <label className="text-xs text-gray-500 block mb-1">Tasa (%)</label>
            <Input type="number" step="0.01" value={newRate} onChange={(e) => setNewRate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 md:pb-2">
            <Switch checked={newIncludes} onCheckedChange={setNewIncludes} />
            <span className="text-xs text-gray-500">Incluye impuesto</span>
          </div>
          <Button onClick={create} className="gap-2 w-full min-h-11 md:w-auto md:h-9 md:min-h-0">
            <Plus className="w-4 h-4" />Agregar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

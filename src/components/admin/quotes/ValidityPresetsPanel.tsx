'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ValidityPreset {
  id: string;
  name: string;
  days: number;
  isActive: boolean;
  sortOrder: number;
}

export function ValidityPresetsPanel() {
  const [presets, setPresets] = useState<ValidityPreset[]>([]);
  const [newName, setNewName] = useState('');
  const [newDays, setNewDays] = useState('');

  const load = useCallback(() => {
    fetch('/api/admin/quote-config/validity-presets')
      .then((r) => r.json())
      .then((d) => setPresets(d.presets ?? []))
      .catch(() => toast.error('Error al cargar presets de vigencia'));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!newName.trim() || !newDays) {
      toast.error('Nombre y días son obligatorios');
      return;
    }
    const res = await fetch('/api/admin/quote-config/validity-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, days: Number(newDays), sortOrder: presets.length }),
    });
    if (!res.ok) { toast.error('Error al crear preset'); return; }
    setNewName(''); setNewDays('');
    load();
  }

  async function toggleActive(preset: ValidityPreset) {
    await fetch(`/api/admin/quote-config/validity-presets/${preset.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !preset.isActive }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/quote-config/validity-presets/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-semibold mb-4">Presets de vigencia</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Días</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {presets.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-gray-500 py-6">Sin presets de vigencia configurados — crea el primero.</TableCell></TableRow>
            ) : presets.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.days} días</TableCell>
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

        <div className="flex gap-2 items-end mt-4 pt-4 border-t">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Nombre</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder='Ej. "15 días"' />
          </div>
          <div className="w-28">
            <label className="text-xs text-gray-500 block mb-1">Días</label>
            <Input type="number" value={newDays} onChange={(e) => setNewDays(e.target.value)} />
          </div>
          <Button onClick={create} className="gap-2"><Plus className="w-4 h-4" />Agregar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

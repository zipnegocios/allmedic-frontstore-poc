'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import type { Color } from './schema';

const EMPTY_FORM = { name: '', code: '', hex: '#000000' };

interface AddColorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se dispara con el color recién creado (`POST /api/admin/colors` ya devuelve la
   * fila completa) para que el llamador lo agregue a su lista sin recargar la página. */
  onCreated: (color: Color) => void;
}

/**
 * Alta rápida de un color sin salir del formulario de producto — mismos campos y
 * misma API (`POST /api/admin/colors`) que el CRUD completo de `/admin/colores`,
 * pensado para cuando el generador de matriz de variantes necesita un color que
 * todavía no existe en el catálogo.
 */
export function AddColorDialog({ open, onOpenChange, onCreated }: AddColorDialogProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) setFormData(EMPTY_FORM);
    onOpenChange(next);
  }

  async function handleSave() {
    if (!formData.name.trim() || !formData.code.trim() || !formData.hex.trim()) {
      toast.error('Nombre, código y color HEX son requeridos');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/colors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'No se pudo crear el color');
      }
      const color = await res.json();
      toast.success('Color creado');
      onCreated(color);
      setFormData(EMPTY_FORM);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar color');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Nuevo Color"
      description="Se agrega al catálogo general de colores y queda disponible aquí mismo para la matriz de variantes."
      footer={
        <>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#111111]">
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Nombre *</Label>
          <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Código *</Label>
          <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Color HEX *</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={formData.hex}
              onChange={(e) => setFormData({ ...formData, hex: e.target.value })}
              className="w-16 p-1"
            />
            <Input value={formData.hex} onChange={(e) => setFormData({ ...formData, hex: e.target.value })} />
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
}

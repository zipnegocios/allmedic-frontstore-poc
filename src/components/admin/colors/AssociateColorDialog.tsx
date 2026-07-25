'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { ColorFormDialog, ColorSwatchPreview, type ColorFormValue } from './ColorFormDialog';

interface AssociateColorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  brandName?: string;
  /** Se dispara cuando un color queda asociado a la marca (ya sea uno existente
   * elegido del grid, o uno recién creado vía "Crear nuevo color"). */
  onAssociated: (color: ColorFormValue) => void;
}

/**
 * Modal "Asociar Color" del generador de matriz de variantes — obliga a buscar
 * primero entre los colores existentes NO vinculados aún a la marca actual antes de
 * ofrecer crear uno nuevo (botón "Crear nuevo color", movido aquí dentro).
 */
export function AssociateColorDialog({ open, onOpenChange, brandId, brandName, onAssociated }: AssociateColorDialogProps) {
  const [colors, setColors] = useState<ColorFormValue[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmColor, setConfirmColor] = useState<ColorFormValue | null>(null);
  const [associating, setAssociating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchColors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('excludeBrandId', brandId);
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/colors?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setColors(data.colors || []);
    } catch {
      toast.error('Error al cargar colores');
    } finally {
      setLoading(false);
    }
  }, [brandId, search]);

  useEffect(() => {
    if (open) fetchColors();
  }, [open, fetchColors]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setConfirmColor(null);
    }
  }, [open]);

  async function handleConfirmAssociate() {
    if (!confirmColor) return;
    setAssociating(true);
    try {
      const res = await fetch(`/api/admin/colors/${confirmColor.id}/brands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`"${confirmColor.name}" asociado a ${brandName ?? 'la marca'}`);
      onAssociated(confirmColor);
      setConfirmColor(null);
      onOpenChange(false);
    } catch {
      toast.error('Error al asociar el color');
    } finally {
      setAssociating(false);
    }
  }

  function handleCreated(color: ColorFormValue) {
    // `ColorFormDialog` con `originBrandId` ya auto-vincula el color a la marca al
    // crearlo (previa confirmación propia) — solo falta propagarlo hacia arriba.
    onAssociated(color);
    setCreateOpen(false);
    onOpenChange(false);
  }

  return (
    <>
      <ResponsiveDialog
        open={open && !confirmColor}
        onOpenChange={onOpenChange}
        title="Asociar Color"
        description={brandName ? `Colores del catálogo aún no asociados a ${brandName}.` : undefined}
        contentClassName="sm:max-w-[90vw] sm:h-[90vh] sm:max-h-[90vh]"
        footer={
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        }
      >
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar colores..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crear nuevo color
            </Button>
          </div>

          {loading ? (
            <p className="text-center py-12 text-gray-500">Cargando...</p>
          ) : colors.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Palette className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>
                {search
                  ? 'No hay colores que coincidan con la búsqueda.'
                  : 'Todos los colores del catálogo ya están asociados a esta marca.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-2">
              {colors.map((color) => (
                <Card key={color.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <button
                      type="button"
                      onClick={() => setConfirmColor(color)}
                      className="w-full flex flex-col items-center gap-1.5 p-2 text-center"
                      aria-label={`Asociar color ${color.name}`}
                    >
                      <ColorSwatchPreview hex={color.hex} swatchUrl={color.swatchUrl} className="w-10 h-10 rounded-full border border-gray-200" />
                      <p className="text-xs font-medium leading-tight truncate w-full">{color.name}</p>
                      <p className="text-[10px] text-gray-400 truncate w-full">{color.code}</p>
                      {color.kind === 'PATTERN' && (
                        <Badge className="bg-[#111111] text-[9px] px-1.5 py-0 h-4">Estampado</Badge>
                      )}
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={!!confirmColor}
        onOpenChange={(next) => { if (!next) setConfirmColor(null); }}
        title="Confirmar asociación"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmColor(null)}>Cancelar</Button>
            <Button onClick={handleConfirmAssociate} disabled={associating} className="bg-[#111111]">
              {associating ? 'Asociando...' : 'Asociar'}
            </Button>
          </>
        }
      >
        {confirmColor && (
          <div className="py-4 space-y-3">
            <p className="text-sm text-gray-700">
              ¿Está seguro que quiere asociar el color <strong>{confirmColor.name}</strong> ({confirmColor.code}) a la
              marca <strong>{brandName ?? 'seleccionada'}</strong>?
            </p>
            <div className="flex items-center gap-3">
              <ColorSwatchPreview hex={confirmColor.hex} swatchUrl={confirmColor.swatchUrl} className="w-12 h-12 rounded-full border border-gray-200" />
              <div>
                <p className="text-sm font-medium">{confirmColor.name}</p>
                <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{confirmColor.code}</code>
              </div>
            </div>
          </div>
        )}
      </ResponsiveDialog>

      <ColorFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        color={null}
        onSaved={handleCreated}
        originBrandId={brandId}
        originBrandName={brandName}
      />
    </>
  );
}

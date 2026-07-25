'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { MediaPicker } from '@/components/admin/media/MediaPicker';
import { resolveMediaUrl } from '@/lib/media';

export interface ColorFormValue {
  id: string;
  name: string;
  code: string;
  hex: string;
  kind: 'SOLID' | 'PATTERN';
  swatchUrl: string | null;
}

interface BrandActivation {
  id: string;
  name: string;
  isActivated: boolean;
  productCount: number;
  logoUrl: string | null;
}

export function ColorSwatchPreview({ hex, swatchUrl, className }: { hex: string; swatchUrl: string | null; className: string }) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: hex,
        backgroundImage: swatchUrl ? `url(${swatchUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  );
}

interface ColorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Color a editar, o `null` para alta nueva. */
  color: ColorFormValue | null;
  /** Se dispara con el color creado/actualizado (la fila completa que devuelve la API). */
  onSaved: (color: ColorFormValue) => void;
  /**
   * Contexto de marca "de origen" — cuando viene (ej. abierto desde el generador de
   * matriz de variantes de un producto), un color NUEVO se auto-vincula a esta marca
   * al crearse, y antes de mostrar el formulario se pide confirmar la marca con un
   * diálogo ("Usted activará este color para la marca X") para poder corregirla si el
   * admin se equivocó de producto/marca. No aplica al editar un color existente.
   */
  originBrandId?: string;
  originBrandName?: string;
}

const EMPTY_FORM = {
  name: '', code: '', hex: '#000000', kind: 'SOLID' as 'SOLID' | 'PATTERN',
  swatchUrl: '', swatchAssetId: '',
};

/**
 * Modal completo de alta/edición de un color — usado tanto por el catálogo maestro
 * (`/admin/colores`) como por el alta rápida desde el generador de matriz de
 * variantes del formulario de producto, para que ambos flujos compartan exactamente
 * la misma experiencia (mismos campos, mismo swatch de imagen, misma gestión de
 * marcas vinculadas).
 */
export function ColorFormDialog({ open, onOpenChange, color, onSaved, originBrandId, originBrandName }: ColorFormDialogProps) {
  const isNew = !color;
  // Con contexto de marca de origen y alta nueva, el formulario no se muestra hasta
  // que el admin confirma la marca — evita vincular un color a la marca equivocada
  // por un product/brand mal seleccionado antes de entrar aquí.
  const [brandConfirmed, setBrandConfirmed] = useState(!originBrandId);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [swatchPickerOpen, setSwatchPickerOpen] = useState(false);

  const [brandActivations, setBrandActivations] = useState<BrandActivation[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [pendingBrandId, setPendingBrandId] = useState<string | null>(null);
  // El color puede pasar de "nuevo" a "recién creado" dentro de esta misma sesión del
  // modal (se guarda, pero se deja abierto para gestionar marcas) — se rastrea aparte
  // del prop `color` porque el llamador no necesariamente re-renderiza con el nuevo id.
  const [savedColorId, setSavedColorId] = useState<string | null>(null);

  const fetchBrandActivations = useCallback(async (colorId: string) => {
    setBrandsLoading(true);
    try {
      const res = await fetch(`/api/admin/colors/${colorId}/brands`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setBrandActivations(data.brands);
    } catch {
      toast.error('Error al cargar marcas del color');
    } finally {
      setBrandsLoading(false);
    }
  }, []);

  // Reset al abrir/cambiar de color — evita arrastrar datos de una sesión anterior
  // del modal (ej. abrir "Nuevo" después de haber editado otro color).
  useEffect(() => {
    if (!open) return;
    setBrandConfirmed(!originBrandId);
    setSavedColorId(null);
    if (color) {
      setFormData({
        name: color.name, code: color.code, hex: color.hex, kind: color.kind,
        swatchUrl: color.swatchUrl ?? '', swatchAssetId: '',
      });
      fetchBrandActivations(color.id);
    } else {
      setFormData(EMPTY_FORM);
      setBrandActivations([]);
    }
  }, [open, color, originBrandId, fetchBrandActivations]);

  const activeColorId = savedColorId ?? color?.id ?? null;

  async function handleSave() {
    setSaving(true);
    try {
      const url = activeColorId ? `/api/admin/colors/${activeColorId}` : '/api/admin/colors';
      const method = activeColorId ? 'PATCH' : 'POST';
      const payload: Record<string, unknown> = {
        name: formData.name, code: formData.code, hex: formData.hex, kind: formData.kind,
      };
      // Solo se envía swatchAssetId si el usuario eligió una imagen nueva en esta
      // sesión del form — de lo contrario el backend interpretaría el string vacío
      // como "quitar el swatch existente" (ver contrato de `updateColor`).
      if (formData.swatchAssetId) payload.swatchAssetId = formData.swatchAssetId;
      // Alta nueva con contexto de marca de origen: auto-vincula (ver `POST /api/admin/colors`).
      if (!activeColorId && originBrandId) payload.brandId = originBrandId;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      const saved = await res.json();
      toast.success(activeColorId ? 'Color actualizado' : 'Color creado');
      onSaved(saved);
      if (activeColorId) {
        onOpenChange(false);
      } else {
        // Deja el modal abierto en modo edición para que el admin pueda gestionar
        // marcas adicionales del color recién creado sin tener que reabrirlo.
        setSavedColorId(saved.id);
        fetchBrandActivations(saved.id);
      }
    } catch {
      toast.error('Error al guardar color');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleBrand(brand: BrandActivation) {
    if (!activeColorId) return;
    if (brand.isActivated && brand.productCount > 0) {
      const confirmed = confirm(
        `${brand.productCount} variante(s) de "${brand.name}" usan este color. Desactivar no las elimina, pero no podrás usar este color en productos nuevos de esa marca. ¿Continuar?`
      );
      if (!confirmed) return;
    }
    setPendingBrandId(brand.id);
    try {
      if (brand.isActivated) {
        const res = await fetch(`/api/admin/colors/${activeColorId}/brands?brandId=${brand.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
        toast.success(`"${brand.name}" desactivada para este color`);
      } else {
        const res = await fetch(`/api/admin/colors/${activeColorId}/brands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId: brand.id }),
        });
        if (!res.ok) throw new Error('Failed');
        toast.success(`"${brand.name}" activada para este color`);
      }
      await fetchBrandActivations(activeColorId);
    } catch {
      toast.error('Error al actualizar la activación');
    } finally {
      setPendingBrandId(null);
    }
  }

  if (open && isNew && originBrandId && !brandConfirmed) {
    return (
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Confirmar marca"
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => setBrandConfirmed(true)} className="bg-[#111111]">Aceptar</Button>
          </>
        }
      >
        <p className="text-sm text-gray-700 py-4">
          Usted activará este color para la marca <strong>{originBrandName ?? 'seleccionada'}</strong>. Si no es la marca
          correcta, cancele y revise la marca del producto antes de crear el color.
        </p>
      </ResponsiveDialog>
    );
  }

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title={activeColorId ? 'Editar Color' : 'Nuevo Color'}
        contentClassName="sm:max-w-[90vw] sm:h-[90vh] sm:max-h-[90vh]"
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#111111]">
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2 flex-1 min-w-[140px]">
              <Label>Nombre *</Label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-2 w-24">
              <Label>Código *</Label>
              <Input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} maxLength={6} />
            </div>
            <div className="space-y-2">
              <Label>Hex *</Label>
              <div className="flex gap-1.5">
                <Input type="color" value={formData.hex} onChange={e => setFormData({ ...formData, hex: e.target.value })} className="w-10 p-1" />
                <Input value={formData.hex} onChange={e => setFormData({ ...formData, hex: e.target.value })} className="w-24" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={formData.kind === 'SOLID' ? 'default' : 'outline'}
                  className={formData.kind === 'SOLID' ? 'bg-[#111111]' : ''}
                  onClick={() => setFormData({ ...formData, kind: 'SOLID' })}
                >
                  Sólido
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={formData.kind === 'PATTERN' ? 'default' : 'outline'}
                  className={formData.kind === 'PATTERN' ? 'bg-[#111111]' : ''}
                  onClick={() => setFormData({ ...formData, kind: 'PATTERN' })}
                >
                  Estampado
                </Button>
              </div>
            </div>
          </div>

          {formData.kind === 'PATTERN' && (
            <div className="space-y-2">
              <Label>Muestra de estampado (swatch)</Label>
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 border border-gray-200">
                  {formData.swatchUrl ? (
                    <ColorSwatchPreview hex={formData.hex} swatchUrl={formData.swatchUrl} className="w-full h-full" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setSwatchPickerOpen(true)}>
                  {formData.swatchUrl ? 'Cambiar' : 'Subir imagen'}
                </Button>
              </div>
            </div>
          )}

          {activeColorId && (
            <div className="space-y-2 pt-2 border-t">
              <Label>Marcas que usan este color</Label>
              <p className="text-xs text-gray-500">
                Solo las marcas activadas aquí verán este color en el selector al crear/editar productos.
              </p>
              {brandsLoading ? (
                <p className="text-sm text-gray-400 py-2">Cargando marcas...</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {brandActivations.map((b) => (
                    <div key={b.id} className="flex flex-col items-center gap-1.5 border rounded-lg p-3 text-center">
                      <div className="w-10 h-10 rounded bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {b.logoUrl ? (
                          <img src={b.logoUrl} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-gray-300" />
                        )}
                      </div>
                      <p className="text-xs font-medium leading-tight truncate w-full">{b.name}</p>
                      {b.productCount > 0 && (
                        <span className="text-[10px] text-gray-500">{b.productCount} en uso</span>
                      )}
                      <Button
                        size="sm"
                        variant={b.isActivated ? 'outline' : 'default'}
                        className={`w-full h-7 text-xs ${b.isActivated ? '' : 'bg-[#111111]'}`}
                        disabled={pendingBrandId === b.id}
                        onClick={() => handleToggleBrand(b)}
                      >
                        {b.isActivated ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ResponsiveDialog>

      <MediaPicker
        open={swatchPickerOpen}
        onClose={() => setSwatchPickerOpen(false)}
        folder="SWATCHES"
        mediaType="image"
        onConfirm={(assets) => {
          if (assets[0]) {
            setFormData((prev) => ({
              ...prev,
              swatchUrl: resolveMediaUrl(assets[0].storageKey),
              swatchAssetId: assets[0].id,
            }));
          }
          setSwatchPickerOpen(false);
        }}
      />
    </>
  );
}

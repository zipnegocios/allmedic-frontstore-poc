'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Palette, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { Label } from '@/components/ui/label';
import { MediaPicker } from '@/components/admin/media/MediaPicker';
import { resolveMediaUrl } from '@/lib/media';

interface Color {
  id: string;
  name: string;
  code: string;
  hex: string;
  kind: 'SOLID' | 'PATTERN';
  swatchUrl: string | null;
  brandNames: string[];
}

interface BrandActivation {
  id: string;
  name: string;
  isActivated: boolean;
  productCount: number;
  logoUrl: string | null;
}

interface BrandOption {
  id: string;
  name: string;
}

const PAGE_SIZE_OPTIONS = [10, 50, 100, 1000];

function ColorSwatchPreview({ hex, swatchUrl, className }: { hex: string; swatchUrl: string | null; className: string }) {
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

export default function AdminColorsPage() {
  const [colors, setColors] = useState<Color[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingColor, setEditingColor] = useState<Color | null>(null);
  const [formData, setFormData] = useState({
    name: '', code: '', hex: '#000000', kind: 'SOLID' as 'SOLID' | 'PATTERN',
    swatchUrl: '', swatchAssetId: '',
  });
  const [saving, setSaving] = useState(false);
  const [swatchPickerOpen, setSwatchPickerOpen] = useState(false);

  // Activaciones de marca del color en edición — solo aplica editando (un color
  // nuevo aún no tiene id para vincular marcas hasta guardarse la primera vez).
  const [brandActivations, setBrandActivations] = useState<BrandActivation[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [pendingBrandId, setPendingBrandId] = useState<string | null>(null);

  const fetchColors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter !== 'all') params.set('kind', typeFilter);
      if (brandFilter !== 'all') params.set('brandFilterId', brandFilter);
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      const res = await fetch(`/api/admin/colors?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setColors(data.colors);
      setTotalPages(data.pages);
    } catch {
      toast.error('Error al cargar colores');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, brandFilter, page, pageSize]);

  useEffect(() => {
    fetchColors();
  }, [fetchColors]);

  useEffect(() => {
    fetch('/api/admin/brands?limit=1000')
      .then((res) => res.json())
      .then((data) => setBrandOptions(data.brands || []))
      .catch(() => toast.error('Error al cargar marcas'));
  }, []);

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

  function openNew() {
    setEditingColor(null);
    setFormData({ name: '', code: '', hex: '#000000', kind: 'SOLID', swatchUrl: '', swatchAssetId: '' });
    setBrandActivations([]);
    setDialogOpen(true);
  }

  function openEdit(color: Color) {
    setEditingColor(color);
    setFormData({
      name: color.name, code: color.code, hex: color.hex, kind: color.kind,
      swatchUrl: color.swatchUrl ?? '', swatchAssetId: '',
    });
    setDialogOpen(true);
    fetchBrandActivations(color.id);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const url = editingColor ? `/api/admin/colors/${editingColor.id}` : '/api/admin/colors';
      const method = editingColor ? 'PATCH' : 'POST';
      const payload: Record<string, unknown> = {
        name: formData.name, code: formData.code, hex: formData.hex, kind: formData.kind,
      };
      // Solo se envía swatchAssetId si el usuario eligió una imagen nueva en esta
      // sesión del form — de lo contrario el backend interpretaría el string vacío
      // como "quitar el swatch existente" (ver contrato de `updateColor`).
      if (formData.swatchAssetId) payload.swatchAssetId = formData.swatchAssetId;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(editingColor ? 'Color actualizado' : 'Color creado');
      setDialogOpen(false);
      fetchColors();
    } catch {
      toast.error('Error al guardar color');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar este color?')) return;
    try {
      const res = await fetch(`/api/admin/colors/${id}`, { method: 'DELETE' });
      if (res.status === 409) {
        const data = await res.json().catch(() => null);
        toast.error(`No se puede eliminar: este color está asociado a ${data?.productCount ?? 'varios'} producto(s).`);
        return;
      }
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Color eliminado');
      fetchColors();
    } catch {
      toast.error('Error al eliminar color');
    }
  }

  async function handleToggleBrand(brand: BrandActivation) {
    if (!editingColor) return;
    if (brand.isActivated && brand.productCount > 0) {
      const confirmed = confirm(
        `${brand.productCount} variante(s) de "${brand.name}" usan este color. Desactivar no las elimina, pero no podrás usar este color en productos nuevos de esa marca. ¿Continuar?`
      );
      if (!confirmed) return;
    }
    setPendingBrandId(brand.id);
    try {
      if (brand.isActivated) {
        const res = await fetch(`/api/admin/colors/${editingColor.id}/brands?brandId=${brand.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
        toast.success(`"${brand.name}" desactivada para este color`);
      } else {
        const res = await fetch(`/api/admin/colors/${editingColor.id}/brands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId: brand.id }),
        });
        if (!res.ok) throw new Error('Failed');
        toast.success(`"${brand.name}" activada para este color`);
      }
      await fetchBrandActivations(editingColor.id);
      fetchColors();
    } catch {
      toast.error('Error al actualizar la activación');
    } finally {
      setPendingBrandId(null);
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-[#111111]">Colores</h1>
        <Button className="bg-[#111111]" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Color
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar colores..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="SOLID">Sólido</SelectItem>
                <SelectItem value="PATTERN">Estampado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Marca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las marcas</SelectItem>
                {brandOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Mostrar" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} por página</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-center py-12 text-gray-500">Cargando...</p>
      ) : colors.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Palette className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="mb-4">No hay colores registrados</p>
          <Button className="gap-2 min-h-11 bg-[#111111]" onClick={openNew}>
            <Plus className="w-4 h-4" />
            Nuevo Color
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-2">
          {colors.map((color) => (
            <Card key={color.id} className="group relative overflow-hidden">
              <CardContent className="p-2 flex flex-col items-center gap-1.5 text-center">
                <button
                  type="button"
                  onClick={() => openEdit(color)}
                  className="w-full flex flex-col items-center gap-1.5"
                  aria-label={`Editar color ${color.name}`}
                >
                  <ColorSwatchPreview hex={color.hex} swatchUrl={color.swatchUrl} className="w-10 h-10 rounded-full border border-gray-200" />
                  <p className="text-xs font-medium leading-tight truncate w-full">{color.name}</p>
                  <p className="text-[10px] text-gray-400 truncate w-full">{color.code}</p>
                  {color.kind === 'PATTERN' && (
                    <Badge className="bg-[#111111] text-[9px] px-1.5 py-0 h-4">Estampado</Badge>
                  )}
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 right-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(color)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDelete(color.id)}>
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm px-2 text-center">Página {page} de {totalPages}</span>
          <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <ResponsiveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingColor ? 'Editar Color' : 'Nuevo Color'}
        contentClassName="sm:max-w-[90vw] sm:h-[90vh] sm:max-h-[90vh]"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#111111]">
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Código *</Label>
            <Input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Color HEX * (color dominante, usado siempre como respaldo)</Label>
            <div className="flex gap-2">
              <Input type="color" value={formData.hex} onChange={e => setFormData({ ...formData, hex: e.target.value })} className="w-16 p-1" />
              <Input value={formData.hex} onChange={e => setFormData({ ...formData, hex: e.target.value })} />
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

          {editingColor && (
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
    </div>
  );
}

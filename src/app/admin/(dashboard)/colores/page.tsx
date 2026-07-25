'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Palette, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { Label } from '@/components/ui/label';
import { AdminListCard } from '@/components/admin/AdminListCard';
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
}

interface BrandOption {
  id: string;
  name: string;
}

const MAX_BRAND_CHIPS = 3;

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

function BrandChips({ brandNames }: { brandNames: string[] }) {
  if (brandNames.length === 0) {
    return <span className="text-xs text-gray-400">Sin marcas</span>;
  }
  const shown = brandNames.slice(0, MAX_BRAND_CHIPS);
  const extra = brandNames.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((name) => (
        <Badge key={name} variant="outline" className="text-xs font-normal">{name}</Badge>
      ))}
      {extra > 0 && <Badge variant="outline" className="text-xs font-normal">+{extra} más</Badge>}
    </div>
  );
}

export default function AdminColorsPage() {
  const [colors, setColors] = useState<Color[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [page, setPage] = useState(1);
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
      params.set('limit', '20');
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
  }, [search, typeFilter, brandFilter, page]);

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
          </div>
        </CardContent>
      </Card>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Color</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Hex</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Marcas</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : colors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    <Palette className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay colores registrados
                  </TableCell>
                </TableRow>
              ) : (
                colors.map((color) => (
                  <TableRow key={color.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ColorSwatchPreview hex={color.hex} swatchUrl={color.swatchUrl} className="w-8 h-8 rounded-full border border-gray-200 flex-shrink-0" />
                        <span className="font-medium">{color.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{color.code}</TableCell>
                    <TableCell>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{color.hex}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={color.kind === 'PATTERN' ? 'default' : 'outline'} className={color.kind === 'PATTERN' ? 'bg-[#111111]' : ''}>
                        {color.kind === 'PATTERN' ? 'Estampado' : 'Sólido'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <BrandChips brandNames={color.brandNames} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(color)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(color.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Vista tarjetas (mobile) — misma fuente de datos y handlers que la tabla */}
      <div className="md:hidden">
        {loading ? (
          <p className="text-center py-8 text-gray-500">Cargando...</p>
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
          <div className="flex flex-col gap-3">
            {colors.map((color) => (
              <AdminListCard
                key={color.id}
                onNavigate={() => openEdit(color)}
                aria-label={`Editar color ${color.name}`}
                thumbnail={
                  <ColorSwatchPreview hex={color.hex} swatchUrl={color.swatchUrl} className="w-10 h-10 rounded-full border border-gray-200" />
                }
                title={color.name}
                subtitle={color.code}
                meta={
                  <div className="flex flex-col gap-1 items-start">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{color.hex}</code>
                    <BrandChips brandNames={color.brandNames} />
                  </div>
                }
                actions={[
                  {
                    key: 'delete',
                    label: 'Eliminar',
                    icon: <Trash2 className="w-4 h-4" />,
                    variant: 'destructive',
                    onSelect: () => handleDelete(color.id),
                  },
                ]}
              />
            ))}
          </div>
        )}
      </div>

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
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {brandActivations.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 border rounded px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{b.name}</p>
                        {b.productCount > 0 && (
                          <span className="text-xs text-gray-500">{b.productCount} variante(s) en uso</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={b.isActivated ? 'outline' : 'default'}
                        className={b.isActivated ? '' : 'bg-[#111111]'}
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

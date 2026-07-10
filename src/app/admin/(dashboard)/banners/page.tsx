'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { MediaPicker } from '@/components/admin/media/MediaPicker';
import { resolveMediaUrl } from '@/lib/media';

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageDesktop: string | null;
  imageMobile: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM = {
  title: '', subtitle: '', imageDesktop: '', imageMobile: '',
  imageDesktopAssetId: '', imageMobileAssetId: '',
  ctaText: '', ctaLink: '', sortOrder: 0, isActive: true,
};

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'imageDesktop' | 'imageMobile' | null>(null);

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '20');
      const res = await fetch(`/api/admin/banners?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setBanners(data.banners);
      setTotalPages(data.pages);
    } catch {
      toast.error('Error al cargar banners');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  function openNew() {
    setEditingBanner(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(banner: Banner) {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle || '',
      imageDesktop: banner.imageDesktop || '',
      imageMobile: banner.imageMobile || '',
      imageDesktopAssetId: '',
      imageMobileAssetId: '',
      ctaText: banner.ctaText || '',
      ctaLink: banner.ctaLink || '',
      sortOrder: banner.sortOrder,
      isActive: banner.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formData.imageDesktop) {
      toast.error('La imagen desktop es obligatoria');
      return;
    }
    setSaving(true);
    try {
      const url = editingBanner ? `/api/admin/banners/${editingBanner.id}` : '/api/admin/banners';
      const method = editingBanner ? 'PATCH' : 'POST';
      // Solo se envían los assetId si el usuario eligió una imagen nueva en esta sesión del form;
      // de lo contrario el backend interpretaría el string vacío como "quitar el vínculo".
      const payload: Record<string, unknown> = { ...formData };
      if (!payload.imageDesktopAssetId) delete payload.imageDesktopAssetId;
      if (!payload.imageMobileAssetId) delete payload.imageMobileAssetId;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
      toast.success(editingBanner ? 'Banner actualizado' : 'Banner creado');
      setDialogOpen(false);
      fetchBanners();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar banner');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar este banner?')) return;
    try {
      const res = await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Banner eliminado');
      fetchBanners();
    } catch {
      toast.error('Error al eliminar banner');
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-[#111111]">Banners</h1>
        <Button className="bg-[#111111]" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Banner
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar banners..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banner</TableHead>
                <TableHead>CTA</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : banners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay banners registrados
                  </TableCell>
                </TableRow>
              ) : (
                banners.map((banner) => (
                  <TableRow key={banner.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-8 bg-gray-100 rounded overflow-hidden">
                          {banner.imageDesktop && (
                            <img src={banner.imageDesktop} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{banner.title}</p>
                          {banner.subtitle && <p className="text-sm text-gray-500">{banner.subtitle}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {banner.ctaText ? (
                        <span className="text-sm">{banner.ctaText} → {banner.ctaLink}</span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{banner.sortOrder}</TableCell>
                    <TableCell>
                      {banner.isActive ? <Badge variant="outline">Activo</Badge> : <Badge variant="destructive">Inactivo</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(banner)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(banner.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBanner ? 'Editar Banner' : 'Nuevo Banner'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Subtítulo</Label>
              <Input value={formData.subtitle} onChange={e => setFormData({ ...formData, subtitle: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Imagen Desktop *</Label>
              <div className="flex items-center gap-3">
                <div className="w-24 h-14 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                  {formData.imageDesktop ? (
                    <img src={formData.imageDesktop} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setPickerTarget('imageDesktop')}>
                  {formData.imageDesktop ? 'Cambiar' : 'Elegir imagen'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Imagen Mobile (opcional)</Label>
              <div className="flex items-center gap-3">
                <div className="w-24 h-14 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                  {formData.imageMobile ? (
                    <img src={formData.imageMobile} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setPickerTarget('imageMobile')}>
                  {formData.imageMobile ? 'Cambiar' : 'Elegir imagen'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Texto CTA</Label>
                <Input value={formData.ctaText} onChange={e => setFormData({ ...formData, ctaText: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Link CTA</Label>
                <Input value={formData.ctaLink} onChange={e => setFormData({ ...formData, ctaLink: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 items-end">
              <div className="space-y-2">
                <Label>Orden</Label>
                <Input type="number" value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: Number(e.target.value) })} />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
                <Label>Activo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#111111]">
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaPicker
        open={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        folder="BANNERS"
        onConfirm={(assets) => {
          if (pickerTarget && assets[0]) {
            const assetIdKey = pickerTarget === 'imageDesktop' ? 'imageDesktopAssetId' : 'imageMobileAssetId';
            setFormData((prev) => ({
              ...prev,
              [pickerTarget]: resolveMediaUrl(assets[0].storageKey),
              [assetIdKey]: assets[0].id,
            }));
          }
          setPickerTarget(null);
        }}
      />
    </div>
  );
}

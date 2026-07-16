'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Tag, ImageIcon, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { Label } from '@/components/ui/label';
import { MediaPicker } from '@/components/admin/media/MediaPicker';
import { resolveMediaUrl } from '@/lib/media';
import { AdminListCard } from '@/components/admin/AdminListCard';
import { slugify } from '@/lib/slugify';

interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '', logoUrl: '', logoAssetId: '', isActive: true, sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '20');
      const res = await fetch(`/api/admin/brands?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setBrands(data.brands);
      setTotalPages(data.pages);
    } catch {
      toast.error('Error al cargar marcas');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  function openNew() {
    setEditingBrand(null);
    setFormData({ name: '', slug: '', description: '', logoUrl: '', logoAssetId: '', isActive: true, sortOrder: 0 });
    setDialogOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      slug: brand.slug,
      description: brand.description || '',
      logoUrl: brand.logoUrl || '',
      logoAssetId: '',
      isActive: brand.isActive,
      sortOrder: brand.sortOrder,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const url = editingBrand ? `/api/admin/brands/${editingBrand.id}` : '/api/admin/brands';
      const method = editingBrand ? 'PATCH' : 'POST';
      const payload: Record<string, unknown> = { ...formData };
      if (!payload.logoAssetId) delete payload.logoAssetId;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(editingBrand ? 'Marca actualizada' : 'Marca creada');
      setDialogOpen(false);
      fetchBrands();
    } catch {
      toast.error('Error al guardar marca');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta marca?')) return;
    try {
      const res = await fetch(`/api/admin/brands/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Marca eliminada');
      fetchBrands();
    } catch {
      toast.error('Error al eliminar marca');
    }
  }

  // Auto-generate slug from name
  useEffect(() => {
    if (!editingBrand && formData.name && !formData.slug) {
      setFormData(prev => ({ ...prev, slug: slugify(prev.name) }));
    }
  }, [formData.name, editingBrand, formData.slug]);

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-[#111111]">Marcas</h1>
        <Button className="bg-[#111111]" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Marca
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar marcas..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : brands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    <Tag className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay marcas registradas
                  </TableCell>
                </TableRow>
              ) : (
                brands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {brand.logoUrl && (
                          <img src={brand.logoUrl} alt="" className="w-8 h-8 object-contain" />
                        )}
                        <span className="font-medium">{brand.name}</span>
                      </div>
                    </TableCell>
                    <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">{brand.slug}</code></TableCell>
                    <TableCell>{brand.description || '-'}</TableCell>
                    <TableCell>
                      {brand.isActive ? <Badge variant="outline">Activa</Badge> : <Badge variant="destructive">Inactiva</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/marcas/${brand.id}`}>
                          <Button size="sm" variant="outline">
                            <Layers className="w-4 h-4 mr-1" /> Colecciones y tipos
                          </Button>
                        </Link>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(brand)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(brand.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
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
        ) : brands.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Tag className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="mb-4">No hay marcas registradas</p>
            <Button className="gap-2 min-h-11 bg-[#111111]" onClick={openNew}>
              <Plus className="w-4 h-4" />
              Nueva Marca
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {brands.map((brand) => (
              <AdminListCard
                key={brand.id}
                onNavigate={() => openEdit(brand)}
                aria-label={`Editar marca ${brand.name}`}
                thumbnail={
                  brand.logoUrl ? (
                    <img src={brand.logoUrl} alt="" className="w-10 h-10 object-contain rounded-md bg-gray-50" />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-gray-300" />
                    </div>
                  )
                }
                title={brand.name}
                subtitle={<code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{brand.slug}</code>}
                badges={
                  brand.isActive ? (
                    <Badge variant="outline">Activa</Badge>
                  ) : (
                    <Badge variant="destructive">Inactiva</Badge>
                  )
                }
                meta={brand.description ? <p className="truncate">{brand.description}</p> : undefined}
                actions={[
                  {
                    key: 'collections',
                    label: 'Colecciones y tipos',
                    icon: <Layers className="w-4 h-4" />,
                    onSelect: () => { window.location.href = `/admin/marcas/${brand.id}`; },
                  },
                  {
                    key: 'delete',
                    label: 'Eliminar',
                    icon: <Trash2 className="w-4 h-4" />,
                    variant: 'destructive',
                    onSelect: () => handleDelete(brand.id),
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
        title={editingBrand ? 'Editar Marca' : 'Nueva Marca'}
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
            <Label>Slug *</Label>
            <Input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-gray-300" />
                )}
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                {formData.logoUrl ? 'Cambiar logo' : 'Elegir logo'}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
            <Label>Activa</Label>
          </div>
        </div>
      </ResponsiveDialog>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        folder="BRANDS"
        segments={formData.slug ? [formData.slug] : []}
        onConfirm={(assets) => {
          if (assets[0]) setFormData((prev) => ({ ...prev, logoUrl: resolveMediaUrl(assets[0].storageKey), logoAssetId: assets[0].id }));
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

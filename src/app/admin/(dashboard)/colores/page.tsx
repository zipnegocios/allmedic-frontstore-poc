'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Palette } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Color {
  id: string;
  name: string;
  code: string;
  hex: string;
}

export default function AdminColorsPage() {
  const [colors, setColors] = useState<Color[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingColor, setEditingColor] = useState<Color | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', hex: '#000000' });
  const [saving, setSaving] = useState(false);

  const fetchColors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
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
  }, [search, page]);

  useEffect(() => {
    fetchColors();
  }, [fetchColors]);

  function openNew() {
    setEditingColor(null);
    setFormData({ name: '', code: '', hex: '#000000' });
    setDialogOpen(true);
  }

  function openEdit(color: Color) {
    setEditingColor(color);
    setFormData({ name: color.name, code: color.code, hex: color.hex });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const url = editingColor ? `/api/admin/colors/${editingColor.id}` : '/api/admin/colors';
      const method = editingColor ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-[#111111]">Colores</h1>
        <Button className="bg-[#111111]" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Color
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar colores..."
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
                <TableHead>Color</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Hex</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : colors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                    <Palette className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay colores registrados
                  </TableCell>
                </TableRow>
              ) : (
                colors.map((color) => (
                  <TableRow key={color.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full border border-gray-200"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="font-medium">{color.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{color.code}</TableCell>
                    <TableCell>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{color.hex}</code>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingColor ? 'Editar Color' : 'Nuevo Color'}</DialogTitle>
          </DialogHeader>
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
              <Label>Color HEX *</Label>
              <div className="flex gap-2">
                <Input type="color" value={formData.hex} onChange={e => setFormData({ ...formData, hex: e.target.value })} className="w-16 p-1" />
                <Input value={formData.hex} onChange={e => setFormData({ ...formData, hex: e.target.value })} />
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
    </div>
  );
}

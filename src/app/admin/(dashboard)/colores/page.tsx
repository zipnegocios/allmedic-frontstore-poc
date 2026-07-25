'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { ColorFormDialog, ColorSwatchPreview, type ColorFormValue } from '@/components/admin/colors/ColorFormDialog';

interface Color extends ColorFormValue {
  brandNames: string[];
}

interface BrandOption {
  id: string;
  name: string;
}

const PAGE_SIZE_OPTIONS = [10, 50, 100, 1000];

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

  function openNew() {
    setEditingColor(null);
    setDialogOpen(true);
  }

  function openEdit(color: Color) {
    setEditingColor(color);
    setDialogOpen(true);
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

      <ColorFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        color={editingColor}
        onSaved={() => fetchColors()}
      />
    </div>
  );
}

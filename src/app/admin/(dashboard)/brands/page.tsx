'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { toast } from 'sonner';

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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-[#111111]">Marcas</h1>
        <Button className="bg-[#111111]">
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

      <Card>
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
                        <Button size="sm" variant="ghost"><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost"><Trash2 className="w-4 h-4 text-red-500" /></Button>
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
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Boxes, Star } from 'lucide-react';
import { toast } from 'sonner';

interface AdminSet {
  id: string;
  name: string;
  slug: string;
  groupName: string | null;
  brandName: string | null;
  isActive: boolean;
  isFeatured: boolean;
  itemCount: number;
}

export default function AdminSetsPage() {
  const [sets, setSets] = useState<AdminSet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sets');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSets(data.sets);
    } catch {
      toast.error('Error al cargar sets corporativos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar este set corporativo?')) return;
    try {
      const res = await fetch(`/api/admin/sets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Set eliminado');
      fetchSets();
    } catch {
      toast.error('Error al eliminar set');
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">Sets Corporativos</h1>
          <p className="text-sm text-gray-500 mt-1">Conjuntos de productos para el catálogo de venta al mayor</p>
        </div>
        <Link href="/admin/sets/nuevo">
          <Button className="bg-[#111111]">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Set
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Set</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Piezas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : sets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    <Boxes className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay sets corporativos registrados
                  </TableCell>
                </TableRow>
              ) : (
                sets.map((set) => (
                  <TableRow key={set.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        {set.isFeatured && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                        {set.name}
                      </div>
                    </TableCell>
                    <TableCell>{set.groupName || '-'}</TableCell>
                    <TableCell>{set.brandName || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{set.itemCount} {set.itemCount === 1 ? 'pieza' : 'piezas'}</Badge>
                    </TableCell>
                    <TableCell>
                      {set.isActive ? <Badge variant="outline">Activo</Badge> : <Badge variant="destructive">Inactivo</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/sets/${set.id}`}>
                          <Button size="sm" variant="ghost"><Pencil className="w-4 h-4" /></Button>
                        </Link>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(set.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

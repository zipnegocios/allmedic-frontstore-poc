'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { AdminListCard } from '@/components/admin/AdminListCard';

interface Store {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  hours: string | null;
  isMain: boolean;
  isActive: boolean;
  acceptsOnline: boolean;
}

export default function AdminStoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '20');
      const res = await fetch(`/api/admin/stores?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStores(data.stores);
      setTotalPages(data.pages);
    } catch {
      toast.error('Error al cargar sucursales');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-[#111111]">Sucursales</h1>
        <Button className="bg-[#111111]">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Sucursal
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar sucursales..."
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
                <TableHead>Sucursal</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : stores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay sucursales registradas
                  </TableCell>
                </TableRow>
              ) : (
                stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{store.name}</p>
                        {store.isMain && <Badge variant="default" className="mt-1">Principal</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{store.address}</TableCell>
                    <TableCell>{store.phone || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {store.isActive ? <Badge variant="outline">Activa</Badge> : <Badge variant="destructive">Inactiva</Badge>}
                        {store.acceptsOnline && <Badge variant="secondary">Online</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {/* CRUD no funcional aún (hallazgo de auditoría pre-existente): sin onClick, fuera del alcance de este task */}
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

      {/* Vista tarjetas (mobile) — misma fuente de datos que la tabla. CRUD no funcional
          aún (hallazgo de auditoría pre-existente, fuera de alcance): las acciones se
          muestran visualmente igual que en la tabla desktop, sin handler real. */}
      <div className="md:hidden">
        {loading ? (
          <p className="text-center py-8 text-gray-500">Cargando...</p>
        ) : stores.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="mb-4">No hay sucursales registradas</p>
            <Button className="gap-2 min-h-11 bg-[#111111]">
              <Plus className="w-4 h-4" />
              Nueva Sucursal
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {stores.map((store) => (
              <AdminListCard
                key={store.id}
                thumbnail={
                  <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-gray-400" />
                  </div>
                }
                title={
                  <span className="inline-flex items-center gap-1.5">
                    {store.name}
                    {store.isMain && <Badge variant="default">Principal</Badge>}
                  </span>
                }
                subtitle={store.address}
                badges={
                  <>
                    {store.isActive ? <Badge variant="outline">Activa</Badge> : <Badge variant="destructive">Inactiva</Badge>}
                    {store.acceptsOnline && <Badge variant="secondary">Online</Badge>}
                  </>
                }
                meta={store.phone ? <p>{store.phone}</p> : undefined}
                actions={[
                  {
                    key: 'edit',
                    label: 'Editar',
                    icon: <Pencil className="w-4 h-4" />,
                    // No-op intencional: CRUD no funcional aún (ver comentario arriba)
                    onSelect: () => {},
                  },
                  {
                    key: 'delete',
                    label: 'Eliminar',
                    icon: <Trash2 className="w-4 h-4" />,
                    variant: 'destructive',
                    // No-op intencional: CRUD no funcional aún (ver comentario arriba)
                    onSelect: () => {},
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
    </div>
  );
}

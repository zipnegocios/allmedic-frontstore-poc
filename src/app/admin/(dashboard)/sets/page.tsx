'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Boxes, Star } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface AdminSetItem {
  productId: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

interface AdminSet {
  id: string;
  name: string;
  slug: string;
  groupName: string | null;
  brandName: string | null;
  isActive: boolean;
  isFeatured: boolean;
  itemCount: number;
  imageUrl: string | null;
  items: AdminSetItem[];
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

  async function toggleActive(id: string, currentStatus: boolean) {
    const nextStatus = !currentStatus;
    // Optimistic update
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: nextStatus } : s))
    );

    try {
      const res = await fetch(`/api/admin/sets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(nextStatus ? 'Set activado' : 'Set inactivado');
    } catch {
      toast.error('Error al cambiar estado');
      setSets((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isActive: currentStatus } : s))
      );
    }
  }

  async function handleDelete(id: string) {
    const deletedSet = sets.find((s) => s.id === id);
    if (!deletedSet) return;

    // Optimistic remove
    setSets((prev) => prev.filter((s) => s.id !== id));

    try {
      const res = await fetch(`/api/admin/sets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      toast.success('Set enviado a la papelera', {
        action: {
          label: 'Deshacer',
          onClick: async () => {
            try {
              const undoRes = await fetch(`/api/admin/trash`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'restore',
                  entityType: 'SET',
                  entityId: id,
                }),
              });
              if (!undoRes.ok) throw new Error('Failed to restore');
              toast.success('Set restaurado');
              fetchSets();
            } catch {
              toast.error('Error al restaurar set');
              fetchSets();
            }
          },
        },
      });
    } catch {
      toast.error('Error al eliminar set');
      fetchSets();
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#111111] tracking-tight">Sets Corporativos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Conjuntos de productos para el catálogo de venta al mayor
          </p>
        </div>
        <Link href="/admin/sets/nuevo" className="self-start sm:self-auto">
          <Button className="bg-[#111111] hover:bg-black/90 h-11 px-6">
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Set
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Card key={n} className="overflow-hidden border border-gray-150 animate-pulse aspect-[9/16] flex flex-col justify-between">
              <div className="h-24 bg-gray-200 shrink-0" />
              <CardContent className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
                <div className="h-10 bg-gray-200 rounded w-full pt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-xl bg-white">
          <Boxes className="w-16 h-16 text-gray-300 mb-4 stroke-[1.5]" />
          <h3 className="text-lg font-semibold text-gray-900">No hay sets registrados</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm">
            Comienza creando conjuntos de prendas para ventas corporativas.
          </p>
          <Link href="/admin/sets/nuevo" className="mt-6">
            <Button className="bg-[#111111] hover:bg-black/90">
              Crear primer set
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {sets.map((set) => (
            <Card
              key={set.id}
              className="overflow-hidden border border-gray-200 flex flex-col justify-between hover:shadow-md hover:border-gray-300 transition-all duration-200 bg-white aspect-[9/16]"
            >
              <div className="relative h-24 w-full bg-gray-55 overflow-hidden group border-b border-gray-100 shrink-0">
                {set.imageUrl ? (
                  <img
                    src={set.imageUrl}
                    alt={set.name}
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">
                    <Boxes className="w-10 h-10" />
                  </div>
                )}
                {set.isFeatured && (
                  <div className="absolute top-3 left-3 bg-amber-500 text-white p-1.5 rounded-full shadow-md" title="Destacado">
                    <Star className="w-4 h-4 fill-white text-white" />
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <Badge
                    variant={set.isActive ? 'default' : 'secondary'}
                    className={
                      set.isActive
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-none'
                        : 'bg-gray-100 text-gray-500 border-none'
                    }
                  >
                    {set.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-3.5 flex-1 flex flex-col justify-between space-y-2 overflow-hidden">
                <div className="space-y-1.5">
                  <h3 className="font-bold text-sm text-gray-900 leading-tight line-clamp-1" title={set.name}>
                    {set.name}
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {set.groupName && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0.5 bg-gray-100 text-gray-700 border-none font-normal"
                      >
                        {set.groupName}
                      </Badge>
                    )}
                    {set.brandName && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0.5 bg-gray-100 text-gray-700 border-none font-normal"
                      >
                        {set.brandName}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[9px] px-1 py-0.5 font-normal text-gray-500 border-gray-200">
                      {set.itemCount} {set.itemCount === 1 ? 'pza' : 'pzas'}
                    </Badge>
                  </div>
                </div>

                {/* Horizontal list of items (hidden on mobile) */}
                {set.items && set.items.length > 0 && (
                  <div className="hidden md:flex flex-col space-y-1">
                    <span className="text-[9px] text-gray-400 font-bold tracking-wider uppercase">
                      Piezas:
                    </span>
                    <div className="flex -space-x-1.5 overflow-hidden py-0.5">
                      {set.items.map((item, idx) => (
                        <div
                          key={item.productId || idx}
                          className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-gray-50 overflow-hidden shadow-sm hover:scale-110 transition-transform duration-200 cursor-help"
                          title={item.name}
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-[9px] text-gray-400 font-bold bg-gray-200">
                              {item.name?.substring(0, 2).toUpperCase() || 'P'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Row: Switch & Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={set.isActive}
                      onCheckedChange={() => toggleActive(set.id, set.isActive)}
                      aria-label={`Cambiar estado de ${set.name}`}
                    />
                    <span className="text-[10px] text-gray-500 font-medium select-none hidden sm:inline">
                      {set.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link href={`/admin/sets/${set.id}`}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 hover:bg-gray-100 rounded-lg text-gray-700"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </Link>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 rounded-lg text-gray-550 group"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-gray-550 group-hover:text-red-600" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-[450px]">
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Enviar a la papelera?</AlertDialogTitle>
                          <AlertDialogDescription className="text-gray-600">
                            El set corporativo <span className="font-semibold text-gray-950">"{set.name}"</span> se enviará a la papelera general. 
                            Podrás recuperarlo o eliminarlo de forma permanente desde allí.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(set.id)}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
                          >
                            Confirmar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

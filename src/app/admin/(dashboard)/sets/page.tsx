'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  mimeType: string | null;
  previewStart: number | null;
  previewDuration: number | null;
}

/** Portada del set con fallback al ícono de caja si la URL falla al cargar (los sets no admiten video). */
function SetCoverThumb({ set }: { set: AdminSet }) {
  const [failed, setFailed] = useState(false);

  if (!set.imageUrl || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-350">
        <Boxes className="w-5 h-5" />
      </div>
    );
  }

  return (
    <img
      src={set.imageUrl}
      alt={set.name}
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

/** Miniatura de pieza consciente de tipo de medio (imagen o video) con fallback a iniciales si la carga falla. */
function PieceThumb({ item }: { item: AdminSetItem }) {
  const [failed, setFailed] = useState(false);
  const isVideo = item.mimeType?.startsWith('video/') ?? false;

  if (!item.imageUrl || failed) {
    return (
      <div className="h-full w-full flex items-center justify-center text-[8px] text-gray-400 font-bold bg-gray-200">
        {item.name?.substring(0, 2).toUpperCase() || 'P'}
      </div>
    );
  }

  if (isVideo) {
    return (
      <video
        src={item.imageUrl}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
        onLoadedMetadata={(e) => {
          e.currentTarget.currentTime = item.previewStart ?? 0;
        }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <img
      src={item.imageUrl}
      alt={item.name ?? ''}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

interface AdminSet {
  id: string;
  name: string;
  slug: string;
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
            <Card key={n} className="overflow-hidden border border-gray-150 animate-pulse aspect-[9/16] p-3 flex flex-col justify-between">
              <div className="flex-1 flex flex-col justify-between min-h-0">
                <div className="flex gap-2.5 items-start shrink-0">
                  <div className="w-1/4 aspect-[9/16] bg-gray-200 rounded shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="h-2 bg-gray-200 rounded w-1/4" />
                  <div className="flex gap-1">
                    {[1, 2, 3].map((x) => (
                      <div key={x} className="h-6 w-6 bg-gray-200 rounded shrink-0" />
                    ))}
                  </div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-full pt-2" />
              </div>
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
              className="overflow-hidden border border-gray-200 flex flex-col justify-between hover:shadow-md hover:border-gray-300 transition-all duration-200 bg-white aspect-[9/16] p-3"
            >
              <div className="flex-1 flex flex-col justify-between min-h-0">
                {/* Top Row: Media + Info */}
                <div className="flex gap-2.5 items-start shrink-0">
                  {/* Media (25% width, 9:16 aspect) */}
                  <div className="w-1/4 aspect-[9/16] bg-gray-50 rounded overflow-hidden relative shrink-0 border border-gray-100">
                    <SetCoverThumb set={set} />
                    {set.isFeatured && (
                      <div className="absolute top-1 left-1 bg-amber-500 text-white p-0.5 rounded-full shadow-md">
                        <Star className="w-2.5 h-2.5 fill-white text-white" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="space-y-0.5">
                      <h3 className="font-bold text-xs text-gray-900 leading-tight line-clamp-2" title={set.name}>
                        {set.name}
                      </h3>
                      <Badge
                        variant={set.isActive ? 'default' : 'secondary'}
                        className={`text-[8px] px-1 py-0 w-max border-none ${
                          set.isActive
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-150'
                        }`}
                      >
                        {set.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {set.brandName && (
                        <span className="text-[9px] text-gray-400 truncate" title={set.brandName}>
                          Marca: {set.brandName}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[8px] px-1 py-0.5 w-max font-normal text-gray-400 border-gray-200">
                        {set.itemCount} {set.itemCount === 1 ? 'pza' : 'pzas'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Middle Area: Pieces thumbnails */}
                {set.items && set.items.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] text-gray-400 font-semibold tracking-wide uppercase leading-none">
                      Piezas:
                    </span>
                    <div className="flex flex-wrap gap-0.5">
                      {set.items.map((item, idx) => (
                        <div
                          key={item.productId || idx}
                          className="h-6 w-6 rounded border border-gray-200 bg-gray-50 overflow-hidden hover:scale-110 transition-transform duration-200 cursor-help shrink-0"
                          title={item.name}
                        >
                          <PieceThumb item={item} />
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
                    <span className="text-[9px] text-gray-500 font-medium select-none hidden lg:inline">
                      {set.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link href={`/admin/sets/${set.id}`}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 hover:bg-gray-100 rounded text-gray-700"
                        title="Editar"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </Link>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600 rounded text-gray-550 group"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3 h-3 text-gray-550 group-hover:text-red-600" />
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
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

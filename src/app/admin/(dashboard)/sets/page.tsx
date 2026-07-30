'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Boxes } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { SetCard, type AdminSet } from '@/components/admin/SetCard';

export default function AdminSetsPage() {
  const { canWrite } = usePermissions();
  const canEdit = canWrite('sets');
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
        {canEdit && (
          <Link href="/admin/sets/nuevo" className="self-start sm:self-auto">
            <Button className="bg-[#111111] hover:bg-black/90 h-11 px-6">
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Set
            </Button>
          </Link>
        )}
      </div>
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Card key={n} className="overflow-hidden border border-gray-150 animate-pulse p-2.5 space-y-2">
              <div className="flex gap-2 items-start">
                <div className="w-9 h-12 bg-gray-200 rounded shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                  <div className="h-2.5 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="h-2 bg-gray-200 rounded w-1/4" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
              <div className="h-7 bg-gray-200 rounded w-full" />
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
          {canEdit && (
            <Link href="/admin/sets/nuevo" className="mt-6">
              <Button className="bg-[#111111] hover:bg-black/90">
                Crear primer set
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 items-start">
          {sets.map((set) => (
            <SetCard
              key={set.id}
              set={set}
              canEdit={canEdit}
              onToggleActive={toggleActive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

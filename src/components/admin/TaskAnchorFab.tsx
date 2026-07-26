'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ClipboardCheck, X } from 'lucide-react';
import { useAnchoredTask } from '@/contexts/AnchoredTaskContext';

interface AnchorableTask {
  id: string;
  type: string;
  title: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED';
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
};

/**
 * FAB de anclaje de tareas (2026-07-26) — visible solo en `/admin/productos` y
 * `/admin/sets`. Permite al Gestor del Catálogo seleccionar cuál de sus tareas
 * asignadas (filtradas por tipo según el panel) está trabajando ahora mismo; el
 * formulario de Producto/Set consume `useAnchoredTask()` para avanzar esa tarea al
 * guardar (ver `ProductForm.tsx`/`SetForm.tsx`).
 */
export function TaskAnchorFab() {
  const pathname = usePathname();
  const { anchoredTask, setAnchoredTask, clearAnchoredTask } = useAnchoredTask();
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<AnchorableTask[]>([]);
  const [loading, setLoading] = useState(false);

  const isProductsPanel = pathname.startsWith('/admin/productos');
  const isSetsPanel = pathname.startsWith('/admin/sets');
  const visible = isProductsPanel || isSetsPanel;

  const load = useCallback(async () => {
    if (!visible) return;
    setLoading(true);
    try {
      const types = isProductsPanel
        ? ['CREATE_PRODUCT', 'EDIT_PRODUCT', 'SET_PRODUCT_SLOT']
        : ['CREATE_SET', 'EDIT_SET'];
      const results = await Promise.all(
        types.map((type) => fetch(`/api/admin/tasks?type=${type}`).then((r) => (r.ok ? r.json() : { tasks: [] })))
      );
      const all: AnchorableTask[] = results.flatMap((r) => r.tasks ?? []);
      setTasks(all.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS'));
    } finally {
      setLoading(false);
    }
  }, [visible, isProductsPanel]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!visible) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          title={anchoredTask ? `Tarea anclada: ${anchoredTask.title}` : 'Anclar una tarea'}
          className={cn(
            'fixed z-40 right-20 md:right-24 bottom-[calc(9rem_+_env(safe-area-inset-bottom))] md:bottom-6 h-11 w-11 rounded-full shadow-lg transition-colors',
            anchoredTask ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-[#111111]/50 hover:bg-[#111111]/70 text-white'
          )}
        >
          <ClipboardCheck className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        {anchoredTask ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Tarea anclada</p>
              <p className="text-sm font-medium text-[#111111]">{anchoredTask.title}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => { clearAnchoredTask(); setOpen(false); }}
            >
              <X className="w-3.5 h-3.5" />
              Desanclar
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Anclar una tarea
            </p>
            {loading ? (
              <p className="text-sm text-gray-500">Cargando...</p>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-gray-500">No tienes tareas pendientes aquí.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => { setAnchoredTask({ id: task.id, title: task.title, type: task.type }); setOpen(false); }}
                    className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm text-gray-700 truncate">{task.title}</p>
                    <Badge variant="outline" className="text-xs mt-1">{STATUS_LABELS[task.status] ?? task.status}</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

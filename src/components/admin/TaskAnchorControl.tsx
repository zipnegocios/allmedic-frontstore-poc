'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
 * Anclaje de tareas — mitad "selector" del FAB original (`TaskAnchorFab.tsx`, dividido en dos
 * componentes en el plan 2026-07-27, decisión 7): se monta dentro del formulario de Producto/Set
 * (crear o editar, nunca en el listado). Sin tarea anclada, muestra el selector de tareas
 * PENDING/IN_PROGRESS asignadas al usuario, filtradas por el tipo de panel (`panelTypes`). Con
 * tarea anclada, muestra su detalle y un botón explícito "Cambiar tarea anclada" para volver al
 * selector (permite corregir errores del operador) — el llamador (`ProductForm`/`SetForm`) sigue
 * siendo dueño de los botones "Guardar y continuar después"/"Guardar y completar tarea".
 */
export function TaskAnchorControl({ panelTypes, children }: { panelTypes: string[]; children: React.ReactNode }) {
  const { anchoredTask, setAnchoredTask, clearAnchoredTask } = useAnchoredTask();
  const [selecting, setSelecting] = useState(false);
  const [tasks, setTasks] = useState<AnchorableTask[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        panelTypes.map((type) => fetch(`/api/admin/tasks?type=${type}`).then((r) => (r.ok ? r.json() : { tasks: [] })))
      );
      const all: AnchorableTask[] = results.flatMap((r) => r.tasks ?? []);
      setTasks(all.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS'));
    } finally {
      setLoading(false);
    }
  }, [panelTypes]);

  useEffect(() => {
    if (selecting) load();
  }, [selecting, load]);

  if (!anchoredTask && !selecting) {
    return (
      <div className="mb-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Sin tarea anclada — puedes vincular esta edición a una tarea asignada.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => setSelecting(true)}>
          Anclar tarea
        </Button>
      </div>
    );
  }

  if (selecting) {
    return (
      <div className="mb-4 rounded-lg border border-gray-200 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Elegir tarea a anclar</p>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelecting(false)}>Cancelar</Button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Cargando...</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-gray-500">No tienes tareas pendientes aquí.</p>
        ) : (
          <div className="max-h-56 overflow-y-auto space-y-1">
            {tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => { setAnchoredTask({ id: task.id, title: task.title, type: task.type }); setSelecting(false); }}
                className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <p className="text-sm text-gray-700 truncate">{task.title}</p>
                <Badge variant="outline" className="text-xs mt-1">{STATUS_LABELS[task.status] ?? task.status}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-600">Tarea anclada: <span className="font-medium text-[#111111]">{anchoredTask!.title}</span></p>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setSelecting(true)}>Cambiar tarea anclada</Button>
          <Button type="button" size="sm" variant="ghost" onClick={clearAnchoredTask}>Desanclar</Button>
        </div>
      </div>
      {children}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAnchoredTask } from '@/contexts/AnchoredTaskContext';

interface BlockLine {
  code: string;
  url: string;
}

interface AnchorableTask {
  id: string;
  type: string;
  title: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED';
  description: string | null;
  targetCode: string | null;
  sourceUrl: string | null;
  blockA: BlockLine[] | null;
  blockB: BlockLine[] | null;
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
                onClick={() => {
                  setAnchoredTask({
                    id: task.id,
                    title: task.title,
                    type: task.type,
                    description: task.description,
                    targetCode: task.targetCode,
                    sourceUrl: task.sourceUrl,
                    blockA: task.blockA,
                    blockB: task.blockB,
                  });
                  setSelecting(false);
                }}
                className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <p className="text-sm text-gray-700 truncate">{task.title}</p>
                {task.description && <p className="text-xs text-gray-500 truncate">{task.description}</p>}
                {task.targetCode && <p className="text-xs text-gray-400">Código: {task.targetCode}</p>}
                <Badge variant="outline" className="text-xs mt-1">{STATUS_LABELS[task.status] ?? task.status}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const task = anchoredTask!;
  const hasBlocks = (task.blockA && task.blockA.some((l) => l.code || l.url)) || (task.blockB && task.blockB.some((l) => l.code || l.url));

  return (
    <div className="mb-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 mb-2 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">Tarea anclada: <span className="font-medium text-[#111111]">{task.title}</span></p>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setSelecting(true)}>Cambiar tarea anclada</Button>
            <Button type="button" size="sm" variant="ghost" onClick={clearAnchoredTask}>Desanclar</Button>
          </div>
        </div>

        {/* Instrucciones de la tarea — sin esto el Gestor no ve qué debe ejecutar
            (código de producto, URL de referencia, bloques de un set). */}
        {task.description && <p className="text-sm text-gray-700">{task.description}</p>}
        {task.targetCode && <p className="text-xs text-gray-600">Style code: <span className="font-medium">{task.targetCode}</span></p>}
        {task.sourceUrl && (
          <p className="text-xs text-gray-600">
            URL fuente: <a href={task.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{task.sourceUrl}</a>
          </p>
        )}
        {hasBlocks && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            {task.blockA && task.blockA.some((l) => l.code || l.url) && (
              <div className="space-y-1 rounded-lg border border-emerald-100 bg-white p-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Bloque A</p>
                {task.blockA.map((line, i) => (
                  <div key={i} className="text-xs text-gray-600">
                    <p>Código: <span className="text-gray-800">{line.code || '—'}</span></p>
                    {line.url && <a href={line.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{line.url}</a>}
                  </div>
                ))}
              </div>
            )}
            {task.blockB && task.blockB.some((l) => l.code || l.url) && (
              <div className="space-y-1 rounded-lg border border-emerald-100 bg-white p-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Bloque B</p>
                {task.blockB.map((line, i) => (
                  <div key={i} className="text-xs text-gray-600">
                    <p>Código: <span className="text-gray-800">{line.code || '—'}</span></p>
                    {line.url && <a href={line.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{line.url}</a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ClipboardList, Search } from 'lucide-react';
import { TaskStatusBadge } from './TaskStatusBadge';

/** Rutas de listado exactas (sin segmento adicional) — `/admin/productos/nuevo` o
 * `/admin/productos/[id]` son formulario, no listado, y no deben mostrar este panel (ese es
 * el trabajo de `TaskAnchorControl`, montado dentro del form). Corrige el bug del FAB original
 * (`TaskAnchorFab.tsx`), que usaba `pathname.startsWith(...)` y no distinguía ambos contextos. */
const LISTING_PATHS = ['/admin/productos', '/admin/sets'];

interface PanelTask {
  id: string;
  type: string;
  title: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED';
  targetEntityId: string | null;
  targetCode: string | null;
}

/**
 * Panel de tareas no ancladas (plan 2026-07-27, decisión 7, mitad "listado" del FAB original) —
 * se monta solo en el listado (`/admin/productos`, `/admin/sets`), nunca en el formulario de
 * crear/editar (ese es `TaskAnchorControl`). Muestra tareas de los tipos indicados en estado
 * `PENDING` o `COMPLETED` ("Por revisar") que aún no tienen `targetEntityId` — sirve para que el
 * Gestor vea qué le falta y el Coordinador/Admin vea qué está pendiente de revisión sin abrir un
 * producto puntual. Incluye buscador de texto libre sobre título/código (decisión 10).
 */
export function UnanchoredTasksPanel() {
  const pathname = usePathname();
  const visible = LISTING_PATHS.includes(pathname);
  const types = useMemo(
    () => (pathname.startsWith('/admin/sets') ? ['CREATE_SET', 'EDIT_SET'] : ['CREATE_PRODUCT', 'EDIT_PRODUCT', 'SET_PRODUCT_SLOT']),
    [pathname]
  );

  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<PanelTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';
      const results = await Promise.all(
        types.map((type) => fetch(`/api/admin/tasks?type=${type}${params}`).then((r) => (r.ok ? r.json() : { tasks: [] })))
      );
      const all: PanelTask[] = results.flatMap((r) => r.tasks ?? []);
      setTasks(all.filter((t) => !t.targetEntityId && (t.status === 'PENDING' || t.status === 'COMPLETED')));
    } finally {
      setLoading(false);
    }
  }, [types, search]);

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
          title="Tareas sin anclar"
          className={cn(
            'fixed z-40 right-20 md:right-24 bottom-[calc(9rem_+_env(safe-area-inset-bottom))] md:bottom-6 h-11 w-11 rounded-full shadow-lg transition-colors',
            'bg-[#111111]/50 hover:bg-[#111111]/70 text-white'
          )}
        >
          <ClipboardList className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tareas sin anclar</p>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título o código..."
              className="h-8 text-sm pl-8"
            />
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-gray-500">No hay tareas sin anclar aquí.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1">
              {tasks.map((task) => (
                <div key={task.id} className="px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <p className="text-sm text-gray-700 truncate">{task.title}</p>
                  {task.targetCode && <p className="text-xs text-gray-400">Código: {task.targetCode}</p>}
                  <TaskStatusBadge status={task.status} className="text-xs mt-1" />
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

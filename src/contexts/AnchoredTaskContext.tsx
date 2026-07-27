'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const STORAGE_KEY = 'admin_anchored_task';

interface BlockLine {
  code: string;
  url: string;
}

export type AnchoredTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

interface AnchoredTask {
  id: string;
  title: string;
  type: string;
  status: AnchoredTaskStatus;
  description: string | null;
  targetCode: string | null;
  sourceUrl: string | null;
  blockA: BlockLine[] | null;
  blockB: BlockLine[] | null;
}

interface AnchoredTaskContextValue {
  anchoredTask: AnchoredTask | null;
  setAnchoredTask: (task: AnchoredTask) => void;
  updateAnchoredStatus: (status: AnchoredTaskStatus) => void;
  clearAnchoredTask: () => void;
}

const AnchoredTaskContext = createContext<AnchoredTaskContextValue | null>(null);

function readStored(): AnchoredTask | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Anclaje de tareas (2026-07-26, FAB dividido en dos componentes el 2026-07-27 — ver
 * `TaskAnchorControl`/`UnanchoredTasksPanel`): el Gestor del Catálogo "ancla" una de sus tareas
 * PENDING/IN_PROGRESS asignadas mientras trabaja en el formulario de Producto/Set, para que al
 * guardar se cierre/avance esa tarea sin salir de la página. Es un atajo efímero de sesión de
 * navegador (`sessionStorage`) — no es la fuente de verdad (esa sigue siendo `catalog_tasks` en
 * BD); si se cierra la pestaña, se pierde el anclaje pero no el trabajo real ya guardado.
 */
export function AnchoredTaskProvider({ children }: { children: React.ReactNode }) {
  const [anchoredTask, setAnchoredTaskState] = useState<AnchoredTask | null>(readStored);

  const setAnchoredTask = useCallback((task: AnchoredTask) => {
    setAnchoredTaskState(task);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(task));
  }, []);

  const clearAnchoredTask = useCallback(() => {
    setAnchoredTaskState(null);
    window.sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  // Refleja el nuevo estado tras "Guardar y continuar después"/"Guardar y completar tarea" sin
  // desanclar — la tarea sigue pudiéndose reabrir/reeditar mientras esté PENDING/IN_PROGRESS/
  // COMPLETED (por revisar); solo se desancla explícitamente o al ser aprobada/rechazada.
  const updateAnchoredStatus = useCallback((status: AnchoredTaskStatus) => {
    setAnchoredTaskState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, status };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AnchoredTaskContext.Provider value={{ anchoredTask, setAnchoredTask, updateAnchoredStatus, clearAnchoredTask }}>
      {children}
    </AnchoredTaskContext.Provider>
  );
}

export function useAnchoredTask(): AnchoredTaskContextValue {
  const ctx = useContext(AnchoredTaskContext);
  if (!ctx) throw new Error('useAnchoredTask debe usarse dentro de AnchoredTaskProvider');
  return ctx;
}

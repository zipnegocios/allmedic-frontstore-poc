'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { TaskStatusBadge, type CatalogTaskStatus } from './TaskStatusBadge';
import { SetTaskProgressViewer } from './SetTaskProgressViewer';
import { CommentThread } from './CommentThread';

interface TaskDetail {
  id: string;
  type: string;
  title: string;
  description: string | null;
  targetCode: string | null;
  status: CatalogTaskStatus;
  rejectionReason: string | null;
  createdAt: string;
  completedAt: string | null;
  reviewedAt: string | null;
  assignedToName: string | null;
  assignedByName: string | null;
  canReview: boolean;
}

/**
 * Modal de detalle de tarea (plan 2026-07-27, decisión 8) — un solo componente reutilizado
 * desde el listado de tareas y desde el quicklink en el listado de productos. Contenido:
 * detalle básico, hilo de comentarios completo (lectura y escritura), acciones de revisión
 * (`canReview`, ya resuelto server-side por `getTaskDetail`), y visor de piezas si es un set.
 */
export function TaskDetailModal({ taskId, onClose, onChanged }: { taskId: string; onClose: () => void; onChanged?: () => void }) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTask(data.task);
      }
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(decision: 'APPROVE' | 'REJECT') {
    if (decision === 'REJECT' && !reason.trim()) {
      toast.error('El motivo de rechazo es obligatorio');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tasks/${taskId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision === 'APPROVE' ? { decision } : { decision, reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'No se pudo revisar la tarea');
        return;
      }
      toast.success(decision === 'APPROVE' ? 'Tarea aprobada' : 'Tarea rechazada');
      setRejecting(false);
      setReason('');
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  const isSetTask = task?.type === 'CREATE_SET';

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[80vw] max-w-[80vw] sm:max-w-[80vw] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{loading ? 'Cargando...' : task?.title}</DialogTitle>
        </DialogHeader>

        {loading || !task ? (
          <p className="text-sm text-gray-500">Cargando...</p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="flex items-center gap-2 flex-wrap">
              <TaskStatusBadge status={task.status} />
              {task.targetCode && <span className="text-xs text-gray-400">Código: {task.targetCode}</span>}
            </div>

            {task.description && <p className="text-sm text-gray-600">{task.description}</p>}

            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
              <p>Asignada a: <span className="text-gray-700">{task.assignedToName ?? '—'}</span></p>
              <p>Asignada por: <span className="text-gray-700">{task.assignedByName ?? '—'}</span></p>
              <p>Creada: <span className="text-gray-700">{new Date(task.createdAt).toLocaleDateString('es-EC')}</span></p>
              {task.reviewedAt && <p>Revisada: <span className="text-gray-700">{new Date(task.reviewedAt).toLocaleDateString('es-EC')}</span></p>}
            </div>

            {task.status === 'REJECTED' && task.rejectionReason && (
              <p className="text-sm text-red-600">Motivo de corrección: {task.rejectionReason}</p>
            )}

            {task.canReview && task.status === 'COMPLETED' && !isSetTask && (
              <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => review('APPROVE')}>Aprobar</Button>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => setRejecting((v) => !v)}>Corregir</Button>
              </div>
            )}
            {rejecting && (
              <div className="space-y-2">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de la corrección (obligatorio)" rows={2} />
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => review('REJECT')}>Confirmar corrección</Button>
              </div>
            )}

            {isSetTask && (
              <div className="border-t border-gray-100 pt-3">
                <SetTaskProgressViewer parentTaskId={task.id} canReview={task.canReview} />
              </div>
            )}

            <div className="border-t border-gray-100 pt-3">
              <CommentThread mode="task" taskId={task.id} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

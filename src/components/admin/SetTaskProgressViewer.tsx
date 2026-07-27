'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { TaskStatusBadge, type CatalogTaskStatus } from './TaskStatusBadge';
import { CheckCircle2, XCircle } from 'lucide-react';

interface SlotTask {
  id: string;
  title: string;
  status: CatalogTaskStatus;
  targetCode: string | null;
  assignedToName?: string | null;
}

/**
 * Visor de piezas de un set (plan 2026-07-27, decisión 5) — lista las subtareas
 * `SET_PRODUCT_SLOT` de una tarea `CREATE_SET` padre, con estado individual y acción de
 * aprobar/corregir por pieza (para quien tenga `canReview`). El padre permanece `IN_PROGRESS`
 * mientras existan piezas no aprobadas; cuando todas llegan a `APPROVED`, el backend
 * (`publishSetIfGroupApproved`) lo pasa a `APPROVED` automáticamente — este componente solo
 * refleja el conteo, no dispara esa transición él mismo.
 */
export function SetTaskProgressViewer({ parentTaskId, canReview }: { parentTaskId: string; canReview: boolean }) {
  const [slots, setSlots] = useState<SlotTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tasks/${parentTaskId}/subtasks`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.subtasks ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [parentTaskId]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(slotId: string) {
    setBusyId(slotId);
    try {
      const res = await fetch(`/api/admin/tasks/${slotId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'APPROVE' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'No se pudo aprobar la pieza');
        return;
      }
      toast.success('Pieza aprobada');
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function reject(slotId: string) {
    if (!reason.trim()) {
      toast.error('El motivo de corrección es obligatorio');
      return;
    }
    setBusyId(slotId);
    try {
      const res = await fetch(`/api/admin/tasks/${slotId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'REJECT', reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'No se pudo corregir la pieza');
        return;
      }
      toast.success('Pieza devuelta a corrección');
      setRejectingId(null);
      setReason('');
      load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Cargando piezas...</p>;
  if (slots.length === 0) return null;

  const approvedCount = slots.filter((s) => s.status === 'APPROVED').length;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Piezas del set ({approvedCount}/{slots.length} aprobadas)
      </p>
      <div className="space-y-2">
        {slots.map((slot) => (
          <div key={slot.id} className="border border-gray-200 rounded-lg p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-gray-800 truncate">{slot.title}</p>
                {slot.assignedToName && <p className="text-xs text-gray-400">{slot.assignedToName}</p>}
              </div>
              <TaskStatusBadge status={slot.status} />
            </div>

            {canReview && slot.status === 'COMPLETED' && (
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 gap-1 text-emerald-700 border-emerald-200" disabled={busyId === slot.id} onClick={() => approve(slot.id)}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Aprobar
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-red-700 border-red-200" disabled={busyId === slot.id} onClick={() => setRejectingId(slot.id)}>
                  <XCircle className="w-3.5 h-3.5" />
                  Corregir
                </Button>
              </div>
            )}

            {rejectingId === slot.id && (
              <div className="mt-2 space-y-1.5">
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo de la corrección (obligatorio)"
                  rows={2}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={busyId === slot.id} onClick={() => reject(slot.id)}>
                    Confirmar corrección
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setReason(''); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

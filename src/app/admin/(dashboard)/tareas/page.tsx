'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, ClipboardList, MessageSquare } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { CommentThread } from '@/components/admin/CommentThread';

type TaskType = 'CREATE_PRODUCT' | 'CREATE_SET' | 'UPLOAD_MEDIA' | 'EDIT_PRODUCT' | 'EDIT_SET' | 'GENERIC';
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED';

interface Task {
  id: string;
  type: TaskType;
  title: string;
  description: string | null;
  targetCode: string | null;
  status: TaskStatus;
  rejectionReason: string | null;
  createdAt: string;
  assignedTo: string;
  assignedToName: string | null;
}

interface Assignee {
  id: string;
  name: string | null;
  email: string;
}

const TYPE_LABELS: Record<TaskType, string> = {
  CREATE_PRODUCT: 'Crear producto',
  CREATE_SET: 'Crear set',
  UPLOAD_MEDIA: 'Subir medios',
  EDIT_PRODUCT: 'Editar producto',
  EDIT_SET: 'Editar set',
  GENERIC: 'Genérica',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  PENDING: 'bg-gray-200 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function TareasPage() {
  const { data: session } = useSession();
  const { isAdmin } = usePermissions();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/admin/tasks${qs}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const userId = (session?.user as { id?: string } | undefined)?.id;

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">Tareas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin ? 'Asignación y seguimiento de trabajo del Gestor del Catálogo' : 'Tus tareas asignadas'}
          </p>
        </div>
        {isAdmin && <CreateTaskDialog onCreated={load} />}
      </div>

      <div className="mb-4 w-full max-w-xs">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filtrar por estado">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            No hay tareas para mostrar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} isAdmin={isAdmin} currentUserId={userId} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateTaskDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [type, setType] = useState<TaskType>('GENERIC');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetCode, setTargetCode] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch('/api/admin/tasks/assignees').then(async (res) => {
      if (res.ok) setAssignees((await res.json()).assignees);
    });
  }, [open]);

  async function handleSubmit() {
    if (!title.trim() || !assignedTo) {
      toast.error('Título y Gestor asignado son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title,
          description: description || null,
          targetCode: type === 'CREATE_PRODUCT' || type === 'CREATE_SET' ? (targetCode || null) : null,
          assignedTo,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'No se pudo crear la tarea');
        return;
      }
      toast.success('Tarea asignada');
      setOpen(false);
      setTitle(''); setDescription(''); setTargetCode(''); setAssignedTo(''); setType('GENERIC');
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-1.5" />Asignar tarea</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Asignar nueva tarea</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tipo</label>
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Armar set corporativo Marca X" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descripción</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          {(type === 'CREATE_PRODUCT' || type === 'CREATE_SET') && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Style code (aún no creado)</label>
              <Input value={targetCode} onChange={(e) => setTargetCode(e.target.value)} placeholder="Ej. SCR-2026-014" />
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Asignar a</label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Selecciona un Gestor del Catálogo" /></SelectTrigger>
              <SelectContent>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name ?? a.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando...' : 'Asignar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskCard({ task, isAdmin, currentUserId, onChanged }: {
  task: Task; isAdmin: boolean; currentUserId: string | undefined; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showComments, setShowComments] = useState(false);
  const isOwner = task.assignedTo === currentUserId;

  async function advance(toStatus: 'IN_PROGRESS' | 'COMPLETED') {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tasks/${task.id}/advance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'No se pudo actualizar la tarea');
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function review(decision: 'APPROVE' | 'REJECT') {
    if (decision === 'REJECT' && !rejectReason.trim()) {
      toast.error('El motivo de rechazo es obligatorio');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tasks/${task.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision === 'APPROVE' ? { decision } : { decision, reason: rejectReason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'No se pudo revisar la tarea');
        return;
      }
      toast.success(decision === 'APPROVE' ? 'Tarea aprobada' : 'Tarea rechazada');
      setRejectOpen(false);
      setRejectReason('');
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className="text-xs">{TYPE_LABELS[task.type]}</Badge>
              <Badge className={`${STATUS_COLORS[task.status]} border-none text-xs`}>{STATUS_LABELS[task.status]}</Badge>
            </div>
            <p className="font-medium text-[#111111]">{task.title}</p>
            {task.description && <p className="text-sm text-gray-500 mt-0.5">{task.description}</p>}
            {task.targetCode && <p className="text-xs text-gray-400 mt-1">Style code: {task.targetCode}</p>}
            {isAdmin && <p className="text-xs text-gray-400 mt-1">Asignada a: {task.assignedToName ?? '—'}</p>}
            {task.status === 'REJECTED' && task.rejectionReason && (
              <p className="text-xs text-red-600 mt-1.5">Motivo de rechazo: {task.rejectionReason}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOwner && task.status === 'PENDING' && (
              <Button size="sm" disabled={busy} onClick={() => advance('IN_PROGRESS')}>Iniciar</Button>
            )}
            {isOwner && task.status === 'IN_PROGRESS' && (
              <Button size="sm" disabled={busy} onClick={() => advance('COMPLETED')}>Marcar completada</Button>
            )}
            {isAdmin && task.status === 'COMPLETED' && (
              <>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => review('APPROVE')}>Aprobar</Button>
                <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="destructive" disabled={busy}>Rechazar</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Rechazar tarea</DialogTitle></DialogHeader>
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Motivo del rechazo (obligatorio)"
                      rows={3}
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
                      <Button variant="destructive" disabled={busy} onClick={() => review('REJECT')}>Confirmar rechazo</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => setShowComments((v) => !v)}>
              <MessageSquare className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {showComments && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <CommentThread mode="task" taskId={task.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

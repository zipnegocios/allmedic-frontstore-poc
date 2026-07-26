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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Plus, ClipboardList, MessageSquare, Users2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { CommentThread } from '@/components/admin/CommentThread';
import { EntityPicker, type EntityPickerOption } from '@/components/admin/EntityPicker';

type TaskType = 'CREATE_PRODUCT' | 'CREATE_SET' | 'UPLOAD_MEDIA' | 'EDIT_PRODUCT' | 'EDIT_SET' | 'GENERIC';
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED';
type PaymentCadence = 'DAY' | 'WEEK' | 'MONTH';

interface TaskBlock {
  code: string;
  url: string;
}

interface Task {
  id: string;
  type: TaskType;
  title: string;
  description: string | null;
  targetCode: string | null;
  targetEntityType: 'PRODUCT' | 'SET' | null;
  targetEntityId: string | null;
  gender: string | null;
  sourceUrl: string | null;
  blockA: TaskBlock | null;
  blockB: TaskBlock | null;
  groupId: string | null;
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

interface TaskGroup {
  id: string;
  name: string;
  paymentAmount: string;
  paymentCadence: PaymentCadence;
  createdAt: string;
  completedAt: string | null;
  createdByName: string | null;
  totalTasks: number;
  approvedTasks: number;
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

const CADENCE_LABELS: Record<PaymentCadence, string> = {
  DAY: 'Por día',
  WEEK: 'Por semana',
  MONTH: 'Por mes',
};

const GENDER_OPTIONS = ['Hombre', 'Mujer', 'Unisex'];

export default function TareasPage() {
  const { data: session } = useSession();
  const { isAdmin } = usePermissions();
  const [tab, setTab] = useState('tareas');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadTasks = useCallback(async () => {
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

  const loadGroups = useCallback(async () => {
    const res = await fetch('/api/admin/task-groups');
    if (res.ok) setGroups((await res.json()).groups);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (tab === 'grupos') loadGroups();
  }, [tab, loadGroups]);

  const userId = (session?.user as { id?: string } | undefined)?.id;

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">Tareas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin ? 'Asignación y seguimiento de trabajo del Gestor del Catálogo' : 'Tus tareas asignadas'}
          </p>
        </div>
        {isAdmin && tab === 'tareas' && <CreateTaskDialog groups={groups} onCreated={loadTasks} />}
        {isAdmin && tab === 'grupos' && <CreateGroupDialog onCreated={loadGroups} />}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
          <TabsTrigger value="grupos">Grupos</TabsTrigger>
        </TabsList>

        <TabsContent value="tareas">
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
                <TaskCard key={task.id} task={task} isAdmin={isAdmin} currentUserId={userId} onChanged={loadTasks} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="grupos">
          {groups.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Users2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No hay grupos de tareas todavía.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GroupCard({ group }: { group: TaskGroup }) {
  const pct = group.totalTasks > 0 ? Math.round((group.approvedTasks / group.totalTasks) * 100) : 0;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <p className="font-medium text-[#111111]">{group.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              ${Number(group.paymentAmount).toFixed(2)} · {CADENCE_LABELS[group.paymentCadence]}
              {group.createdByName && ` · Creado por ${group.createdByName}`}
            </p>
          </div>
          {group.completedAt ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-none">Completado</Badge>
          ) : (
            <Badge variant="outline">En progreso</Badge>
          )}
        </div>
        <Progress value={pct} className="h-1.5" />
        <p className="text-xs text-gray-500 mt-1.5">{group.approvedTasks}/{group.totalTasks} tareas aprobadas</p>
      </CardContent>
    </Card>
  );
}

function CreateGroupDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCadence, setPaymentCadence] = useState<PaymentCadence>('WEEK');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !paymentAmount.trim()) {
      toast.error('Nombre y monto son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/task-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, paymentAmount, paymentCadence }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'No se pudo crear el grupo');
        return;
      }
      toast.success('Grupo creado');
      setOpen(false);
      setName(''); setPaymentAmount(''); setPaymentCadence('WEEK');
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-1.5" />Nuevo grupo</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo grupo de tareas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nombre del grupo</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='Ej. "Cargar Colección XYZ - Fase 1"' />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Monto fijo ($)</label>
              <Input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Cadencia</label>
              <Select value={paymentCadence} onValueChange={(v) => setPaymentCadence(v as PaymentCadence)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CADENCE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            El monto se acredita una sola vez, cuando todas las tareas del grupo queden aprobadas.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando...' : 'Crear grupo'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateTaskDialog({ groups, onCreated }: { groups: TaskGroup[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [products, setProducts] = useState<EntityPickerOption[]>([]);
  const [sets, setSets] = useState<EntityPickerOption[]>([]);
  const [type, setType] = useState<TaskType>('GENERIC');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetCode, setTargetCode] = useState('');
  const [gender, setGender] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [blockACode, setBlockACode] = useState('');
  const [blockAUrl, setBlockAUrl] = useState('');
  const [blockBCode, setBlockBCode] = useState('');
  const [blockBUrl, setBlockBUrl] = useState('');
  const [targetEntityId, setTargetEntityId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string>('none');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);

  const openGroups = groups.filter((g) => !g.completedAt);

  useEffect(() => {
    if (!open) return;
    fetch('/api/admin/tasks/assignees').then(async (res) => {
      if (res.ok) setAssignees((await res.json()).assignees);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (type === 'EDIT_PRODUCT' && products.length === 0) {
      fetch('/api/admin/products/lite').then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products.map((p: { id: string; name: string; code: string | null; brandName: string }) => ({
            id: p.id,
            label: p.code ? `${p.name} (${p.code})` : p.name,
            sublabel: p.brandName || null,
          })));
        }
      });
    }
    if (type === 'EDIT_SET' && sets.length === 0) {
      fetch('/api/admin/sets').then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setSets(data.sets.map((s: { id: string; name: string; brandName: string | null }) => ({
            id: s.id,
            label: s.name,
            sublabel: s.brandName || null,
          })));
        }
      });
    }
  }, [open, type, products.length, sets.length]);

  function resetForm() {
    setTitle(''); setDescription(''); setTargetCode(''); setGender(''); setSourceUrl('');
    setBlockACode(''); setBlockAUrl(''); setBlockBCode(''); setBlockBUrl('');
    setTargetEntityId(null); setGroupId('none'); setAssignedTo(''); setType('GENERIC');
  }

  async function handleSubmit() {
    if (!title.trim() || !assignedTo) {
      toast.error('Título y Gestor asignado son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        type,
        title,
        description: description || null,
        assignedTo,
        groupId: groupId !== 'none' ? groupId : null,
      };
      if (type === 'CREATE_PRODUCT') {
        body.targetCode = targetCode || null;
        body.gender = gender || null;
        body.sourceUrl = sourceUrl || null;
      } else if (type === 'CREATE_SET') {
        body.targetCode = targetCode || null;
        body.gender = gender || null;
        body.blockA = blockACode || blockAUrl ? { code: blockACode, url: blockAUrl } : null;
        body.blockB = blockBCode || blockBUrl ? { code: blockBCode, url: blockBUrl } : null;
      } else if (type === 'EDIT_PRODUCT') {
        body.targetEntityType = 'PRODUCT';
        body.targetEntityId = targetEntityId;
      } else if (type === 'EDIT_SET') {
        body.targetEntityType = 'SET';
        body.targetEntityId = targetEntityId;
      }

      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'No se pudo crear la tarea');
        return;
      }
      toast.success('Tarea asignada');
      setOpen(false);
      resetForm();
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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Asignar nueva tarea</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tipo</label>
            <Select value={type} onValueChange={(v) => { setType(v as TaskType); setTargetEntityId(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CREATE_PRODUCT: Título (1/2) + Style code (1/4) + Género (1/4), luego URL fuente */}
          {type === 'CREATE_PRODUCT' && (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">Título</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Camisón quirúrgico Modelo X" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Style code</label>
                  <Input value={targetCode} onChange={(e) => setTargetCode(e.target.value)} placeholder="SCR-2026-014" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Género</label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">URL Fuente</label>
                <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
              </div>
            </>
          )}

          {/* CREATE_SET: Título (1/2) + Género (1/4), luego Bloque A y Bloque B */}
          {type === 'CREATE_SET' && (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">Título</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Set corporativo Marca X" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Style code</label>
                  <Input value={targetCode} onChange={(e) => setTargetCode(e.target.value)} placeholder="SCR-2026-014" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Género</label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Bloque A</p>
                <div className="grid grid-cols-4 gap-3">
                  <Input value={blockACode} onChange={(e) => setBlockACode(e.target.value)} placeholder="Código" />
                  <Input className="col-span-3" value={blockAUrl} onChange={(e) => setBlockAUrl(e.target.value)} placeholder="URL del producto" />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Bloque B</p>
                <div className="grid grid-cols-4 gap-3">
                  <Input value={blockBCode} onChange={(e) => setBlockBCode(e.target.value)} placeholder="Código" />
                  <Input className="col-span-3" value={blockBUrl} onChange={(e) => setBlockBUrl(e.target.value)} placeholder="URL del producto" />
                </div>
              </div>
            </>
          )}

          {/* EDIT_PRODUCT / EDIT_SET / UPLOAD_MEDIA / GENERIC: título simple */}
          {(type === 'EDIT_PRODUCT' || type === 'EDIT_SET' || type === 'UPLOAD_MEDIA' || type === 'GENERIC') && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Título</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Armar set corporativo Marca X" />
            </div>
          )}

          {type === 'EDIT_PRODUCT' && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Producto a editar</label>
              <EntityPicker options={products} value={targetEntityId} onChange={setTargetEntityId} placeholder="Buscar producto..." />
            </div>
          )}
          {type === 'EDIT_SET' && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Set a editar</label>
              <EntityPicker options={sets} value={targetEntityId} onChange={setTargetEntityId} placeholder="Buscar set..." />
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1.5 block">Descripción</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          {openGroups.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Grupo de tareas (opcional)</label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin grupo</SelectItem>
                  {openGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
              {task.groupId && <Badge variant="secondary" className="text-xs">En grupo</Badge>}
            </div>
            <p className="font-medium text-[#111111]">{task.title}</p>
            {task.description && <p className="text-sm text-gray-500 mt-0.5">{task.description}</p>}
            {task.targetCode && <p className="text-xs text-gray-400 mt-1">Style code: {task.targetCode}</p>}
            {task.gender && <p className="text-xs text-gray-400 mt-1">Género: {task.gender}</p>}
            {task.sourceUrl && (
              <p className="text-xs text-gray-400 mt-1">
                URL fuente: <a href={task.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{task.sourceUrl}</a>
              </p>
            )}
            {task.blockA && (task.blockA.code || task.blockA.url) && (
              <p className="text-xs text-gray-400 mt-1">
                Bloque A: {task.blockA.code} {task.blockA.url && (<a href={task.blockA.url} target="_blank" rel="noopener noreferrer" className="underline">enlace</a>)}
              </p>
            )}
            {task.blockB && (task.blockB.code || task.blockB.url) && (
              <p className="text-xs text-gray-400 mt-1">
                Bloque B: {task.blockB.code} {task.blockB.url && (<a href={task.blockB.url} target="_blank" rel="noopener noreferrer" className="underline">enlace</a>)}
              </p>
            )}
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

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Plus, ClipboardList, MessageSquare, Users2, Pencil, Trash2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { CommentThread } from '@/components/admin/CommentThread';
import { EntityPicker, type EntityPickerOption } from '@/components/admin/EntityPicker';
import { TaskStatusBadge } from '@/components/admin/TaskStatusBadge';
import { SetTaskProgressViewer } from '@/components/admin/SetTaskProgressViewer';
import { TaskDetailModal } from '@/components/admin/TaskDetailModal';
import { Search, Eye } from 'lucide-react';

type TaskType = 'CREATE_PRODUCT' | 'CREATE_SET' | 'UPLOAD_MEDIA' | 'EDIT_PRODUCT' | 'EDIT_SET' | 'GENERIC' | 'SET_PRODUCT_SLOT';
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED';

interface BlockLine {
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
  blockA: BlockLine[] | null;
  blockB: BlockLine[] | null;
  groupId: string | null;
  parentTaskId: string | null;
  status: TaskStatus;
  rejectionReason: string | null;
  createdAt: string;
  assignedTo: string;
  assignedToName: string | null;
  /** Presente solo en el detalle (`GET /api/admin/tasks/[id]`), no en el listado — si el
   * usuario de la sesión puede aprobar/rechazar esta tarea puntual (`canReviewTask`, plan
   * 2026-07-27, decisión 4). El listado usa `isAdmin` como aproximación rápida para no pedir
   * el detalle de cada tarea; la API igual re-valida server-side en cada acción. */
  canReview?: boolean;
}

interface Assignee {
  id: string;
  name: string | null;
  email: string;
}

interface TaskGroup {
  id: string;
  name: string;
  dueDate: string | null;
  hasPayment: boolean;
  paymentAmount: string | null;
  createdAt: string;
  completedAt: string | null;
  createdByName: string | null;
  totalTasks: number;
  approvedTasks: number;
}

// SET_PRODUCT_SLOT deliberadamente fuera de TYPE_LABELS de creación manual — solo se genera
// automáticamente (createTask en task-service.ts), nunca aparece como opción en el Select
// "Tipo" del formulario de creación de tareas.
const TYPE_LABELS: Record<TaskType, string> = {
  CREATE_PRODUCT: 'Crear producto',
  CREATE_SET: 'Crear set',
  UPLOAD_MEDIA: 'Subir medios',
  EDIT_PRODUCT: 'Editar producto',
  EDIT_SET: 'Editar set',
  GENERIC: 'Genérica',
  SET_PRODUCT_SLOT: 'Producto del set',
};

const MANUAL_TASK_TYPES: TaskType[] = ['CREATE_PRODUCT', 'CREATE_SET', 'UPLOAD_MEDIA', 'EDIT_PRODUCT', 'EDIT_SET', 'GENERIC'];

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

const GENDER_OPTIONS = ['Hombre', 'Mujer', 'Unisex'];

const EMPTY_BLOCK: BlockLine[] = [{ code: '', url: '' }, { code: '', url: '' }];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(dueDate: string | null, completedAt: string | null): boolean {
  if (!dueDate || completedAt) return false;
  return new Date(dueDate).getTime() < Date.now();
}

export default function TareasPage() {
  const { data: session } = useSession();
  const { isAdmin } = usePermissions();
  const [tab, setTab] = useState('tareas');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [detailGroup, setDetailGroup] = useState<TaskGroup | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/admin/tasks${qs}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  const loadGroups = useCallback(async () => {
    const res = await fetch('/api/admin/task-groups');
    if (res.ok) setGroups((await res.json()).groups);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const userId = (session?.user as { id?: string } | undefined)?.id;

  async function refreshAll() {
    await Promise.all([loadTasks(), loadGroups()]);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">Tareas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin ? 'Asignación y seguimiento de trabajo del Gestor del Catálogo' : 'Tus tareas asignadas'}
          </p>
        </div>
        {isAdmin && tab === 'tareas' && <CreateTaskDialog groups={groups} onCreated={refreshAll} />}
        {isAdmin && tab === 'grupos' && <CreateGroupDialog onSaved={loadGroups} />}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
          <TabsTrigger value="grupos">Grupos</TabsTrigger>
        </TabsList>

        <TabsContent value="tareas">
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:max-w-xs">
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
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título o código..."
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : tasks.filter((t) => !t.parentTaskId).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No hay tareas para mostrar.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tasks.filter((t) => !t.parentTaskId).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isAdmin={isAdmin}
                  currentUserId={userId}
                  onChanged={refreshAll}
                  subtasks={tasks.filter((t) => t.parentTaskId === task.id)}
                />
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
                <GroupCard key={group.id} group={group} onOpenDetail={() => setDetailGroup(group)} onSaved={loadGroups} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {detailGroup && (
        <GroupDetailDialog
          group={groups.find((g) => g.id === detailGroup.id) ?? detailGroup}
          allGroups={groups}
          onClose={() => setDetailGroup(null)}
          onChanged={refreshAll}
        />
      )}
    </div>
  );
}

function GroupCard({ group, onOpenDetail, onSaved }: { group: TaskGroup; onOpenDetail: () => void; onSaved: () => void }) {
  const pct = group.totalTasks > 0 ? Math.round((group.approvedTasks / group.totalTasks) * 100) : 0;
  const overdue = isOverdue(group.dueDate, group.completedAt);

  return (
    <Card className="cursor-pointer hover:border-gray-300 transition-colors" onClick={onOpenDetail}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="min-w-0">
            <p className="font-medium text-[#111111]">{group.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {group.dueDate && <span className={overdue ? 'text-red-600 font-medium' : ''}>Plazo: {formatDate(group.dueDate)}</span>}
              {group.hasPayment && group.paymentAmount && ` · $${Number(group.paymentAmount).toFixed(2)}`}
              {group.createdByName && ` · Creado por ${group.createdByName}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {overdue && <Badge variant="destructive">Vencido</Badge>}
            {group.completedAt ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-none">Completado</Badge>
            ) : (
              <Badge variant="outline">En progreso</Badge>
            )}
            <EditGroupTrigger group={group} onSaved={onSaved} />
          </div>
        </div>
        <Progress value={pct} className="h-1.5" />
        <p className="text-xs text-gray-500 mt-1.5">{group.approvedTasks}/{group.totalTasks} tareas aprobadas</p>
      </CardContent>
    </Card>
  );
}

function EditGroupTrigger({ group, onSaved }: { group: TaskGroup; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)}>
        <Pencil className="w-4 h-4" />
      </Button>
      <CreateGroupDialog group={group} onSaved={onSaved} controlledOpen={open} onControlledOpenChange={setOpen} hideTrigger />
    </div>
  );
}

function CreateGroupDialog({
  group, onSaved, controlledOpen, onControlledOpenChange, hideTrigger,
}: {
  group?: TaskGroup;
  onSaved: () => void;
  controlledOpen?: boolean;
  onControlledOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const isEditing = !!group;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onControlledOpenChange ?? setUncontrolledOpen;

  const [name, setName] = useState(group?.name ?? '');
  const [dueDate, setDueDate] = useState(group?.dueDate ? group.dueDate.slice(0, 10) : '');
  const [hasPayment, setHasPayment] = useState(group?.hasPayment ?? false);
  const [paymentAmount, setPaymentAmount] = useState(group?.paymentAmount ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? '');
    setDueDate(group?.dueDate ? group.dueDate.slice(0, 10) : '');
    setHasPayment(group?.hasPayment ?? false);
    setPaymentAmount(group?.paymentAmount ?? '');
  }, [open, group]);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error('El nombre del grupo es obligatorio');
      return;
    }
    if (hasPayment && !paymentAmount.trim()) {
      toast.error('El monto es obligatorio si el grupo tiene pago asignado');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name,
        dueDate: dueDate || null,
        hasPayment,
        paymentAmount: hasPayment ? paymentAmount : null,
      };
      const res = await fetch(isEditing ? `/api/admin/task-groups/${group.id}` : '/api/admin/task-groups', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'No se pudo guardar el grupo');
        return;
      }
      toast.success(isEditing ? 'Grupo actualizado' : 'Grupo creado');
      setOpen(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button><Plus className="w-4 h-4 mr-1.5" />Nuevo grupo</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar grupo de tareas' : 'Nuevo grupo de tareas'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nombre del grupo</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='Ej. "Cargar Colección XYZ - Fase 1"' />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Plazo límite (opcional)</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">Fecha límite para terminar las tareas de este grupo — no está relacionada con el pago.</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Asignar pago a este grupo</p>
              <p className="text-xs text-gray-500">Se acredita una sola vez, cuando todas las tareas queden aprobadas.</p>
            </div>
            <Switch checked={hasPayment} onCheckedChange={setHasPayment} />
          </div>
          {hasPayment && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Monto fijo ($)</label>
              <Input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear grupo'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GroupDetailDialog({ group, allGroups, onClose, onChanged }: {
  group: TaskGroup; allGroups: TaskGroup[]; onClose: () => void; onChanged: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = usePermissions();
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/task-groups/${group.id}`);
      if (res.ok) setTasks((await res.json()).tasks);
    } finally {
      setLoading(false);
    }
  }, [group.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleTaskChanged() {
    await Promise.all([load(), onChanged()]);
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[80vw] max-w-[80vw] sm:max-w-[80vw] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{group.name}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">
            {tasks.filter((t) => t.status === 'APPROVED').length}/{tasks.length} tareas aprobadas
          </p>
          {isAdmin && (
            <CreateTaskDialog
              groups={allGroups}
              onCreated={handleTaskChanged}
              fixedGroupId={group.id}
            />
          )}
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : tasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                Sin tareas en este grupo todavía.
              </CardContent>
            </Card>
          ) : (
            tasks.map((task) => (
              <TaskCard key={task.id} task={task} isAdmin={isAdmin} currentUserId={userId} onChanged={handleTaskChanged} />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BlockFieldPair({ label, line, onChange }: {
  label: string;
  line: BlockLine;
  onChange: (next: BlockLine) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <div className="col-span-1">
        <label className="text-xs text-gray-500 mb-1 block">{label} — Código</label>
        <Input value={line.code} onChange={(e) => onChange({ ...line, code: e.target.value })} placeholder="Código" />
      </div>
      <div className="col-span-3">
        <label className="text-xs text-gray-500 mb-1 block">{label} — URL del producto</label>
        <Input value={line.url} onChange={(e) => onChange({ ...line, url: e.target.value })} placeholder="URL del producto" />
      </div>
    </div>
  );
}

function CreateTaskDialog({ groups, onCreated, fixedGroupId }: {
  groups: TaskGroup[]; onCreated: () => void; fixedGroupId?: string;
}) {
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
  const [blockA, setBlockA] = useState<BlockLine[]>(EMPTY_BLOCK);
  const [blockB, setBlockB] = useState<BlockLine[]>(EMPTY_BLOCK);
  const [targetEntityId, setTargetEntityId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string>(fixedGroupId ?? 'none');
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
    setBlockA(EMPTY_BLOCK); setBlockB(EMPTY_BLOCK);
    setTargetEntityId(null); setGroupId(fixedGroupId ?? 'none'); setAssignedTo(''); setType('GENERIC');
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
        const cleanBlock = (b: BlockLine[]) => (b.some((l) => l.code || l.url) ? b : null);
        body.blockA = cleanBlock(blockA);
        body.blockB = cleanBlock(blockB);
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
      <DialogContent className="w-[80vw] max-w-[80vw] sm:max-w-[80vw] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Asignar nueva tarea</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          <div className={(type === 'CREATE_PRODUCT' || type === 'CREATE_SET') ? 'grid grid-cols-3 gap-3' : undefined}>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tipo</label>
              <Select value={type} onValueChange={(v) => { setType(v as TaskType); setTargetEntityId(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MANUAL_TASK_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>{TYPE_LABELS[value]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grupo de tareas y Asignar a se agrupan junto al Tipo en esta misma fila
                solo para CREATE_PRODUCT/CREATE_SET (pedido explícito) — el resto de
                tipos de tarea conserva el layout original más abajo. */}
            {(type === 'CREATE_PRODUCT' || type === 'CREATE_SET') && (
              <>
                {!fixedGroupId && openGroups.length > 0 ? (
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
                ) : <div />}
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
              </>
            )}
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

          {/* CREATE_SET: Título (1/2) + Género (1/4), luego Bloque A (2 líneas) y Bloque B (2 líneas) */}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bloque A (2 productos)</p>
                  <BlockFieldPair label="Producto 1" line={blockA[0]} onChange={(l) => setBlockA([l, blockA[1]])} />
                  <BlockFieldPair label="Producto 2" line={blockA[1]} onChange={(l) => setBlockA([blockA[0], l])} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bloque B (2 productos)</p>
                  <BlockFieldPair label="Producto 1" line={blockB[0]} onChange={(l) => setBlockB([l, blockB[1]])} />
                  <BlockFieldPair label="Producto 2" line={blockB[1]} onChange={(l) => setBlockB([blockB[0], l])} />
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

          {type !== 'CREATE_PRODUCT' && type !== 'CREATE_SET' && (
            <>
              {!fixedGroupId && openGroups.length > 0 && (
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
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando...' : 'Asignar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskCard({ task, isAdmin, currentUserId, onChanged, subtasks }: {
  task: Task; isAdmin: boolean; currentUserId: string | undefined; onChanged: () => void; subtasks?: Task[];
}) {
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [completedDialog, setCompletedDialog] = useState<{ open: boolean; assignedByName: string | null }>({ open: false, assignedByName: null });
  const [showDetail, setShowDetail] = useState(false);
  const isOwner = task.assignedTo === currentUserId;
  const isSetParent = task.type === 'CREATE_SET' && !!subtasks && subtasks.length > 0;

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
      // Diálogo informativo al completar (plan 2026-07-27, decisión 3) — no requiere una
      // acción separada del Gestor para "enviar a revisión", ocurre en el mismo clic.
      if (toStatus === 'COMPLETED') {
        const data = await res.json().catch(() => ({}));
        setCompletedDialog({ open: true, assignedByName: data.task?.assignedByName ?? null });
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tasks/${task.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'No se pudo eliminar la tarea');
        return;
      }
      toast.success('Tarea eliminada');
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
              <TaskStatusBadge status={task.status} className="text-xs" />
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
            {task.blockA && task.blockA.some((l) => l.code || l.url) && (
              <div className="text-xs text-gray-400 mt-1">
                Bloque A: {task.blockA.map((l, i) => (
                  <span key={i} className="mr-2">
                    {l.code}{l.url && <> (<a href={l.url} target="_blank" rel="noopener noreferrer" className="underline">enlace</a>)</>}
                  </span>
                ))}
              </div>
            )}
            {task.blockB && task.blockB.some((l) => l.code || l.url) && (
              <div className="text-xs text-gray-400 mt-1">
                Bloque B: {task.blockB.map((l, i) => (
                  <span key={i} className="mr-2">
                    {l.code}{l.url && <> (<a href={l.url} target="_blank" rel="noopener noreferrer" className="underline">enlace</a>)</>}
                  </span>
                ))}
              </div>
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
            {/* El padre CREATE_SET con piezas no se completa manualmente — se completa
             * automáticamente cuando todas sus piezas están APPROVED (decisión 5 del plan
             * 2026-07-27); su revisión ocurre por pieza en <SetTaskProgressViewer />. */}
            {isOwner && task.status === 'IN_PROGRESS' && !isSetParent && (
              <Button size="sm" disabled={busy} onClick={() => advance('COMPLETED')}>Marcar completada</Button>
            )}
            {isAdmin && task.status === 'COMPLETED' && !isSetParent && (
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
            <Button size="sm" variant="ghost" onClick={() => setShowDetail(true)}>
              <Eye className="w-4 h-4" />
            </Button>
            {/* Eliminar tarea (2026-07-27, feedback de Gustavo): solo Admin/Coordinador —
                `isAdmin` aquí es la misma aproximación de gate visual ya usada para
                Aprobar/Rechazar (deuda conocida: no distingue Coordinador en cliente, ver
                comentario al inicio del archivo); el backend aplica `canReviewTask` real. */}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" disabled={busy} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar tarea</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminará la tarea &quot;{task.title}&quot;{isSetParent ? ' y todas sus piezas del set' : ''}, junto con sus comentarios y notificaciones.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {showComments && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <CommentThread mode="task" taskId={task.id} />
          </div>
        )}

        {subtasks && subtasks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <SetTaskProgressViewer parentTaskId={task.id} canReview={isAdmin} />
          </div>
        )}
      </CardContent>

      <Dialog open={completedDialog.open} onOpenChange={(v) => { if (!v) setCompletedDialog({ open: false, assignedByName: null }); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tarea enviada a revisión</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Tu tarea pasó a revisión de {completedDialog.assignedByName || 'quien te la asignó'}.
          </p>
          <DialogFooter>
            <Button onClick={() => setCompletedDialog({ open: false, assignedByName: null })}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showDetail && (
        <TaskDetailModal taskId={task.id} onClose={() => setShowDetail(false)} onChanged={onChanged} />
      )}
    </Card>
  );
}

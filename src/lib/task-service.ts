// ─── Asignación de tareas (Fase 3 del plan tareas/comentarios/pagos) ───
// Capa de servicio: CRUD de `catalog_tasks` + ciclo de vida (PENDING → IN_PROGRESS →
// COMPLETED → APPROVED, con rama REJECTED que regresa a IN_PROGRESS, decisión 3 del plan).

import { db } from '@/db';
import { catalogTasks, catalogNotifications, catalogActivityLog, users } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { uuid } from '@/lib/uuid';
import { sendEmail } from '@/lib/email';
import { taskAssignedEmail, taskRejectedEmail } from '@/lib/email/templates';

export type CatalogTaskType = 'CREATE_PRODUCT' | 'CREATE_SET' | 'UPLOAD_MEDIA' | 'EDIT_PRODUCT' | 'EDIT_SET' | 'GENERIC';
export type CatalogTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED';

export class InvalidTaskTransitionError extends Error {
  constructor(from: CatalogTaskStatus, to: CatalogTaskStatus) {
    super(`No se puede pasar una tarea de ${from} a ${to}.`);
    this.name = 'InvalidTaskTransitionError';
  }
}

export interface CreateTaskInput {
  type: CatalogTaskType;
  title: string;
  description?: string | null;
  targetCode?: string | null;
  targetEntityType?: 'PRODUCT' | 'SET' | null;
  targetEntityId?: string | null;
  assignedTo: string;
  assignedBy: string;
}

/** Crea una tarea (tipada o genérica, decisión 4 del plan) y notifica al Gestor asignado. */
export async function createTask(input: CreateTaskInput) {
  const [task] = await db
    .insert(catalogTasks)
    .values({
      id: uuid(),
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      targetCode: input.targetCode ?? null,
      targetEntityType: input.targetEntityType ?? null,
      targetEntityId: input.targetEntityId ?? null,
      assignedTo: input.assignedTo,
      assignedBy: input.assignedBy,
      status: 'PENDING',
    })
    .returning();

  await db.insert(catalogNotifications).values({
    id: uuid(),
    userId: input.assignedTo,
    type: 'TASK_ASSIGNED',
    relatedTaskId: task.id,
  });

  // Correo solo en los dos eventos críticos (decisión 11 del plan) — asignación y rechazo.
  // `sendEmail` ya hace fallback silencioso si RESEND_API_KEY no está configurado.
  const [assignee] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, input.assignedTo)).limit(1);
  if (assignee) {
    const { subject, html } = taskAssignedEmail({ assigneeName: assignee.name ?? assignee.email, title: task.title, description: task.description });
    await sendEmail({ to: assignee.email, subject, html });
  }

  return task;
}

export interface TaskListFilters {
  status?: CatalogTaskStatus;
  assignedTo?: string;
  type?: CatalogTaskType;
}

/** Listado con filtros — usado por `/admin/tareas` (Admin ve todas, filtra por Gestor). */
export async function listTasks(filters: TaskListFilters = {}) {
  const conditions = [];
  if (filters.status) conditions.push(eq(catalogTasks.status, filters.status));
  if (filters.assignedTo) conditions.push(eq(catalogTasks.assignedTo, filters.assignedTo));
  if (filters.type) conditions.push(eq(catalogTasks.type, filters.type));

  return db
    .select({
      id: catalogTasks.id,
      type: catalogTasks.type,
      title: catalogTasks.title,
      description: catalogTasks.description,
      targetCode: catalogTasks.targetCode,
      targetEntityType: catalogTasks.targetEntityType,
      targetEntityId: catalogTasks.targetEntityId,
      status: catalogTasks.status,
      rejectionReason: catalogTasks.rejectionReason,
      createdAt: catalogTasks.createdAt,
      updatedAt: catalogTasks.updatedAt,
      completedAt: catalogTasks.completedAt,
      reviewedAt: catalogTasks.reviewedAt,
      assignedTo: catalogTasks.assignedTo,
      assignedToName: users.name,
    })
    .from(catalogTasks)
    .leftJoin(users, eq(catalogTasks.assignedTo, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(catalogTasks.createdAt));
}

export async function getTaskById(id: string) {
  const [task] = await db.select().from(catalogTasks).where(eq(catalogTasks.id, id)).limit(1);
  return task ?? null;
}

const ALLOWED_TRANSITIONS: Record<CatalogTaskStatus, CatalogTaskStatus[]> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: ['IN_PROGRESS'],
};

/** Avance del Gestor: PENDING→IN_PROGRESS, IN_PROGRESS→COMPLETED. */
export async function advanceTaskStatus(taskId: string, toStatus: CatalogTaskStatus) {
  const task = await getTaskById(taskId);
  if (!task) throw new Error('Tarea no encontrada.');
  if (!ALLOWED_TRANSITIONS[task.status as CatalogTaskStatus].includes(toStatus)) {
    throw new InvalidTaskTransitionError(task.status as CatalogTaskStatus, toStatus);
  }

  const patch: Record<string, unknown> = { status: toStatus, updatedAt: new Date() };
  if (toStatus === 'COMPLETED') patch.completedAt = new Date();

  const [updated] = await db.update(catalogTasks).set(patch).where(eq(catalogTasks.id, taskId)).returning();

  await db.insert(catalogNotifications).values({
    id: uuid(),
    userId: task.assignedBy,
    type: 'TASK_STATUS_CHANGED',
    relatedTaskId: taskId,
  });

  return updated;
}

/** Aprobación del Admin (solo sobre tareas COMPLETED) — cierra el ciclo de vida. */
export async function approveTask(taskId: string) {
  const task = await getTaskById(taskId);
  if (!task) throw new Error('Tarea no encontrada.');
  if (task.status !== 'COMPLETED') {
    throw new InvalidTaskTransitionError(task.status as CatalogTaskStatus, 'APPROVED');
  }

  const [updated] = await db
    .update(catalogTasks)
    .set({ status: 'APPROVED', reviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(catalogTasks.id, taskId))
    .returning();

  await db.insert(catalogNotifications).values({
    id: uuid(),
    userId: task.assignedTo,
    type: 'TASK_STATUS_CHANGED',
    relatedTaskId: taskId,
  });

  return updated;
}

/**
 * Rechazo del Admin (solo sobre tareas COMPLETED, motivo obligatorio) — regresa la tarea a
 * IN_PROGRESS (decisión 3 del plan) y anula (sin borrar) toda la actividad de
 * `catalog_activity_log` vinculada a esta tarea (decisión 7 del plan, Fase 6: un ítem
 * rechazado no cuenta para el cálculo de pagos, pero queda visible en el historial).
 */
export async function rejectTask(taskId: string, reason: string) {
  const task = await getTaskById(taskId);
  if (!task) throw new Error('Tarea no encontrada.');
  if (task.status !== 'COMPLETED') {
    throw new InvalidTaskTransitionError(task.status as CatalogTaskStatus, 'REJECTED');
  }

  const [updated] = await db
    .update(catalogTasks)
    .set({ status: 'IN_PROGRESS', rejectionReason: reason, reviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(catalogTasks.id, taskId))
    .returning();

  await db.update(catalogActivityLog).set({ voidedByRejection: true }).where(eq(catalogActivityLog.taskId, taskId));

  await db.insert(catalogNotifications).values({
    id: uuid(),
    userId: task.assignedTo,
    type: 'TASK_REJECTED',
    relatedTaskId: taskId,
  });

  const [assignee] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, task.assignedTo)).limit(1);
  if (assignee) {
    const { subject, html } = taskRejectedEmail({ assigneeName: assignee.name ?? assignee.email, title: task.title, reason });
    await sendEmail({ to: assignee.email, subject, html });
  }

  return updated;
}

/** Conteo de tareas por estado, para badges de la vista del Gestor. */
export async function countTasksForUser(userId: string) {
  const rows = await db
    .select({ status: catalogTasks.status, count: sql<number>`count(*)::int` })
    .from(catalogTasks)
    .where(eq(catalogTasks.assignedTo, userId))
    .groupBy(catalogTasks.status);

  return Object.fromEntries(rows.map((r) => [r.status, r.count])) as Partial<Record<CatalogTaskStatus, number>>;
}

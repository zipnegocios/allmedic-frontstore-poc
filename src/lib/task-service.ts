// ─── Asignación de tareas (Fase 3 del plan tareas/comentarios/pagos) ───
// Capa de servicio: CRUD de `catalog_tasks` + ciclo de vida (PENDING → IN_PROGRESS →
// COMPLETED → APPROVED, con rama REJECTED que regresa a IN_PROGRESS, decisión 3 del plan).

import { db } from '@/db';
import { catalogTasks, catalogTaskGroups, catalogNotifications, catalogActivityLog, users, corporateSets } from '@/db/schema';
import { eq, and, ne, desc, sql, ilike, or } from 'drizzle-orm';
import { uuid } from '@/lib/uuid';
import { sendEmail } from '@/lib/email';
import { taskAssignedEmail, taskCompletedEmail, taskRejectedEmail } from '@/lib/email/templates';

export type CatalogTaskType = 'CREATE_PRODUCT' | 'CREATE_SET' | 'UPLOAD_MEDIA' | 'EDIT_PRODUCT' | 'EDIT_SET' | 'GENERIC' | 'SET_PRODUCT_SLOT';
export type CatalogTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED';

export class InvalidTaskTransitionError extends Error {
  constructor(from: CatalogTaskStatus, to: CatalogTaskStatus) {
    super(`No se puede pasar una tarea de ${from} a ${to}.`);
    this.name = 'InvalidTaskTransitionError';
  }
}

export class TaskGroupAssigneeMismatchError extends Error {
  constructor() {
    super('Todas las tareas de un grupo deben asignarse al mismo Gestor.');
    this.name = 'TaskGroupAssigneeMismatchError';
  }
}

export class TaskGroupCompletedError extends Error {
  constructor() {
    super('No se pueden agregar tareas a un grupo ya completado.');
    this.name = 'TaskGroupCompletedError';
  }
}

export class ForbiddenReviewError extends Error {
  constructor() {
    super('No tienes permiso para revisar esta tarea.');
    this.name = 'ForbiddenReviewError';
  }
}

export interface CreateTaskInput {
  type: CatalogTaskType;
  title: string;
  description?: string | null;
  targetCode?: string | null;
  targetEntityType?: 'PRODUCT' | 'SET' | null;
  targetEntityId?: string | null;
  gender?: string | null;
  sourceUrl?: string | null;
  blockA?: Array<{ code: string; url: string }> | null;
  blockB?: Array<{ code: string; url: string }> | null;
  groupId?: string | null;
  /** Tarea CREATE_SET que generó esta subtarea SET_PRODUCT_SLOT (2026-07-26) — solo aplica
   * a ese tipo, generado automáticamente por `createTask`, nunca pasado manualmente desde UI. */
  parentTaskId?: string | null;
  assignedTo: string;
  assignedBy: string;
}

/**
 * Autorización de finalización de una tarea (plan 2026-07-27, decisión 4) — función pura, sin
 * acceso a BD, para poder testearla aislada y para que las API routes la llamen explícitamente
 * antes de cualquier `update` (no basta con ocultar el botón en cliente):
 * - Admin siempre puede revisar cualquier tarea, sin excepción.
 * - Si quien asignó (`assignedBy`) es Admin, solo Admin puede revisar (ningún Coordinador).
 * - Si quien asignó es un Coordinador, cualquier Coordinador puede revisar (no exclusivamente
 *   quien la asignó) — igual capacidad que Admin dentro del módulo de Tareas.
 */
export function canReviewTask(
  currentUser: { id: string; role: string; isTaskCoordinator: boolean },
  assignerRole: string
): boolean {
  if (currentUser.role === 'ADMIN') return true;
  if (assignerRole === 'ADMIN') return false;
  return currentUser.isTaskCoordinator;
}

/** Nombre de cada línea de bloque, en el orden fijo en que se generan las subtareas
 * SET_PRODUCT_SLOT — Bloque A tiene 2 líneas, Bloque B tiene 2 líneas (decisión del plan de
 * mejoras al panel de tareas: cada bloque relaciona 2 productos). */
const SLOT_LABELS = ['Bloque A, producto 1', 'Bloque A, producto 2', 'Bloque B, producto 1', 'Bloque B, producto 2'] as const;

/** Crea una tarea (tipada o genérica, decisión 4 del plan) y notifica al Gestor asignado.
 * Si `groupId` viene informado, valida el invariante "un grupo = un solo Gestor" (todas las
 * tareas de un grupo deben compartir `assignedTo`) y que el grupo no esté ya completado.
 *
 * Si `type === 'CREATE_SET'` y vienen líneas de Bloque A/B, genera automáticamente 4
 * subtareas `SET_PRODUCT_SLOT` (una por línea) dentro de la misma transacción —
 * `parentTaskId` apunta a esta tarea, mismo `assignedTo`/`assignedBy`, sin notificación ni
 * correo propios (evita spam: el Gestor ya recibe la notificación de la tarea padre). No
 * cuentan como CREATE_PRODUCT real — son un medio para trabajar el armado del set pieza por
 * pieza (feature de anclaje de tareas, 2026-07-26). */
export async function createTask(input: CreateTaskInput) {
  if (input.groupId) {
    const [group] = await db.select().from(catalogTaskGroups).where(eq(catalogTaskGroups.id, input.groupId)).limit(1);
    if (group?.completedAt) throw new TaskGroupCompletedError();

    const [mismatched] = await db
      .select({ id: catalogTasks.id })
      .from(catalogTasks)
      .where(and(eq(catalogTasks.groupId, input.groupId), ne(catalogTasks.assignedTo, input.assignedTo)))
      .limit(1);
    if (mismatched) throw new TaskGroupAssigneeMismatchError();
  }

  const task = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(catalogTasks)
      .values({
        id: uuid(),
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        targetCode: input.targetCode ?? null,
        targetEntityType: input.targetEntityType ?? null,
        targetEntityId: input.targetEntityId ?? null,
        gender: input.gender ?? null,
        sourceUrl: input.sourceUrl ?? null,
        blockA: input.blockA ?? null,
        blockB: input.blockB ?? null,
        groupId: input.groupId ?? null,
        assignedTo: input.assignedTo,
        assignedBy: input.assignedBy,
        status: 'PENDING',
      })
      .returning();

    if (input.type === 'CREATE_SET') {
      const lines = [...(input.blockA ?? []), ...(input.blockB ?? [])].filter((l) => l.code || l.url);
      if (lines.length > 0) {
        await tx.insert(catalogTasks).values(
          lines.map((line, index) => {
            const slotLabel = SLOT_LABELS[index] ?? `Producto ${index + 1}`;
            const codeSuffix = line.code ? ` (${line.code})` : '';
            return {
              id: uuid(),
              type: 'SET_PRODUCT_SLOT' as const,
              title: `${inserted.title} — ${slotLabel}${codeSuffix}`,
              targetCode: line.code || null,
              sourceUrl: line.url || null,
              parentTaskId: inserted.id,
              assignedTo: input.assignedTo,
              assignedBy: input.assignedBy,
              status: 'PENDING' as const,
            };
          })
        );
      }
    }

    return inserted;
  });

  await db.insert(catalogNotifications).values({
    id: uuid(),
    userId: input.assignedTo,
    type: 'TASK_ASSIGNED',
    relatedTaskId: task.id,
  });

  // Correo controlable individualmente desde el panel de correos (`/admin/configuracion`).
  // `sendEmail` ya hace fallback silencioso si RESEND_API_KEY no está configurado o si el
  // evento fue desactivado.
  const [assignee] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, input.assignedTo)).limit(1);
  if (assignee) {
    const { subject, html } = taskAssignedEmail({ assigneeName: assignee.name ?? assignee.email, title: task.title, description: task.description });
    await sendEmail({ to: assignee.email, subject, html, eventKey: 'TASK_ASSIGNED' });
  }

  return task;
}

/** Subtareas SET_PRODUCT_SLOT de una tarea CREATE_SET — usado para anidarlas visualmente
 * bajo la tarjeta de la tarea padre en `/admin/tareas` y en `<SetTaskProgressViewer />`. */
export async function listSubtasks(parentTaskId: string) {
  return db
    .select({
      id: catalogTasks.id,
      title: catalogTasks.title,
      status: catalogTasks.status,
      targetCode: catalogTasks.targetCode,
      sourceUrl: catalogTasks.sourceUrl,
      targetEntityId: catalogTasks.targetEntityId,
      assignedToName: users.name,
    })
    .from(catalogTasks)
    .leftJoin(users, eq(catalogTasks.assignedTo, users.id))
    .where(eq(catalogTasks.parentTaskId, parentTaskId));
}

export interface TaskListFilters {
  status?: CatalogTaskStatus;
  assignedTo?: string;
  type?: CatalogTaskType;
  groupId?: string;
  /** Buscador de texto libre (plan 2026-07-27, decisión 10) — solo sobre `title` y
   * `targetCode`, sin nombre de Gestor asignado ("la protagonista es la tarea"). */
  search?: string;
}

/** Listado con filtros — usado por `/admin/tareas` (Admin ve todas, filtra por Gestor). */
export async function listTasks(filters: TaskListFilters = {}) {
  const conditions = [];
  if (filters.status) conditions.push(eq(catalogTasks.status, filters.status));
  if (filters.assignedTo) conditions.push(eq(catalogTasks.assignedTo, filters.assignedTo));
  if (filters.type) conditions.push(eq(catalogTasks.type, filters.type));
  if (filters.groupId) conditions.push(eq(catalogTasks.groupId, filters.groupId));
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(or(ilike(catalogTasks.title, term), ilike(catalogTasks.targetCode, term)));
  }

  return db
    .select({
      id: catalogTasks.id,
      type: catalogTasks.type,
      title: catalogTasks.title,
      description: catalogTasks.description,
      targetCode: catalogTasks.targetCode,
      targetEntityType: catalogTasks.targetEntityType,
      targetEntityId: catalogTasks.targetEntityId,
      gender: catalogTasks.gender,
      sourceUrl: catalogTasks.sourceUrl,
      blockA: catalogTasks.blockA,
      blockB: catalogTasks.blockB,
      groupId: catalogTasks.groupId,
      parentTaskId: catalogTasks.parentTaskId,
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

/** Detalle completo para `<TaskDetailModal />` (plan 2026-07-27, decisión 8) — incluye
 * `assignedByName` (para el diálogo "pasó a revisión de X", decisión 3) y `canReview`
 * (si el usuario que pide el detalle puede aprobar/rechazar esta tarea puntual, decisión 4). */
export async function getTaskDetail(id: string, currentUserId: string) {
  const [row] = await db
    .select({
      id: catalogTasks.id,
      type: catalogTasks.type,
      title: catalogTasks.title,
      description: catalogTasks.description,
      targetCode: catalogTasks.targetCode,
      targetEntityType: catalogTasks.targetEntityType,
      targetEntityId: catalogTasks.targetEntityId,
      gender: catalogTasks.gender,
      sourceUrl: catalogTasks.sourceUrl,
      blockA: catalogTasks.blockA,
      blockB: catalogTasks.blockB,
      groupId: catalogTasks.groupId,
      parentTaskId: catalogTasks.parentTaskId,
      status: catalogTasks.status,
      rejectionReason: catalogTasks.rejectionReason,
      createdAt: catalogTasks.createdAt,
      updatedAt: catalogTasks.updatedAt,
      completedAt: catalogTasks.completedAt,
      reviewedAt: catalogTasks.reviewedAt,
      assignedTo: catalogTasks.assignedTo,
      assignedBy: catalogTasks.assignedBy,
    })
    .from(catalogTasks)
    .where(eq(catalogTasks.id, id))
    .limit(1);
  if (!row) return null;

  const [assignee, assigner, currentUser] = await Promise.all([
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, row.assignedTo)).limit(1),
    db.select({ name: users.name, email: users.email, role: users.role }).from(users).where(eq(users.id, row.assignedBy)).limit(1),
    getReviewIdentity(currentUserId),
  ]);

  const canReview = row.status === 'COMPLETED' && canReviewTask(
    { id: currentUserId, role: currentUser.role, isTaskCoordinator: currentUser.isTaskCoordinator },
    assigner[0]?.role ?? ''
  );

  return {
    ...row,
    assignedToName: assignee[0]?.name ?? assignee[0]?.email ?? null,
    assignedByName: assigner[0]?.name ?? assigner[0]?.email ?? null,
    canReview,
  };
}

export async function getTaskById(id: string) {
  const [task] = await db.select().from(catalogTasks).where(eq(catalogTasks.id, id)).limit(1);
  return task ?? null;
}

const ALLOWED_TRANSITIONS: Record<CatalogTaskStatus, CatalogTaskStatus[]> = {
  // PENDING→COMPLETED directo (sin pasar por IN_PROGRESS) ocurre cuando el Gestor ancla una
  // tarea recién creada y usa "Guardar y completar tarea" en el primer guardado — el flujo
  // normal del formulario, no un caso excepcional.
  PENDING: ['IN_PROGRESS', 'COMPLETED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: ['IN_PROGRESS'],
};

/** Avance del Gestor: PENDING→IN_PROGRESS, IN_PROGRESS→COMPLETED. Al completar, notifica por
 * correo al Admin que asignó la tarea (evento `TASK_COMPLETED`, controlable individualmente).
 * `targetEntityId` opcional (feature de anclaje de tareas, 2026-07-26): cuando el Gestor
 * completa una tarea/subtarea anclada desde el formulario de Producto/Set, se guarda en el
 * mismo request el id de la entidad recién creada/editada — evita una segunda llamada. */
export async function advanceTaskStatus(taskId: string, toStatus: CatalogTaskStatus, targetEntityId?: string | null) {
  const task = await getTaskById(taskId);
  if (!task) throw new Error('Tarea no encontrada.');
  if (!ALLOWED_TRANSITIONS[task.status as CatalogTaskStatus].includes(toStatus)) {
    throw new InvalidTaskTransitionError(task.status as CatalogTaskStatus, toStatus);
  }

  const patch: Record<string, unknown> = { status: toStatus, updatedAt: new Date() };
  if (toStatus === 'COMPLETED') patch.completedAt = new Date();
  if (targetEntityId) patch.targetEntityId = targetEntityId;

  const [updated] = await db.update(catalogTasks).set(patch).where(eq(catalogTasks.id, taskId)).returning();

  await db.insert(catalogNotifications).values({
    id: uuid(),
    userId: task.assignedBy,
    type: 'TASK_STATUS_CHANGED',
    relatedTaskId: taskId,
  });

  // `assignedByName` viaja en la respuesta cuando se completa (plan 2026-07-27, decisión 3) —
  // el frontend arma el diálogo "Tu tarea pasó a revisión de [nombre]" sin una segunda llamada.
  let assignedByName: string | null = null;
  if (toStatus === 'COMPLETED') {
    const [reviewer] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, task.assignedBy)).limit(1);
    const [assignee] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, task.assignedTo)).limit(1);
    if (reviewer) assignedByName = reviewer.name ?? reviewer.email;
    if (reviewer && assignee) {
      const { subject, html } = taskCompletedEmail({
        reviewerName: reviewer.name ?? reviewer.email,
        assigneeName: assignee.name ?? assignee.email,
        title: task.title,
      });
      await sendEmail({ to: reviewer.email, subject, html, eventKey: 'TASK_COMPLETED' });
    }
  }

  return { ...updated, assignedByName };
}

/** Resuelve el rol y flag Coordinador de un usuario — usado para aplicar `canReviewTask`
 * dentro del servicio (las API routes ya resuelven `currentUser` desde la sesión, pero
 * `assignerRole` requiere una consulta aparte porque `assignedBy` no viaja en la sesión). */
async function getReviewIdentity(userId: string) {
  const [row] = await db.select({ role: users.role, isTaskCoordinator: users.isTaskCoordinator }).from(users).where(eq(users.id, userId)).limit(1);
  return row ?? { role: '', isTaskCoordinator: false };
}

/**
 * Si `taskId` es una subtarea `SET_PRODUCT_SLOT` (o la propia tarea `CREATE_SET`) y, tras esta
 * aprobación, TODAS las piezas hijas de su padre están `APPROVED`, marca automáticamente el
 * padre como `APPROVED` (decisión 5 del plan 2026-07-27 — sin paso de revisión adicional sobre
 * el conjunto armado) y publica el set vinculado (`targetEntityId` del padre) pasando su
 * `status` de `DRAFT` a `PUBLISHED` (decisión 6) — no toca sets que ya nacieron `PUBLISHED`
 * (creados fuera del flujo de tareas).
 */
async function publishSetIfGroupApproved(approvedTask: { id: string; parentTaskId: string | null; type: string }) {
  const parentId = approvedTask.type === 'SET_PRODUCT_SLOT' ? approvedTask.parentTaskId : approvedTask.id;
  if (!parentId) return;

  const siblings = await db.select({ status: catalogTasks.status }).from(catalogTasks).where(eq(catalogTasks.parentTaskId, parentId));
  if (siblings.length === 0) return;
  if (!siblings.every((s) => s.status === 'APPROVED')) return;

  const [parent] = await db
    .update(catalogTasks)
    .set({ status: 'APPROVED', reviewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(catalogTasks.id, parentId), eq(catalogTasks.status, 'COMPLETED')))
    .returning();
  if (!parent) return;

  if (parent.targetEntityId) {
    await db.update(corporateSets).set({ status: 'PUBLISHED', updatedAt: new Date() }).where(eq(corporateSets.id, parent.targetEntityId));
  }
}

/** Aprobación (solo sobre tareas COMPLETED) — cierra el ciclo de vida. Requiere `reviewerId`
 * (usuario de la sesión) para aplicar `canReviewTask` (plan 2026-07-27, decisión 4): Admin
 * siempre puede; si `assignedBy` es Coordinador, cualquier Coordinador puede; si `assignedBy`
 * es Admin, solo Admin puede. Si la tarea pertenece a un grupo y esta aprobación deja TODAS sus
 * tareas en APPROVED, marca el grupo como completado (`completedAt`) — esto es lo que activa la
 * elegibilidad del grupo para el tabulador fijo en el próximo recálculo de período. Si la tarea
 * es una pieza de set (`SET_PRODUCT_SLOT`) o el propio `CREATE_SET`, además intenta publicar el
 * set padre vía `publishSetIfGroupApproved`. */
export async function approveTask(taskId: string, reviewerId: string) {
  const task = await getTaskById(taskId);
  if (!task) throw new Error('Tarea no encontrada.');
  if (task.status !== 'COMPLETED') {
    throw new InvalidTaskTransitionError(task.status as CatalogTaskStatus, 'APPROVED');
  }

  const [reviewer, assigner] = await Promise.all([getReviewIdentity(reviewerId), getReviewIdentity(task.assignedBy)]);
  if (!canReviewTask({ id: reviewerId, role: reviewer.role, isTaskCoordinator: reviewer.isTaskCoordinator }, assigner.role)) {
    throw new ForbiddenReviewError();
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

  if (task.groupId) {
    const groupTasks = await db.select({ status: catalogTasks.status }).from(catalogTasks).where(eq(catalogTasks.groupId, task.groupId));
    const allApproved = groupTasks.length > 0 && groupTasks.every((t) => t.status === 'APPROVED');
    if (allApproved) {
      await db.update(catalogTaskGroups).set({ completedAt: new Date() }).where(eq(catalogTaskGroups.id, task.groupId));
    }
  }

  await publishSetIfGroupApproved(updated);

  return updated;
}

/**
 * Rechazo (solo sobre tareas COMPLETED, motivo obligatorio) — regresa la tarea a IN_PROGRESS
 * (decisión 3 del plan) y anula (sin borrar) toda la actividad de `catalog_activity_log`
 * vinculada a esta tarea (decisión 7 del plan, Fase 6: un ítem rechazado no cuenta para el
 * cálculo de pagos, pero queda visible en el historial). Requiere `reviewerId` para aplicar
 * `canReviewTask` (plan 2026-07-27, decisión 4) — misma regla que `approveTask`. Al rechazar
 * una pieza de set (`SET_PRODUCT_SLOT`), las demás piezas y el padre no se alteran (decisión 5:
 * "corregir" es por pieza).
 */
export async function rejectTask(taskId: string, reason: string, reviewerId: string) {
  const task = await getTaskById(taskId);
  if (!task) throw new Error('Tarea no encontrada.');
  if (task.status !== 'COMPLETED') {
    throw new InvalidTaskTransitionError(task.status as CatalogTaskStatus, 'REJECTED');
  }

  const [reviewer, assigner] = await Promise.all([getReviewIdentity(reviewerId), getReviewIdentity(task.assignedBy)]);
  if (!canReviewTask({ id: reviewerId, role: reviewer.role, isTaskCoordinator: reviewer.isTaskCoordinator }, assigner.role)) {
    throw new ForbiddenReviewError();
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
    await sendEmail({ to: assignee.email, subject, html, eventKey: 'TASK_REJECTED' });
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

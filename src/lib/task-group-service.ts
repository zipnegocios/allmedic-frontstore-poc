// ─── Grupos de tareas + tabulador fijo por metas (2026-07-26) ───
// Capa de servicio: CRUD de `catalog_task_groups`. El cálculo/pago vive en
// `@/lib/productivity-rates` (calculateFixedGroupAmount) — este archivo solo gestiona el
// grupo en sí (crear, listar, editar mientras no esté completado).

import { db } from '@/db';
import { catalogTaskGroups, catalogTasks, users } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { uuid } from '@/lib/uuid';

export type PaymentCadence = 'DAY' | 'WEEK' | 'MONTH';

export class TaskGroupCompletedError extends Error {
  constructor() {
    super('No se puede editar un grupo ya completado.');
    this.name = 'TaskGroupCompletedError';
  }
}

export interface CreateTaskGroupInput {
  name: string;
  paymentAmount: string;
  paymentCadence: PaymentCadence;
  createdBy: string;
}

export async function createTaskGroup(input: CreateTaskGroupInput) {
  const [group] = await db
    .insert(catalogTaskGroups)
    .values({
      id: uuid(),
      name: input.name,
      paymentAmount: input.paymentAmount,
      paymentCadence: input.paymentCadence,
      createdBy: input.createdBy,
    })
    .returning();
  return group;
}

/** Lista grupos con conteo de tareas totales/aprobadas — para el progreso visual (X/Y). */
export async function listTaskGroups() {
  const groups = await db
    .select({
      id: catalogTaskGroups.id,
      name: catalogTaskGroups.name,
      paymentAmount: catalogTaskGroups.paymentAmount,
      paymentCadence: catalogTaskGroups.paymentCadence,
      createdAt: catalogTaskGroups.createdAt,
      completedAt: catalogTaskGroups.completedAt,
      createdByName: users.name,
    })
    .from(catalogTaskGroups)
    .leftJoin(users, eq(catalogTaskGroups.createdBy, users.id))
    .orderBy(desc(catalogTaskGroups.createdAt));

  const counts = await db
    .select({
      groupId: catalogTasks.groupId,
      total: sql<number>`count(*)::int`,
      approved: sql<number>`count(*) filter (where ${catalogTasks.status} = 'APPROVED')::int`,
    })
    .from(catalogTasks)
    .groupBy(catalogTasks.groupId);

  const countsByGroup = new Map(counts.filter((c) => c.groupId).map((c) => [c.groupId as string, c]));

  return groups.map((group) => ({
    ...group,
    totalTasks: countsByGroup.get(group.id)?.total ?? 0,
    approvedTasks: countsByGroup.get(group.id)?.approved ?? 0,
  }));
}

export async function getTaskGroupById(id: string) {
  const [group] = await db.select().from(catalogTaskGroups).where(eq(catalogTaskGroups.id, id)).limit(1);
  return group ?? null;
}

export interface UpdateTaskGroupInput {
  name?: string;
  paymentAmount?: string;
  paymentCadence?: PaymentCadence;
}

/** Edita nombre/monto/cadencia — solo permitido mientras el grupo no esté completado
 * (invariante: un grupo completado es inmutable, mismo criterio que un payment_period PAID). */
export async function updateTaskGroup(id: string, input: UpdateTaskGroupInput) {
  const group = await getTaskGroupById(id);
  if (!group) return null;
  if (group.completedAt) throw new TaskGroupCompletedError();

  const [updated] = await db.update(catalogTaskGroups).set(input).where(eq(catalogTaskGroups.id, id)).returning();
  return updated;
}

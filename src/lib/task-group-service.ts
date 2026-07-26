// ─── Grupos de tareas (2026-07-26) ───
// Capa de servicio: CRUD de `catalog_task_groups`. El cálculo/pago (solo si `hasPayment`)
// vive en `@/lib/productivity-rates` (calculateFixedGroupAmount) — este archivo solo
// gestiona el grupo en sí (crear, listar, editar). Los grupos son siempre editables, incluso
// después de completarse.

import { db } from '@/db';
import { catalogTaskGroups, catalogTasks, users } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { uuid } from '@/lib/uuid';

export interface CreateTaskGroupInput {
  name: string;
  dueDate?: Date | null;
  hasPayment: boolean;
  paymentAmount?: string | null;
  createdBy: string;
}

export async function createTaskGroup(input: CreateTaskGroupInput) {
  const [group] = await db
    .insert(catalogTaskGroups)
    .values({
      id: uuid(),
      name: input.name,
      dueDate: input.dueDate ?? null,
      hasPayment: input.hasPayment,
      paymentAmount: input.hasPayment ? (input.paymentAmount ?? null) : null,
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
      dueDate: catalogTaskGroups.dueDate,
      hasPayment: catalogTaskGroups.hasPayment,
      paymentAmount: catalogTaskGroups.paymentAmount,
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
  dueDate?: Date | null;
  hasPayment?: boolean;
  paymentAmount?: string | null;
}

/** Edita nombre/plazo/pago — siempre permitido, sin importar si el grupo ya está completado
 * (decisión del usuario: los grupos quedan siempre editables). */
export async function updateTaskGroup(id: string, input: UpdateTaskGroupInput) {
  const group = await getTaskGroupById(id);
  if (!group) return null;

  const patch: Record<string, unknown> = { ...input };
  // Si se desactiva el pago, limpia el monto para no dejar un valor huérfano.
  if (input.hasPayment === false) patch.paymentAmount = null;

  const [updated] = await db.update(catalogTaskGroups).set(patch).where(eq(catalogTaskGroups.id, id)).returning();
  return updated;
}

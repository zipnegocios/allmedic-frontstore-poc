// ─── Comentarios: dos hilos independientes (Fase 4 del plan tareas/comentarios/pagos) ───
// `catalog_task_comments` (atado a una tarea) y `catalog_entity_comments` (atado a
// entityType+entityId, sin relación con tareas) — un comentario pertenece a exactamente
// uno de los dos hilos (decisión 2 del plan).

import { db } from '@/db';
import { catalogTaskComments, catalogEntityComments, catalogTasks, catalogNotifications, users } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { uuid } from '@/lib/uuid';

export type CommentEntityType = 'PRODUCT' | 'VARIANT' | 'SET' | 'MEDIA';

export async function listTaskComments(taskId: string) {
  return db
    .select({
      id: catalogTaskComments.id,
      body: catalogTaskComments.body,
      createdAt: catalogTaskComments.createdAt,
      authorId: catalogTaskComments.authorId,
      authorName: users.name,
    })
    .from(catalogTaskComments)
    .leftJoin(users, eq(catalogTaskComments.authorId, users.id))
    .where(eq(catalogTaskComments.taskId, taskId))
    .orderBy(asc(catalogTaskComments.createdAt));
}

/**
 * Crea un comentario de tarea y notifica al "otro participante" de la conversación: si
 * comenta el Gestor, notifica al Admin que asignó la tarea, y viceversa (decisión de Fase 4
 * — no a todos los Admins, solo al asignador, salvo que se decida ampliarlo después).
 */
export async function createTaskComment(taskId: string, authorId: string, body: string) {
  const [task] = await db.select().from(catalogTasks).where(eq(catalogTasks.id, taskId)).limit(1);
  if (!task) throw new Error('Tarea no encontrada.');

  const [comment] = await db
    .insert(catalogTaskComments)
    .values({ id: uuid(), taskId, authorId, body })
    .returning();

  const otherParticipant = authorId === task.assignedTo ? task.assignedBy : task.assignedTo;
  if (otherParticipant && otherParticipant !== authorId) {
    await db.insert(catalogNotifications).values({
      id: uuid(),
      userId: otherParticipant,
      type: 'TASK_COMMENT',
      relatedTaskId: taskId,
      relatedCommentId: comment.id,
    });
  }

  return comment;
}

export async function listEntityComments(entityType: CommentEntityType, entityId: string) {
  return db
    .select({
      id: catalogEntityComments.id,
      body: catalogEntityComments.body,
      createdAt: catalogEntityComments.createdAt,
      authorId: catalogEntityComments.authorId,
      authorName: users.name,
    })
    .from(catalogEntityComments)
    .leftJoin(users, eq(catalogEntityComments.authorId, users.id))
    .where(and(eq(catalogEntityComments.entityType, entityType), eq(catalogEntityComments.entityId, entityId)))
    .orderBy(asc(catalogEntityComments.createdAt));
}

/**
 * Crea un comentario de entidad (producto/set) — sin tarea de por medio. La notificación
 * de "otro participante" no aplica de la misma forma que en tareas (no hay asignador fijo):
 * se notifica a todos los Admin si comenta un Gestor, y al autor original de comentarios
 * previos si comenta un Admin — implementación simple: notifica a los demás autores previos
 * del mismo hilo, evitando notificarse a sí mismo.
 */
export async function createEntityComment(
  entityType: CommentEntityType,
  entityId: string,
  authorId: string,
  body: string
) {
  const [comment] = await db
    .insert(catalogEntityComments)
    .values({ id: uuid(), entityType, entityId, authorId, body })
    .returning();

  const previousAuthors = await db
    .selectDistinct({ authorId: catalogEntityComments.authorId })
    .from(catalogEntityComments)
    .where(and(eq(catalogEntityComments.entityType, entityType), eq(catalogEntityComments.entityId, entityId)));

  const recipients = previousAuthors.map((p) => p.authorId).filter((id) => id !== authorId);
  for (const recipientId of recipients) {
    await db.insert(catalogNotifications).values({
      id: uuid(),
      userId: recipientId,
      type: 'ENTITY_COMMENT',
      relatedCommentId: comment.id,
    });
  }

  return comment;
}

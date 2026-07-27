// ─── Comentarios: dos hilos independientes (Fase 4 del plan tareas/comentarios/pagos) ───
// `catalog_task_comments` (atado a una tarea) y `catalog_entity_comments` (atado a
// entityType+entityId, sin relación con tareas) — un comentario pertenece a exactamente
// uno de los dos hilos (decisión 2 del plan).

import { db } from '@/db';
import { catalogTaskComments, catalogEntityComments, catalogTasks, catalogNotifications, users } from '@/db/schema';
import { eq, and, inArray, asc } from 'drizzle-orm';
import { uuid } from '@/lib/uuid';
import { sendEmail } from '@/lib/email';
import { mentionEmail } from '@/lib/email/templates';

export type CommentEntityType = 'PRODUCT' | 'VARIANT' | 'SET' | 'MEDIA';

/**
 * Notifica (badge + correo, evento `COMMENT_MENTION`) a cada usuario mencionado con @ en un
 * comentario (2026-07-27) — el frontend ya resuelve los ids reales desde el autocompletado
 * (sin ambigüedad de nombres repetidos), esta función no vuelve a parsear el texto. Se
 * inserta siempre una notificación `MENTION` por destinatario, aunque ya haya recibido otra
 * notificación (`TASK_COMMENT`/`ENTITY_COMMENT`) por el mismo comentario — son eventos
 * conceptualmente distintos ("hay actividad en el hilo" vs. "te mencionaron a ti").
 */
async function notifyMentions(params: {
  mentionedUserIds: string[];
  authorId: string;
  commentId: string;
  commentBody: string;
  relatedTaskId?: string;
  contextLabel: string;
}) {
  const { mentionedUserIds, authorId, commentId, commentBody, relatedTaskId, contextLabel } = params;
  const uniqueIds = [...new Set(mentionedUserIds)].filter((id) => id !== authorId);
  if (uniqueIds.length === 0) return;

  const [author, mentioned] = await Promise.all([
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, authorId)).limit(1),
    db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, uniqueIds)),
  ]);
  const authorName = author[0]?.name ?? author[0]?.email ?? 'Alguien';
  const excerpt = commentBody.length > 160 ? `${commentBody.slice(0, 160)}…` : commentBody;

  for (const user of mentioned) {
    await db.insert(catalogNotifications).values({
      id: uuid(),
      userId: user.id,
      type: 'MENTION',
      relatedTaskId: relatedTaskId ?? null,
      relatedCommentId: commentId,
    });

    const { subject, html } = mentionEmail({
      mentionedName: user.name ?? user.email,
      authorName,
      commentExcerpt: excerpt,
      contextLabel,
    });
    await sendEmail({ to: user.email, subject, html, eventKey: 'COMMENT_MENTION' });
  }
}

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
export async function createTaskComment(
  taskId: string,
  authorId: string,
  body: string,
  mentionedUserIds: string[] = []
) {
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

  await notifyMentions({
    mentionedUserIds,
    authorId,
    commentId: comment.id,
    commentBody: body,
    relatedTaskId: taskId,
    contextLabel: `la tarea "${task.title}"`,
  });

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
const ENTITY_TYPE_LABELS: Record<CommentEntityType, string> = {
  PRODUCT: 'un producto',
  VARIANT: 'una variante',
  SET: 'un set',
  MEDIA: 'un medio',
};

export async function createEntityComment(
  entityType: CommentEntityType,
  entityId: string,
  authorId: string,
  body: string,
  mentionedUserIds: string[] = []
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

  await notifyMentions({
    mentionedUserIds,
    authorId,
    commentId: comment.id,
    commentBody: body,
    contextLabel: ENTITY_TYPE_LABELS[entityType],
  });

  return comment;
}

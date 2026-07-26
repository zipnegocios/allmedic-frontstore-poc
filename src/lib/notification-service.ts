// ─── Notificaciones — badges del panel (Fase 8 del plan tareas/comentarios/pagos) ───
// Conteo de no leídas para tareas asignadas/rechazadas/en revisión y comentarios nuevos
// (en cualquiera de los dos hilos) — el correo solo se dispara para los dos eventos
// críticos (`task-service.ts`), el resto queda solo como badge (decisión 11 del plan).

import { db } from '@/db';
import { catalogNotifications } from '@/db/schema';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(catalogNotifications)
    .where(and(eq(catalogNotifications.userId, userId), isNull(catalogNotifications.readAt)));
  return row?.count ?? 0;
}

export async function listNotifications(userId: string, limit = 20) {
  return db
    .select()
    .from(catalogNotifications)
    .where(eq(catalogNotifications.userId, userId))
    .orderBy(desc(catalogNotifications.createdAt))
    .limit(limit);
}

/** Marca todas las notificaciones no leídas del usuario como leídas — el panel las marca
 * en bloque al abrir el drawer de notificaciones, no una por una. */
export async function markAllNotificationsRead(userId: string) {
  await db
    .update(catalogNotifications)
    .set({ readAt: new Date() })
    .where(and(eq(catalogNotifications.userId, userId), isNull(catalogNotifications.readAt)));
}

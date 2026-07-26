// ─── Registro de actividad del Gestor del Catálogo (Fase 7 del plan RBAC, extendido en
// Fase 5/6 del plan tareas/comentarios/pagos) ───
// Capa de datos consumida por `/api/admin/activity/start` y `/api/admin/activity/[id]/finish`.
// Cuenta como "producción" (decisión 5 del plan RBAC): creación/edición de producto,
// variante, set corporativo, o subida/vinculación de medios en la biblioteca.

import { db } from '@/db';
import { catalogActivityLog } from '@/db/schema';
import { eq, and, isNull, lt, sql } from 'drizzle-orm';
import type { ChangedFields } from '@/hooks/useActivityTracking';

export type CatalogEntityType = 'PRODUCT' | 'VARIANT' | 'SET' | 'MEDIA';
export type CatalogActivityAction = 'CREATE' | 'UPDATE';

// Umbral de inactividad para considerar abandonada una sesión de actividad previa sin
// cerrar (decisión 12 del plan, Fase 5) — heurística: si el usuario abre un formulario
// nuevo y aún tiene una fila abierta de hace más de 4 horas, se asume que la anterior
// se abandonó sin guardar (cerró la pestaña, etc.), no hay evento explícito de eso.
const ABANDON_THRESHOLD_HOURS = 4;

export async function startActivity(
  userId: string,
  entityType: CatalogEntityType,
  action: CatalogActivityAction,
  entityId?: string | null
) {
  await voidStaleActivity(userId);

  const [row] = await db
    .insert(catalogActivityLog)
    .values({ userId, entityType, action, entityId: entityId ?? null })
    .returning({ id: catalogActivityLog.id });
  return row.id;
}

/** Marca como `ABANDONED` cualquier actividad del usuario que sigue sin `finished_at` y
 * lleva abierta más del umbral — se ejecuta al abrir una actividad nueva (Fase 5, decisión
 * 12: heurística, no hay evento de "cerré la pestaña sin guardar" confiable). */
async function voidStaleActivity(userId: string) {
  const threshold = sql`now() - interval '${sql.raw(String(ABANDON_THRESHOLD_HOURS))} hours'`;
  await db
    .update(catalogActivityLog)
    .set({ status: 'ABANDONED' })
    .where(and(
      eq(catalogActivityLog.userId, userId),
      isNull(catalogActivityLog.finishedAt),
      lt(catalogActivityLog.startedAt, threshold)
    ));
}

export interface FinishActivityInput {
  entityId?: string | null;
  changedFields?: ChangedFields;
  taskId?: string | null;
}

/**
 * Marca una actividad como finalizada — llamado al guardar exitosamente (decisión 6 del
 * plan RBAC: el evento de "fin" es explícito, instrumentado en frontend, no inferido). Solo
 * finaliza actividades del propio usuario (`userId`) para que un id de otra sesión no
 * pueda cerrarse por error/manipulación del cliente.
 */
export async function finishActivity(activityId: string, userId: string, input: FinishActivityInput = {}) {
  const [row] = await db
    .update(catalogActivityLog)
    .set({
      finishedAt: sql`now()`,
      durationSeconds: sql`extract(epoch from (now() - ${catalogActivityLog.startedAt}))::int`,
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.changedFields ? { changedFields: input.changedFields } : {}),
      ...(input.taskId ? { taskId: input.taskId } : {}),
    })
    .where(eq(catalogActivityLog.id, activityId))
    .returning({ id: catalogActivityLog.id, userId: catalogActivityLog.userId });

  if (!row || row.userId !== userId) return null;
  return row;
}

/** Incrementa el conteo de medios subidos/vinculados dentro de una sesión de actividad ya
 * abierta (Fase 5, decisión 12) — usado por el formulario de producto/set cuando se sube
 * un medio sin cerrar la sesión de actividad activa (a diferencia de `trackMediaActivity`,
 * pensado para acciones puntuales de la biblioteca general, sin ciclo de formulario). */
export async function incrementActivityMediaCount(activityId: string, userId: string) {
  const [row] = await db
    .update(catalogActivityLog)
    .set({ mediaCount: sql`coalesce(${catalogActivityLog.mediaCount}, 0) + 1` })
    .where(and(eq(catalogActivityLog.id, activityId), eq(catalogActivityLog.userId, userId)))
    .returning({ id: catalogActivityLog.id });
  return row ?? null;
}

// ─── Registro de actividad del Gestor del Catálogo (Fase 7 del plan RBAC) ───
// Capa de datos consumida por `/api/admin/activity/start` y `/api/admin/activity/[id]/finish`.
// Cuenta como "producción" (decisión 5 del plan): creación/edición de producto, variante,
// set corporativo, o subida/vinculación de medios en la biblioteca.

import { db } from '@/db';
import { catalogActivityLog } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export type CatalogEntityType = 'PRODUCT' | 'VARIANT' | 'SET' | 'MEDIA';
export type CatalogActivityAction = 'CREATE' | 'UPDATE';

export async function startActivity(
  userId: string,
  entityType: CatalogEntityType,
  action: CatalogActivityAction,
  entityId?: string | null
) {
  const [row] = await db
    .insert(catalogActivityLog)
    .values({ userId, entityType, action, entityId: entityId ?? null })
    .returning({ id: catalogActivityLog.id });
  return row.id;
}

/**
 * Marca una actividad como finalizada — llamado al guardar exitosamente (decisión 6 del
 * plan: el evento de "fin" es explícito, instrumentado en frontend, no inferido). Solo
 * finaliza actividades del propio usuario (`userId`) para que un id de otra sesión no
 * pueda cerrarse por error/manipulación del cliente.
 */
export async function finishActivity(activityId: string, userId: string, entityId?: string | null) {
  const [row] = await db
    .update(catalogActivityLog)
    .set({
      finishedAt: sql`now()`,
      durationSeconds: sql`extract(epoch from (now() - ${catalogActivityLog.startedAt}))::int`,
      ...(entityId ? { entityId } : {}),
    })
    .where(eq(catalogActivityLog.id, activityId))
    .returning({ id: catalogActivityLog.id, userId: catalogActivityLog.userId });

  if (!row || row.userId !== userId) return null;
  return row;
}

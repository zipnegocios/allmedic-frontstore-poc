// ─── Visor de productividad del Gestor del Catálogo (Fase 8 del plan RBAC) ───
// Agrega `catalog_activity_log` por periodo (día/semana/mes) y lo compara contra
// `productivity_targets.daily_target` (prorrateado para semana/mes) para el semáforo
// de cumplimiento. Consumido por `/api/admin/productivity`.

import { db } from '@/db';
import { catalogActivityLog, productivityTargets, users } from '@/db/schema';
import { eq, and, gte, isNotNull } from 'drizzle-orm';

export type ProductivityPeriod = 'day' | 'week' | 'month';

function periodStart(period: ProductivityPeriod): Date {
  const now = new Date();
  if (period === 'day') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === 'week') {
    // Semana calendario lunes-domingo (getDay(): 0=domingo).
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
    return monday;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Multiplicador para prorratear `daily_target` según el periodo consultado. */
function targetMultiplier(period: ProductivityPeriod): number {
  if (period === 'day') return 1;
  if (period === 'week') return 7;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); // días del mes actual
}

export interface ProductivityStats {
  userId: string;
  userName: string | null;
  dailyTarget: number;
  periodTarget: number;
  itemsByType: Record<'PRODUCT' | 'VARIANT' | 'SET' | 'MEDIA', number>;
  totalItems: number;
  avgCreateSeconds: number | null;
  avgUpdateSeconds: number | null;
  compliancePct: number;
  /** verde >= 100%, amarillo 50-99%, rojo < 50% (ver decisión de semáforo abajo). */
  status: 'green' | 'yellow' | 'red';
}

function complianceStatus(pct: number): 'green' | 'yellow' | 'red' {
  if (pct >= 100) return 'green';
  if (pct >= 50) return 'yellow';
  return 'red';
}

/** Estadísticas de productividad de UN usuario para el periodo dado. */
export async function getProductivityStatsForUser(userId: string, period: ProductivityPeriod): Promise<ProductivityStats> {
  const since = periodStart(period);

  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  const [target] = await db.select().from(productivityTargets).where(eq(productivityTargets.userId, userId)).limit(1);
  const dailyTarget = target?.dailyTarget ?? 25;
  const periodTarget = dailyTarget * targetMultiplier(period);

  const rows = await db
    .select({
      entityType: catalogActivityLog.entityType,
      action: catalogActivityLog.action,
      durationSeconds: catalogActivityLog.durationSeconds,
    })
    .from(catalogActivityLog)
    .where(and(
      eq(catalogActivityLog.userId, userId),
      gte(catalogActivityLog.startedAt, since),
      isNotNull(catalogActivityLog.finishedAt)
    ));

  const itemsByType: ProductivityStats['itemsByType'] = { PRODUCT: 0, VARIANT: 0, SET: 0, MEDIA: 0 };
  const createDurations: number[] = [];
  const updateDurations: number[] = [];

  for (const row of rows) {
    itemsByType[row.entityType]++;
    if (row.durationSeconds == null) continue;
    if (row.action === 'CREATE') createDurations.push(row.durationSeconds);
    else updateDurations.push(row.durationSeconds);
  }

  const avg = (values: number[]) => values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const totalItems = rows.length;
  const compliancePct = periodTarget > 0 ? Math.round((totalItems / periodTarget) * 100) : 0;

  return {
    userId,
    userName: user?.name ?? null,
    dailyTarget,
    periodTarget,
    itemsByType,
    totalItems,
    avgCreateSeconds: avg(createDurations),
    avgUpdateSeconds: avg(updateDurations),
    compliancePct,
    status: complianceStatus(compliancePct),
  };
}

/** Listado de estadísticas de TODOS los Gestores del Catálogo — usado por Admin. */
export async function getProductivityStatsForAllCatalogManagers(period: ProductivityPeriod): Promise<ProductivityStats[]> {
  const managers = await db.select({ id: users.id }).from(users).where(eq(users.role, 'CATALOG_MANAGER'));
  return Promise.all(managers.map((m) => getProductivityStatsForUser(m.id, period)));
}

export interface ProductivityTargetInput {
  userId: string;
  dailyTarget: number;
}

/** Fija/actualiza la meta diaria de un usuario (solo Admin, decisión 7 del plan: meta
 * configurable por usuario, no una meta global única). */
export async function setProductivityTarget(input: ProductivityTargetInput) {
  await db
    .insert(productivityTargets)
    .values({ userId: input.userId, dailyTarget: input.dailyTarget })
    .onConflictDoUpdate({
      target: productivityTargets.userId,
      set: { dailyTarget: input.dailyTarget },
    });
}

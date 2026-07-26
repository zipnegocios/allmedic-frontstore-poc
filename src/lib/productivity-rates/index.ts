/**
 * Motor de tarifas por productividad (Fase 2 del plan
 * 2026-07-25-tareas-comentarios-pagos-productividad.md).
 *
 * Servicio puro, sin dependencias de UI, completamente independiente de
 * `src/lib/rules-engine/` (motor de precios de producto) — no debe confundirse ni
 * acoplarse con él (fuera de alcance explícito del plan).
 *
 * `calculatePeriodAmount`: agrega `catalog_activity_log` del rango del período, excluye
 * filas anuladas por rechazo de tarea (y, si el usuario lo requiere, filas sin tarea
 * asignada), aplica la tarifa del tier del usuario por componente habilitado, y suma el
 * bono/penalización por tiempo comparando contra `productivity_targets`.
 *
 * `recalculatePeriod`: solo permitido si el período está `OPEN` (decisión 9 del plan —
 * recálculo manual, nunca automático). Preserva `manualAdjustment` existente.
 */
import { db } from '@/db';
import {
  catalogActivityLog,
  catalogTasks,
  catalogTaskGroups,
  productivityRates,
  productivityTargets,
  paymentPeriods,
  paymentPeriodItems,
  paymentPeriodTaskGroupItems,
  users,
  systemSettings,
} from '@/db/schema';
import { eq, and, gte, lte, isNotNull } from 'drizzle-orm';
import { uuid } from '@/lib/uuid';

export class PaymentModuleDisabledError extends Error {
  constructor() {
    super('El módulo de pagos por productividad está desactivado.');
    this.name = 'PaymentModuleDisabledError';
  }
}

export class PeriodNotOpenError extends Error {
  constructor() {
    super('Solo se puede recalcular un período en estado OPEN.');
    this.name = 'PeriodNotOpenError';
  }
}

async function assertPaymentModuleEnabled(): Promise<void> {
  const [settings] = await db.select().from(systemSettings).limit(1);
  if (!settings?.paymentModuleEnabled) {
    throw new PaymentModuleDisabledError();
  }
}

const ENTITY_TO_COMPONENT = {
  VARIANT: 'VARIANT',
  PRODUCT: 'PRODUCT',
  SET: 'SET',
  MEDIA: 'MEDIA',
} as const;

export interface PeriodAmountResult {
  userId: string;
  computedAmount: number;
  voidedItemsCount: number;
}

/**
 * Calcula el monto de productividad de UN usuario para UN período — no escribe nada,
 * solo calcula. `recalculatePeriod` es quien persiste el resultado en `payment_period_items`.
 */
export async function calculatePeriodAmount(userId: string, periodId: string): Promise<PeriodAmountResult> {
  await assertPaymentModuleEnabled();

  const [period] = await db.select().from(paymentPeriods).where(eq(paymentPeriods.id, periodId)).limit(1);
  if (!period) throw new Error(`Período ${periodId} no encontrado.`);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error(`Usuario ${userId} no encontrado.`);
  if (!user.tierId) {
    return { userId, computedAmount: 0, voidedItemsCount: 0 };
  }

  const rates = await db.select().from(productivityRates).where(eq(productivityRates.tierId, user.tierId));
  const rateByComponent = new Map(rates.filter((r) => r.enabled).map((r) => [r.componentType, r]));

  const [target] = await db.select().from(productivityTargets).where(eq(productivityTargets.userId, userId)).limit(1);
  const dailyTarget = target?.dailyTarget ?? 25;

  // Ítem elegible: guardado dentro del rango del período, sin anular por rechazo, y —si el
  // usuario lo requiere (decisión 1 del plan, modo híbrido)— vinculado a una tarea asignada.
  const rows = await db
    .select({
      entityType: catalogActivityLog.entityType,
      action: catalogActivityLog.action,
      durationSeconds: catalogActivityLog.durationSeconds,
      taskId: catalogActivityLog.taskId,
      voidedByRejection: catalogActivityLog.voidedByRejection,
    })
    .from(catalogActivityLog)
    .where(and(
      eq(catalogActivityLog.userId, userId),
      gte(catalogActivityLog.startedAt, period.startDate),
      lte(catalogActivityLog.startedAt, period.endDate),
      isNotNull(catalogActivityLog.finishedAt),
      eq(catalogActivityLog.voidedByRejection, false)
    ));

  let computedAmount = 0;
  let voidedItemsCount = 0;
  const durations: number[] = [];

  for (const row of rows) {
    if (user.requiresAssignedTaskForPayment && !row.taskId) {
      voidedItemsCount++;
      continue;
    }

    const component = ENTITY_TO_COMPONENT[row.entityType];
    const rate = rateByComponent.get(component);
    if (rate?.amount) {
      computedAmount += Number(rate.amount);
    }
    if (row.durationSeconds != null) {
      durations.push(row.durationSeconds);
    }
  }

  // Bono/penalización por tiempo — compara el promedio de duración contra la meta diaria
  // prorrateada a segundos (24h/objetivo), configurable por tier (decisión 6 del plan).
  const timeBonusRate = rateByComponent.get('TIME_BONUS');
  if (timeBonusRate && durations.length > 0 && dailyTarget > 0) {
    const avgDurationSeconds = durations.reduce((a, b) => a + b, 0) / durations.length;
    const targetSecondsPerItem = (8 * 60 * 60) / dailyTarget; // jornada de 8h como referencia
    const diff = targetSecondsPerItem - avgDurationSeconds;
    if (diff > 0 && timeBonusRate.bonusPerUnitUnderTarget) {
      computedAmount += Number(timeBonusRate.bonusPerUnitUnderTarget) * durations.length;
    } else if (diff < 0 && timeBonusRate.penaltyPerUnitOverTarget) {
      computedAmount -= Number(timeBonusRate.penaltyPerUnitOverTarget) * durations.length;
    }
  }

  return { userId, computedAmount: Math.max(0, computedAmount), voidedItemsCount };
}

interface EligibleGroup {
  id: string;
  paymentAmount: string;
}

/** Grupos con pago asignado (`hasPayment = true`), completados en el rango del período, del
 * usuario dado, que aún no generaron su pago fijo en ESTE período — base compartida de
 * `calculateFixedGroupAmount` (solo lectura, para desglose en UI) y `persistFixedGroupItems`
 * (además escribe). Un grupo sin `hasPayment` (puramente organizativo) nunca entra aquí. */
async function findEligibleGroupsForUser(userId: string, periodId: string): Promise<EligibleGroup[]> {
  const [period] = await db.select().from(paymentPeriods).where(eq(paymentPeriods.id, periodId)).limit(1);
  if (!period) throw new Error(`Período ${periodId} no encontrado.`);

  const alreadyPaidGroupIds = new Set(
    (await db
      .select({ groupId: paymentPeriodTaskGroupItems.groupId })
      .from(paymentPeriodTaskGroupItems)
      .where(eq(paymentPeriodTaskGroupItems.periodId, periodId))
    ).map((r) => r.groupId)
  );

  const groups = await db
    .select({ id: catalogTaskGroups.id, paymentAmount: catalogTaskGroups.paymentAmount })
    .from(catalogTaskGroups)
    .where(and(
      eq(catalogTaskGroups.hasPayment, true),
      isNotNull(catalogTaskGroups.completedAt),
      gte(catalogTaskGroups.completedAt, period.startDate),
      lte(catalogTaskGroups.completedAt, period.endDate)
    ));

  const eligible: EligibleGroup[] = [];
  for (const group of groups) {
    if (!group.paymentAmount) continue;
    if (alreadyPaidGroupIds.has(group.id)) continue;
    const [anyTask] = await db
      .select({ assignedTo: catalogTasks.assignedTo })
      .from(catalogTasks)
      .where(eq(catalogTasks.groupId, group.id))
      .limit(1);
    if (anyTask?.assignedTo === userId) eligible.push({ id: group.id, paymentAmount: group.paymentAmount });
  }
  return eligible;
}

/**
 * Suma el monto fijo de todos los grupos de tareas completados dentro del rango del período,
 * asignados al usuario, que todavía no generaron su pago fijo en ESTE período (invariante:
 * un grupo tiene un único Gestor — todas sus tareas comparten `assignedTo`, validado al
 * crear/agregar tareas al grupo). No escribe nada — `recalculatePeriod` persiste el upsert
 * en `payment_period_task_group_items`. Modo independiente del cálculo por componente
 * (`calculatePeriodAmount`); ambos se suman en el mismo período (decisión: conviven).
 */
export async function calculateFixedGroupAmount(userId: string, periodId: string): Promise<number> {
  const groups = await findEligibleGroupsForUser(userId, periodId);
  return groups.reduce((sum, g) => sum + Number(g.paymentAmount), 0);
}

/** Persiste (upsert) las filas de `payment_period_task_group_items` para los grupos
 * elegibles del usuario en el período — llamado desde `recalculatePeriod`. */
async function persistFixedGroupItems(userId: string, periodId: string): Promise<number> {
  const groups = await findEligibleGroupsForUser(userId, periodId);
  let total = 0;
  for (const group of groups) {
    await db.insert(paymentPeriodTaskGroupItems).values({
      id: uuid(),
      periodId,
      groupId: group.id,
      userId,
      amount: group.paymentAmount,
    });
    total += Number(group.paymentAmount);
  }
  return total;
}

/**
 * Recorre todos los usuarios con actividad (por componente O con grupos de tareas
 * completados) en el rango del período y regenera `payment_period_items` — preserva
 * `manualAdjustment` existente, recalcula `finalAmount` como la suma de ambos modos de pago
 * (por componente + tabulador fijo por grupo) más el ajuste manual. Solo permitido en
 * períodos `OPEN` (decisión 9 del plan).
 */
export async function recalculatePeriod(periodId: string): Promise<void> {
  await assertPaymentModuleEnabled();

  const [period] = await db.select().from(paymentPeriods).where(eq(paymentPeriods.id, periodId)).limit(1);
  if (!period) throw new Error(`Período ${periodId} no encontrado.`);
  if (period.status !== 'OPEN') throw new PeriodNotOpenError();

  const activeUserRows = await db
    .selectDistinct({ userId: catalogActivityLog.userId })
    .from(catalogActivityLog)
    .where(and(
      gte(catalogActivityLog.startedAt, period.startDate),
      lte(catalogActivityLog.startedAt, period.endDate),
      isNotNull(catalogActivityLog.finishedAt)
    ));

  // Usuarios con grupos completados en el rango (pueden no tener actividad por componente
  // en absoluto — ej. un Gestor que solo trabaja bajo tabulador fijo).
  const groupUserRows = await db
    .selectDistinct({ userId: catalogTasks.assignedTo })
    .from(catalogTasks)
    .innerJoin(catalogTaskGroups, eq(catalogTasks.groupId, catalogTaskGroups.id))
    .where(and(
      isNotNull(catalogTaskGroups.completedAt),
      gte(catalogTaskGroups.completedAt, period.startDate),
      lte(catalogTaskGroups.completedAt, period.endDate)
    ));

  const userIds = new Set([...activeUserRows.map((r) => r.userId), ...groupUserRows.map((r) => r.userId)]);

  for (const userId of userIds) {
    const componentResult = await calculatePeriodAmount(userId, periodId);
    const fixedGroupTotal = await persistFixedGroupItems(userId, periodId);

    const [existingItem] = await db
      .select()
      .from(paymentPeriodItems)
      .where(and(eq(paymentPeriodItems.periodId, periodId), eq(paymentPeriodItems.userId, userId)))
      .limit(1);

    const manualAdjustment = existingItem ? Number(existingItem.manualAdjustment) : 0;
    const finalAmount = componentResult.computedAmount + fixedGroupTotal + manualAdjustment;

    if (existingItem) {
      await db
        .update(paymentPeriodItems)
        .set({
          computedAmount: componentResult.computedAmount.toFixed(2),
          finalAmount: finalAmount.toFixed(2),
          voidedItemsCount: componentResult.voidedItemsCount,
          computedAt: new Date(),
        })
        .where(eq(paymentPeriodItems.id, existingItem.id));
    } else {
      await db.insert(paymentPeriodItems).values({
        id: uuid(),
        periodId,
        userId,
        computedAmount: componentResult.computedAmount.toFixed(2),
        manualAdjustment: '0',
        finalAmount: finalAmount.toFixed(2),
        voidedItemsCount: componentResult.voidedItemsCount,
      });
    }
  }
}

/**
 * Aplica un ajuste manual (suma/resta con motivo obligatorio) sobre el ítem de un usuario
 * en un período — recalcula `finalAmount` (decisión 8 del plan). No permitido en `PAID`
 * (un período pagado es inmutable por diseño, ver riesgos del plan).
 */
export async function applyManualAdjustment(
  periodId: string,
  userId: string,
  adjustment: number,
  reason: string
): Promise<void> {
  const [period] = await db.select().from(paymentPeriods).where(eq(paymentPeriods.id, periodId)).limit(1);
  if (!period) throw new Error(`Período ${periodId} no encontrado.`);
  if (period.status === 'PAID') throw new Error('No se puede ajustar un período ya marcado como pagado.');

  const [item] = await db
    .select()
    .from(paymentPeriodItems)
    .where(and(eq(paymentPeriodItems.periodId, periodId), eq(paymentPeriodItems.userId, userId)))
    .limit(1);
  if (!item) throw new Error('No existe ítem calculado para este usuario en este período — ejecuta el recálculo primero.');

  const finalAmount = Number(item.computedAmount) + adjustment;
  await db
    .update(paymentPeriodItems)
    .set({ manualAdjustment: adjustment.toFixed(2), adjustmentReason: reason, finalAmount: finalAmount.toFixed(2) })
    .where(eq(paymentPeriodItems.id, item.id));
}

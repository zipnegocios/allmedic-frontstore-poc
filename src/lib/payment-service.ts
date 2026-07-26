// ─── Gestión de tiers, tarifas, períodos y pagos (Fase 7 del plan tareas/comentarios/pagos) ───
// Capa de datos consumida por `/api/admin/payment-*` — separada del motor puro de cálculo
// (`@/lib/productivity-rates`) que no toca formularios ni CRUD, solo agrega/calcula.

import { db } from '@/db';
import {
  productivityRateTiers,
  productivityRates,
  paymentPeriods,
  paymentPeriodItems,
  systemSettings,
  users,
} from '@/db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import { uuid } from '@/lib/uuid';

export async function getPaymentModuleEnabled(): Promise<boolean> {
  const [settings] = await db.select().from(systemSettings).limit(1);
  return settings?.paymentModuleEnabled ?? false;
}

export async function setPaymentModuleEnabled(enabled: boolean): Promise<void> {
  const [existing] = await db.select().from(systemSettings).limit(1);
  if (existing) {
    await db.update(systemSettings).set({ paymentModuleEnabled: enabled, updatedAt: new Date() }).where(eq(systemSettings.id, existing.id));
  } else {
    await db.insert(systemSettings).values({ id: uuid(), paymentModuleEnabled: enabled });
  }
}

// ─── Tiers y tarifas ───

const RATE_COMPONENTS = ['VARIANT', 'PRODUCT', 'SET', 'MEDIA', 'TIME_BONUS'] as const;

export async function listTiers() {
  const tiers = await db.select().from(productivityRateTiers).orderBy(asc(productivityRateTiers.name));
  const allRates = await db.select().from(productivityRates);
  return tiers.map((tier) => ({
    ...tier,
    rates: allRates.filter((r) => r.tierId === tier.id),
  }));
}

export async function createTier(name: string) {
  const [tier] = await db.insert(productivityRateTiers).values({ id: uuid(), name }).returning();
  // Crea las 5 filas de componente en `enabled=false` para que la UI tenga algo que editar
  // desde el inicio, sin depender de que el Admin las inserte una por una.
  const rateRows = RATE_COMPONENTS.map((componentType) => ({
    id: uuid(),
    tierId: tier.id,
    componentType,
    enabled: false,
  }));
  await db.insert(productivityRates).values(rateRows);
  return tier;
}

export interface UpdateRateInput {
  tierId: string;
  componentType: typeof RATE_COMPONENTS[number];
  enabled: boolean;
  amount?: string | null;
  bonusPerUnitUnderTarget?: string | null;
  penaltyPerUnitOverTarget?: string | null;
}

export async function updateRate(input: UpdateRateInput) {
  const [existing] = await db
    .select()
    .from(productivityRates)
    .where(and(eq(productivityRates.tierId, input.tierId), eq(productivityRates.componentType, input.componentType)))
    .limit(1);

  const patch = {
    enabled: input.enabled,
    amount: input.amount ?? null,
    bonusPerUnitUnderTarget: input.bonusPerUnitUnderTarget ?? null,
    penaltyPerUnitOverTarget: input.penaltyPerUnitOverTarget ?? null,
  };

  if (existing) {
    await db.update(productivityRates).set(patch).where(eq(productivityRates.id, existing.id));
  } else {
    await db.insert(productivityRates).values({ id: uuid(), tierId: input.tierId, componentType: input.componentType, ...patch });
  }
}

export async function assignUserTier(userId: string, tierId: string | null, requiresAssignedTaskForPayment: boolean) {
  await db.update(users).set({ tierId, requiresAssignedTaskForPayment }).where(eq(users.id, userId));
}

// ─── Períodos de pago ───

export async function listPeriods() {
  return db.select().from(paymentPeriods).orderBy(desc(paymentPeriods.startDate));
}

export async function createPeriod(startDate: Date, endDate: Date, notes?: string | null) {
  const [period] = await db
    .insert(paymentPeriods)
    .values({ id: uuid(), startDate, endDate, notes: notes ?? null, status: 'OPEN' })
    .returning();
  return period;
}

export async function getPeriodBreakdown(periodId: string) {
  return db
    .select({
      id: paymentPeriodItems.id,
      userId: paymentPeriodItems.userId,
      userName: users.name,
      computedAmount: paymentPeriodItems.computedAmount,
      manualAdjustment: paymentPeriodItems.manualAdjustment,
      adjustmentReason: paymentPeriodItems.adjustmentReason,
      finalAmount: paymentPeriodItems.finalAmount,
      voidedItemsCount: paymentPeriodItems.voidedItemsCount,
      computedAt: paymentPeriodItems.computedAt,
    })
    .from(paymentPeriodItems)
    .leftJoin(users, eq(paymentPeriodItems.userId, users.id))
    .where(eq(paymentPeriodItems.periodId, periodId))
    .orderBy(asc(users.name));
}

export class PeriodStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PeriodStatusError';
  }
}

/** OPEN → CLOSED — deja de admitir recálculo/ajustes salvo reapertura manual (no prevista
 * en el plan; un período cerrado solo avanza a PAID). */
export async function closePeriod(periodId: string) {
  const [period] = await db.select().from(paymentPeriods).where(eq(paymentPeriods.id, periodId)).limit(1);
  if (!period) throw new Error('Período no encontrado.');
  if (period.status !== 'OPEN') throw new PeriodStatusError('Solo se puede cerrar un período OPEN.');
  await db.update(paymentPeriods).set({ status: 'CLOSED', closedAt: new Date() }).where(eq(paymentPeriods.id, periodId));
}

/** CLOSED → PAID — decisión 8/9 del plan: inmutable después de esto, sin recálculo ni
 * ajustes; corregir un pago ya marcado requiere un ajuste en un período nuevo. */
export async function markPeriodPaid(periodId: string) {
  const [period] = await db.select().from(paymentPeriods).where(eq(paymentPeriods.id, periodId)).limit(1);
  if (!period) throw new Error('Período no encontrado.');
  if (period.status !== 'CLOSED') throw new PeriodStatusError('Solo se puede marcar como pagado un período CLOSED.');
  await db.update(paymentPeriods).set({ status: 'PAID', paidAt: new Date() }).where(eq(paymentPeriods.id, periodId));
}

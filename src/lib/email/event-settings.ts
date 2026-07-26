// ─── Control de eventos de correo (panel de correos, 2026-07-25) ───
// Servicio puro consumido por `sendEmail()` (gate antes de disparar) y por el panel de
// configuración (`/admin/configuracion` → "Correos").

import { db } from '@/db';
import { emailEventSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * `true` si no existe fila para el evento — fail-open: el default de negocio es "todo
 * activado" (los 7 eventos preexistentes ya se enviaban antes de este panel), así que una
 * fila faltante nunca debe silenciar un correo por accidente.
 */
export async function isEventEnabled(eventKey: string): Promise<boolean> {
  const [row] = await db
    .select({ enabled: emailEventSettings.enabled })
    .from(emailEventSettings)
    .where(eq(emailEventSettings.eventKey, eventKey))
    .limit(1);
  return row?.enabled ?? true;
}

export async function listEventSettings() {
  return db.select().from(emailEventSettings).orderBy(emailEventSettings.label);
}

export async function setEventEnabled(eventKey: string, enabled: boolean): Promise<void> {
  await db.update(emailEventSettings).set({ enabled, updatedAt: new Date() }).where(eq(emailEventSettings.eventKey, eventKey));
}

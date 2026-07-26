// ─── Bandeja de correos (panel de correos, 2026-07-25) ───
// Lecturas para `/admin/correos`: historial de envíos ("salida") y log crudo de webhooks
// ("entrada/eventos", incluye email.received si Resend Inbound llega a configurarse).

import { db } from '@/db';
import { emailLog, emailWebhookEvents } from '@/db/schema';
import { desc } from 'drizzle-orm';

const PAGE_SIZE = 50;

export async function listEmailLog() {
  return db.select().from(emailLog).orderBy(desc(emailLog.sentAt)).limit(PAGE_SIZE);
}

export async function listWebhookEvents() {
  return db.select().from(emailWebhookEvents).orderBy(desc(emailWebhookEvents.receivedAt)).limit(PAGE_SIZE);
}

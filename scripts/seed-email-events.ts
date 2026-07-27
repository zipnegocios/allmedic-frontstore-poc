/**
 * Seed idempotente del catálogo de eventos de correo (panel de correos, 2026-07-25).
 * Uso: npx tsx scripts/seed-email-events.ts
 *
 * Siembra las filas de `email_event_settings` — una por cada evento real de `sendEmail()`
 * en el código, todas `enabled = true` por defecto (ya se envían hoy, nadie las desactivó).
 */
import 'dotenv/config';
import { db } from '@/db';
import { emailEventSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { uuid } from '@/lib/uuid';

const EVENTS: Array<{ eventKey: string; label: string }> = [
  { eventKey: 'TASK_ASSIGNED', label: 'Tarea asignada' },
  { eventKey: 'TASK_COMPLETED', label: 'Tarea completada (en revisión)' },
  { eventKey: 'TASK_REJECTED', label: 'Tarea rechazada' },
  { eventKey: 'CORPORATE_ACCOUNT_APPROVED', label: 'Cuenta corporativa aprobada' },
  { eventKey: 'CORPORATE_ACCOUNT_REJECTED', label: 'Cuenta corporativa rechazada' },
  { eventKey: 'CORPORATE_REGISTRATION_NEW', label: 'Nuevo registro corporativo' },
  { eventKey: 'QUOTE_SENT', label: 'Cotización enviada' },
  { eventKey: 'QUOTE_REQUEST_NEW', label: 'Nueva solicitud de cotización' },
  { eventKey: 'COMMENT_MENTION', label: 'Mención en un comentario' },
];

async function main() {
  console.log('Sembrando catálogo de eventos de correo...');
  let created = 0;
  for (const event of EVENTS) {
    const [existing] = await db.select().from(emailEventSettings).where(eq(emailEventSettings.eventKey, event.eventKey)).limit(1);
    if (!existing) {
      await db.insert(emailEventSettings).values({ id: uuid(), eventKey: event.eventKey, label: event.label, enabled: true });
      created++;
    }
  }
  console.log(`  → ${created} eventos nuevos insertados (de ${EVENTS.length} totales).`);
  console.log('\n✅ Seed de eventos de correo completado.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error en seed-email-events:', err);
    process.exit(1);
  });

// ─── Envío de prueba por evento (panel de correos, 2026-07-25) ───
// Arma cada plantilla real con datos de ejemplo fijos (no toca ninguna tarea/cuenta/
// cotización real) y la envía al correo que el Admin escriba desde el botón "Probar" de
// cada fila en `/admin/configuracion` → "Correos". Se envía siempre, incluso si el evento
// está desactivado (es una prueba manual explícita) — se loguea con un `eventKey` prefijado
// `TEST_` para no mezclarse con las estadísticas de envíos reales.

import { sendEmail } from '@/lib/email';
import {
  newQuoteRequestEmail,
  newRegistrationEmail,
  accountApprovedEmail,
  accountRejectedEmail,
  quoteSentEmail,
  taskAssignedEmail,
  taskCompletedEmail,
  taskRejectedEmail,
} from '@/lib/email/templates';

type TemplateResult = { subject: string; html: string };

const TEST_TEMPLATES: Record<string, () => TemplateResult> = {
  QUOTE_REQUEST_NEW: () => newQuoteRequestEmail({
    code: 'SOL-2026-00000',
    razonSocial: 'Empresa de Ejemplo S.A.',
    contactName: 'Juan Pérez',
    totalSets: 12,
    referenceTotal: 1450.5,
  }),
  CORPORATE_REGISTRATION_NEW: () => newRegistrationEmail({
    razonSocial: 'Empresa de Ejemplo S.A.',
    contactName: 'Juan Pérez',
    ruc: '1790000000001',
    email: 'contacto@ejemplo.com',
  }),
  CORPORATE_ACCOUNT_APPROVED: () => accountApprovedEmail({
    contactName: 'Juan Pérez',
    razonSocial: 'Empresa de Ejemplo S.A.',
  }),
  CORPORATE_ACCOUNT_REJECTED: () => accountRejectedEmail({
    contactName: 'Juan Pérez',
    razonSocial: 'Empresa de Ejemplo S.A.',
  }),
  QUOTE_SENT: () => quoteSentEmail({
    customerName: 'Juan Pérez',
    quoteNumber: 'COT-2026-00000',
    total: 1450.5,
  }),
  TASK_ASSIGNED: () => taskAssignedEmail({
    assigneeName: 'María Gómez',
    title: 'Tarea de ejemplo',
    description: 'Descripción de ejemplo para la prueba de correo.',
  }),
  TASK_COMPLETED: () => taskCompletedEmail({
    reviewerName: 'Admin de Ejemplo',
    assigneeName: 'María Gómez',
    title: 'Tarea de ejemplo',
  }),
  TASK_REJECTED: () => taskRejectedEmail({
    assigneeName: 'María Gómez',
    title: 'Tarea de ejemplo',
    reason: 'Motivo de ejemplo para la prueba de correo.',
  }),
};

export class UnknownTestEventError extends Error {
  constructor(eventKey: string) {
    super(`No existe plantilla de prueba para el evento "${eventKey}".`);
    this.name = 'UnknownTestEventError';
  }
}

/** Envía la plantilla real del evento con datos de ejemplo al correo indicado. */
export async function sendTestEmail(eventKey: string, to: string): Promise<void> {
  const buildTemplate = TEST_TEMPLATES[eventKey];
  if (!buildTemplate) throw new UnknownTestEventError(eventKey);

  const { subject, html } = buildTemplate();
  await sendEmail({
    to,
    subject: `[PRUEBA] ${subject}`,
    html,
    eventKey: `TEST_${eventKey}`,
  });
}

import { Resend } from 'resend';
import { db } from '@/db';
import { emailLog } from '@/db/schema';
import { uuid } from '@/lib/uuid';
import { isEventEnabled } from './event-settings';

// Dominio raíz `allmedicuniforms.com` NO está verificado en Resend — solo el subdominio
// `notificaciones.allmedicuniforms.com` lo está (confirmado vía `resend.domains.list()`).
// Usar el dominio raíz como remitente causaba un 403 silencioso: el SDK no lanza excepción,
// solo responde `{ data: null, error }`, así que el bug pasaba desapercibido hasta revisar
// `resend.com/emails` (2026-07-26). Configurable por env para no repetir esto si se verifica
// otro dominio a futuro.
const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'AllMedic Uniforms <no-reply@notificaciones.allmedicuniforms.com>';
const SALES_TEAM_EMAIL = process.env.SALES_TEAM_EMAIL || 'allmedicuniforms@gmail.com';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith('re_your') || apiKey.trim() === '') return null;
  if (!_resend) _resend = new Resend(apiKey);
  return _resend;
}

interface SendEmailAttachment {
  filename: string;
  content: Buffer;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: SendEmailAttachment[];
  /** Clave del evento (panel de correos, 2026-07-25) — si se informa, el envío se puede
   * desactivar individualmente desde `/admin/configuracion` y queda registrado en
   * `email_log` (bandeja de salida) para cruzar luego con los webhooks de Resend. Los
   * envíos sin `eventKey` (ninguno hoy) no pasan por el gate ni se loguean. */
  eventKey?: string;
}

/**
 * Envía un correo vía Resend. Si RESEND_API_KEY no está configurado, o si el evento fue
 * desactivado desde el panel de correos, hace fallback silencioso (log + no-op) en vez de
 * fallar la operación que disparó el correo (registro, cotización, etc.).
 */
export async function sendEmail({ to, subject, html, attachments, eventKey }: SendEmailOptions): Promise<void> {
  if (eventKey && !(await isEventEnabled(eventKey))) {
    console.log(`[email] Evento "${eventKey}" desactivado desde el panel de correos — correo omitido: "${subject}" para ${to}`);
    return;
  }

  const resend = getResend();
  if (!resend) {
    console.log(`[email] RESEND_API_KEY no configurado — correo omitido: "${subject}" para ${to}`);
    return;
  }

  try {
    const result = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html, attachments });

    // El SDK de Resend NO lanza excepción cuando la API rechaza el envío (dominio no
    // verificado, remitente inválido, etc.) — responde `{ data: null, error: {...} }` con
    // 200 OK a nivel de fetch. Ignorar `result.error` acá era el bug: se registraba en
    // `email_log` como si el correo hubiera salido, aunque Resend nunca lo aceptara.
    if (result.error) {
      console.error('[email] Resend rechazó el envío:', result.error);
      if (eventKey) {
        await db.insert(emailLog).values({
          id: uuid(),
          eventKey,
          resendId: null,
          to: Array.isArray(to) ? to.join(', ') : to,
          subject,
          status: 'FAILED',
        });
      }
      return;
    }

    if (eventKey) {
      await db.insert(emailLog).values({
        id: uuid(),
        eventKey,
        resendId: result.data?.id ?? null,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
      });
    }
  } catch (err) {
    console.error('[email] Error enviando correo:', err);
    if (eventKey) {
      await db.insert(emailLog).values({
        id: uuid(),
        eventKey,
        resendId: null,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        status: 'FAILED',
      });
    }
  }
}

export { SALES_TEAM_EMAIL, getResend };
export * from './templates';

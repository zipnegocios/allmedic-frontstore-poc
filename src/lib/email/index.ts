import { Resend } from 'resend';

const FROM_ADDRESS = 'AllMedic Uniforms <notificaciones@allmedicuniforms.com>';
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
}

/**
 * Envía un correo vía Resend. Si RESEND_API_KEY no está configurado,
 * hace fallback silencioso (log + no-op) en vez de fallar la operación
 * que disparó el correo (registro, cotización, etc.).
 */
export async function sendEmail({ to, subject, html, attachments }: SendEmailOptions): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[email] RESEND_API_KEY no configurado — correo omitido: "${subject}" para ${to}`);
    return;
  }

  try {
    await resend.emails.send({ from: FROM_ADDRESS, to, subject, html, attachments });
  } catch (err) {
    console.error('[email] Error enviando correo:', err);
  }
}

export { SALES_TEAM_EMAIL };
export * from './templates';

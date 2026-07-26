import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { emailLog, emailWebhookEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { uuid } from '@/lib/uuid';
import { getResend } from '@/lib/email';

/**
 * Endpoint público (panel de correos, 2026-07-25) — NO pasa por `proxy.ts` (matcher solo
 * cubre `/admin/:path*` y `/api/admin/:path*`) ni requiere sesión: Resend llama esto
 * directamente desde sus servidores.
 *
 * Registra "salida real" (delivered/bounced/opened/clicked/complained/failed) y el intento
 * de "entrada" (`email.received`, requiere Resend Inbound + DNS configurados aparte —
 * fuera de alcance de este cambio de código, el endpoint solo queda listo para recibirlo).
 */
const STATUS_BY_EVENT_TYPE: Record<string, 'DELIVERED' | 'BOUNCED' | 'OPENED' | 'CLICKED' | 'COMPLAINED' | 'FAILED'> = {
  'email.delivered': 'DELIVERED',
  'email.bounced': 'BOUNCED',
  'email.opened': 'OPENED',
  'email.clicked': 'CLICKED',
  'email.complained': 'COMPLAINED',
  'email.failed': 'FAILED',
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[webhooks/resend] RESEND_WEBHOOK_SECRET no configurado — rechazando webhook.');
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 401 });
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json({ error: 'Resend no configurado' }, { status: 401 });
  }

  let event;
  try {
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: request.headers.get('webhook-id') ?? '',
        timestamp: request.headers.get('webhook-timestamp') ?? '',
        signature: request.headers.get('webhook-signature') ?? '',
      },
      webhookSecret,
    });
  } catch (err) {
    console.error('[webhooks/resend] Firma inválida:', err);
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  // Log crudo de auditoría — siempre, incluso si el tipo no matchea ningún envío conocido
  // (incluye email.received y cualquier evento futuro que Resend agregue).
  const resendId = 'data' in event && event.data && 'email_id' in event.data ? event.data.email_id : null;
  try {
    await db.insert(emailWebhookEvents).values({
      id: uuid(),
      resendId,
      eventType: event.type,
      payload: event as unknown as Record<string, unknown>,
    });
  } catch (err) {
    console.error('[webhooks/resend] Error guardando evento crudo:', err);
  }

  const status = STATUS_BY_EVENT_TYPE[event.type];
  if (status && resendId) {
    try {
      await db.update(emailLog).set({ status, lastEventAt: new Date() }).where(eq(emailLog.resendId, resendId));
    } catch (err) {
      console.error('[webhooks/resend] Error actualizando email_log:', err);
    }
  }

  return NextResponse.json({ ok: true });
}

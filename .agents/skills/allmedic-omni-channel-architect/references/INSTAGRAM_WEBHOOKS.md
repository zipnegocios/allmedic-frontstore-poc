# INSTAGRAM_WEBHOOKS.md — Instagram Graph API Integration

> Guía para conectar Instagram DMs y Comments al Dashboard de Allmedic via Meta Graph API Webhooks.

---

## 1. Requisitos Previos

1. **Facebook App** en [Meta for Developers](https://developers.facebook.com/)
2. **Instagram Business Account** conectada a una Facebook Page
3. **Webhook URL** pública (HTTPS) accesible desde internet
4. **Verify Token** para validación de webhooks
5. **App Review** (solo para producción con cuentas externas)

---

## 2. Permisos y Scopes Necesarios

| Permiso | Uso |
|---------|-----|
| `instagram_basic` | Leer perfil del negocio |
| `instagram_manage_messages` | Recibir y responder DMs |
| `instagram_manage_comments` | Recibir y responder comentarios |
| `pages_messaging` | Webhooks de mensajes de página |

---

## 3. Configuración del Webhook en Meta

### 3.1 URL del Webhook

```
https://tudominio.com/api/webhooks/instagram
```

### 3.2 Verify Token

Generar un token seguro y guardarlo en `.env.local`:

```bash
IG_VERIFY_TOKEN=tu_token_seguro_de_32_chars_min
IG_APP_SECRET=tu_app_secret_de_meta
IG_ACCESS_TOKEN=tu_access_token_largo
```

### 3.3 Suscripciones de Webhook

Suscribirse a estos eventos:
- `messages` — DMs recibidos
- `messaging_postbacks` — Botones/interacciones
- `mentions` — Menciones en comments/stories

---

## 4. Endpoint de Webhook en Next.js

### `src/app/api/webhooks/instagram/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '@/db';
import { messages, conversations } from '@/db/schema/chats';
import { eq, and } from 'drizzle-orm';

const APP_SECRET = process.env.IG_APP_SECRET!;
const VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN!;

// Verificar firma de Meta
function verifySignature(body: string, signature: string): boolean {
  const expected = createHmac('sha256', APP_SECRET).update(body, 'utf8').digest('hex');
  return signature === `sha256=${expected}`;
}

// GET: Verificación inicial del webhook
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[IG] Webhook verificado');
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

// POST: Recibir eventos
export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-hub-signature-256') || '';
  const body = await req.text();

  if (!verifySignature(body, signature)) {
    return new NextResponse('Invalid signature', { status: 403 });
  }

  const payload = JSON.parse(body);

  for (const entry of payload.entry || []) {
    for (const messaging of entry.messaging || []) {
      const sender = messaging.sender?.id;
      const recipient = messaging.recipient?.id;
      const message = messaging.message;
      const postback = messaging.postback;

      if (!sender) continue;

      // Determinar tipo de contenido
      let content = '';
      let source: 'instagram_dm' | 'instagram_comment' = 'instagram_dm';
      let metadata: Record<string, unknown> = {};

      if (message?.text) {
        content = message.text;
        metadata = { igMessageId: message.mid };
      } else if (message?.attachments) {
        content = '[Adjunto: ' + message.attachments[0].type + ']';
        metadata = { igMessageId: message.mid, attachment: message.attachments[0] };
      } else if (postback) {
        content = postback.title || postback.payload;
        metadata = { postback: true };
      }

      // Buscar o crear conversación
      const existing = await db.select()
        .from(conversations)
        .where(and(
          eq(conversations.channel, 'instagram'),
          eq(conversations.externalId, sender)
        ))
        .limit(1);

      let conversationId;
      if (existing.length === 0) {
        const [conv] = await db.insert(conversations).values({
          channel: 'instagram',
          externalId: sender,
          customerIgHandle: sender, // Se puede enriquecer con Graph API
          status: 'OPEN',
        }).returning({ id: conversations.id });
        conversationId = conv.id;
      } else {
        conversationId = existing[0].id;
      }

      // Guardar mensaje
      await db.insert(messages).values({
        conversationId,
        source,
        direction: 'inbound',
        content,
        metadata,
      });

      // Actualizar lastMessageAt
      await db.update(conversations)
        .set({ lastMessageAt: new Date() })
        .where(eq(conversations.id, conversationId));
    }
  }

  return NextResponse.json({ success: true });
}
```

---

## 5. Enviar Respuestas a Instagram

### `src/lib/instagram-api.ts`

```typescript
const IG_API_URL = 'https://graph.facebook.com/v18.0';
const ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN!;

export async function sendInstagramMessage(recipientId: string, message: string) {
  const url = `${IG_API_URL}/me/messages?access_token=${ACCESS_TOKEN}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`IG API Error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function sendInstagramCommentReply(mediaId: string, commentId: string, message: string) {
  const url = `${IG_API_URL}/${commentId}/replies?access_token=${ACCESS_TOKEN}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`IG API Error: ${JSON.stringify(error)}`);
  }

  return response.json();
}
```

---

## 6. Estructura Unificada de Conversaciones

La tabla `conversations` ya diferencia el canal:

| Campo | WhatsApp | Instagram DM | Instagram Comment |
|-------|----------|--------------|-------------------|
| `channel` | `'whatsapp'` | `'instagram'` | `'instagram'` |
| `externalId` | `521234567890@c.us` | `IG user ID` | `IG user ID` |
| `customerPhone` | `+521234567890` | `null` | `null` |
| `customerIgHandle` | `null` | `@usuario` | `@usuario` |
| `source` (en messages) | `'whatsapp'` | `'instagram_dm'` | `'instagram_comment'` |

---

## 7. Flujo de Configuración

1. Crear Facebook App en Meta for Developers
2. Añadir producto "Instagram" → "Instagram Basic Display" y "Instagram Graph API"
3. Conectar Instagram Business Account a una Facebook Page
4. Configurar webhook URL: `https://tudominio.com/api/webhooks/instagram`
5. Generar Access Token (User Token con permisos de página)
6. Suscribirse a eventos: `messages`, `messaging_postbacks`
7. Verificar endpoint GET responde correctamente al challenge
8. Enviar mensaje de prueba al IG Business Account
9. Confirmar que llega al webhook y se guarda en PostgreSQL

---

## 8. Notas de Seguridad

1. **Verify Token**: Mínimo 32 caracteres aleatorios. Nunca hardcodear.
2. **App Secret**: Guardar en `.env.local`. Rotar si se sospecha de fuga.
3. **Access Token**: Usar token de página (más duradero). Refrescar automáticamente.
4. **Signature Validation**: SIEMPRE verificar `x-hub-signature-256` antes de procesar.
5. **Rate Limits**: Meta tiene límites. Implementar cola si se esperan muchos mensajes.

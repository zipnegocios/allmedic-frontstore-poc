# WHATSAPP_SERVICE.md — WhatsApp Web (No WABA) en Docker

> Guía para implementar un servicio de WhatsApp Web desacoplado usando `whatsapp-web.js`
> o `@whiskeysockets/baileys` en un contenedor Docker separado, con persistencia de sesión
> QR, keep-alive y webhook hacia la app Next.js.

---

## 1. Arquitectura del Servicio

```
┌─────────────────────┐      HTTP Webhooks      ┌─────────────────────┐
│   Next.js App       │ ◄────────────────────── │  WhatsApp Service   │
│   (EasyPanel)       │   { message, from, etc }│  (Docker Container) │
│                     │                         │                     │
│  /api/webhooks/wa   │ ── POST /send-message ─►│  • whatsapp-web.js  │
│  /api/chat/messages │                         │  • Puppeteer        │
│                     │                         │  • Session vol.     │
└─────────────────────┘                         └─────────────────────┘
```

**Regla de oro**: El servicio de WhatsApp NUNCA comparte proceso con Next.js. Si cae WA, la tienda sigue online.

---

## 2. Opciones de Librería

| Librería | Pros | Contras | Recomendación |
|----------|------|---------|---------------|
| `whatsapp-web.js` | Más madura, docs extensas, eventos ricos | Requiere Puppeteer (pesado, ~300MB RAM) | ✅ Usar si hay RAM suficiente (>1GB) |
| `@whiskeysockets/baileys` | Ligero, no requiere browser, más rápido | Menos eventos de UI, más bajo nivel | ✅ Usar si RAM es crítica (<512MB) |

**Para KVM2 (512MB-1GB RAM)**: Recomendar `baileys` por menor consumo. Si se usa `whatsapp-web.js`, limitar Puppeteer con `--memory=512m`.

---

## 3. Implementación con `whatsapp-web.js`

### `assets/docker/whatsapp-service/package.json`

```json
{
  "name": "allmedic-whatsapp-service",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "healthcheck": "node src/healthcheck.js"
  },
  "dependencies": {
    "whatsapp-web.js": "^1.26.0",
    "puppeteer": "^22.0.0",
    "qrcode-terminal": "^0.12.0",
    "express": "^4.18.2",
    "axios": "^1.6.0"
  }
}
```

### `assets/docker/whatsapp-service/src/index.js`

```javascript
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import express from 'express';
import axios from 'axios';

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://host.docker.internal:3000/api/webhooks/whatsapp';
const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.json());

// Estado del cliente
let clientState = 'initializing'; // initializing | qr_ready | authenticated | ready | disconnected
let qrCodeData = null;

// Inicializar cliente con persistencia
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: '/app/session'
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--js-flags=--max-old-space-size=256' // Limitar memoria JS
    ]
  }
});

// Eventos
client.on('qr', (qr) => {
  qrCodeData = qr;
  clientState = 'qr_ready';
  console.log('[WA] QR Code generado. Escanea con tu teléfono.');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  clientState = 'authenticated';
  qrCodeData = null;
  console.log('[WA] Autenticado exitosamente.');
});

client.on('ready', () => {
  clientState = 'ready';
  console.log('[WA] Cliente listo para enviar/recibir mensajes.');
});

client.on('disconnected', (reason) => {
  clientState = 'disconnected';
  console.log('[WA] Desconectado:', reason);
  // Reconectar después de 5 segundos
  setTimeout(() => client.initialize(), 5000);
});

client.on('message_create', async (msg) => {
  // Solo procesar mensajes entrantes (no los que enviamos nosotros)
  if (msg.fromMe) return;

  const payload = {
    type: 'message',
    from: msg.from,
    to: msg.to,
    body: msg.body,
    timestamp: msg.timestamp,
    messageId: msg.id.id,
    hasMedia: msg.hasMedia,
    deviceType: msg.deviceType,
  };

  try {
    await axios.post(WEBHOOK_URL, payload, { timeout: 10000 });
    console.log('[WA] Webhook enviado:', msg.from);
  } catch (err) {
    console.error('[WA] Error enviando webhook:', err.message);
  }
});

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.json({
    status: clientState === 'ready' ? 'healthy' : 'degraded',
    state: clientState,
    hasQr: !!qrCodeData,
    timestamp: new Date().toISOString()
  });
});

// QR endpoint (para mostrar en Dashboard)
app.get('/qr', (req, res) => {
  if (!qrCodeData) {
    return res.status(404).json({ error: 'No QR available. Already authenticated or not ready.' });
  }
  res.json({ qr: qrCodeData, state: clientState });
});

// Enviar mensaje
app.post('/send', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing "to" or "message"' });
  }

  try {
    const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
    const sent = await client.sendMessage(chatId, message);
    res.json({ success: true, messageId: sent.id.id });
  } catch (err) {
    console.error('[WA] Error enviando:', err);
    res.status(500).json({ error: err.message });
  }
});

// Iniciar
app.listen(PORT, () => {
  console.log(`[WA] Service running on port ${PORT}`);
  client.initialize();
});
```

### `assets/docker/whatsapp-service/Dockerfile`

```dockerfile
FROM node:20-alpine

# Instalar dependencias de Puppeteer/Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

# Volumen para persistir sesión
VOLUME ["/app/session"]

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node src/healthcheck.js || exit 1

CMD ["npm", "start"]
```

### `assets/docker/whatsapp-service/src/healthcheck.js`

```javascript
import http from 'http';

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  }
  process.exit(1);
});

req.on('error', () => process.exit(1));
req.on('timeout', () => { req.destroy(); process.exit(1); });
req.end();
```

### `assets/docker/whatsapp-service/docker-compose.yml`

```yaml
version: '3.8'

services:
  whatsapp-service:
    build: .
    container_name: allmedic-whatsapp
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - WEBHOOK_URL=http://host.docker.internal:3000/api/webhooks/whatsapp
      - NODE_ENV=production
    volumes:
      - whatsapp-session:/app/session
    # Limitar recursos para KVM2
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
    healthcheck:
      test: ["CMD", "node", "src/healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

volumes:
  whatsapp-session:
    driver: local
```

---

## 4. Implementación con `@whiskeysockets/baileys` (Alternativa Ligera)

```javascript
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import express from 'express';
import axios from 'axios';
import qrcode from 'qrcode-terminal';

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.json());

let sock = null;
let qrCodeData = null;
let clientState = 'initializing';

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('/app/session/baileys');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ['Allmedic Dashboard', 'Chrome', '1.0'],
    // Keep alive
    keepAliveIntervalMs: 30000,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodeData = qr;
      clientState = 'qr_ready';
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
        : true;

      clientState = 'disconnected';
      console.log('[BAILEYS] Desconectado. Reconectando:', shouldReconnect);

      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 5000);
      }
    } else if (connection === 'open') {
      clientState = 'ready';
      qrCodeData = null;
      console.log('[BAILEYS] Conexión abierta.');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;

      const payload = {
        type: 'message',
        from: msg.key.remoteJid,
        body: msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
        timestamp: msg.messageTimestamp,
        messageId: msg.key.id,
        hasMedia: !!msg.message?.imageMessage || !!msg.message?.videoMessage,
      };

      try {
        await axios.post(WEBHOOK_URL, payload, { timeout: 10000 });
      } catch (err) {
        console.error('[BAILEYS] Webhook error:', err.message);
      }
    }
  });
}

// Endpoints Express (igual que whatsapp-web.js)
app.get('/health', (req, res) => {
  res.json({ status: clientState === 'ready' ? 'healthy' : 'degraded', state: clientState });
});

app.get('/qr', (req, res) => {
  if (!qrCodeData) return res.status(404).json({ error: 'No QR' });
  res.json({ qr: qrCodeData });
});

app.post('/send', async (req, res) => {
  const { to, message } = req.body;
  try {
    const sent = await sock.sendMessage(to, { text: message });
    res.json({ success: true, messageId: sent.key.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[BAILEYS] Service on port ${PORT}`);
  connectToWhatsApp();
});
```

---

## 5. Endpoint Webhook en Next.js

### `src/app/api/webhooks/whatsapp/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { messages, conversations } from '@/db/schema/chats';
import { eq, and } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Buscar o crear conversación
  const existing = await db.select()
    .from(conversations)
    .where(and(
      eq(conversations.channel, 'whatsapp'),
      eq(conversations.externalId, body.from)
    ))
    .limit(1);

  let conversationId;
  if (existing.length === 0) {
    const [conv] = await db.insert(conversations).values({
      channel: 'whatsapp',
      externalId: body.from,
      customerPhone: body.from.replace('@c.us', ''),
      status: 'OPEN',
    }).returning({ id: conversations.id });
    conversationId = conv.id;
  } else {
    conversationId = existing[0].id;
  }

  // Guardar mensaje
  await db.insert(messages).values({
    conversationId,
    source: 'whatsapp',
    direction: 'inbound',
    content: body.body,
    metadata: { waMessageId: body.messageId },
  });

  // Actualizar lastMessageAt
  await db.update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return NextResponse.json({ success: true });
}
```

---

## 6. Keep-Alive Mechanism

1. **Docker Healthcheck**: Revisa `/health` cada 30s. Si falla 3 veces, reinicia el contenedor.
2. **Baileys keepAliveIntervalMs**: Ping automático cada 30s al socket de WA.
3. **whatsapp-web.js**: El `Client` maneja reconexión automática en evento `disconnected`.
4. **Monitor externo** (opcional): EasyPanel puede configurar healthcheck HTTP al puerto 8080.

---

## 7. Optimización para KVM2 (RAM limitada)

| Optimización | Comando/Config |
|--------------|----------------|
| Limitar memoria Docker | `deploy.resources.limits.memory: 512M` |
| Limitar CPU Docker | `deploy.resources.limits.cpus: '0.5'` |
| Puppeteer sin sandbox | `--no-sandbox --disable-setuid-sandbox` |
| Limitar heap JS | `--js-flags=--max-old-space-size=256` |
| Usar Alpine Linux | `node:20-alpine` (imagen base ~150MB) |
| No descargar Chromium | `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` |
| Usar Chromium del sistema | `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` |
| Single process | `--single-process` (reduce overhead) |

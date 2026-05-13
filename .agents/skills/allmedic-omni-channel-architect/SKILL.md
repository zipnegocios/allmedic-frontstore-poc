---
name: allmedic-omni-channel-architect
description: >
  Arquitectura completa para transformar una tienda Next.js + Prisma/MySQL en una
  plataforma omnicanal con Dashboard Admin, WhatsApp Web (no WABA), Instagram Graph API,
  PostgreSQL + pgvector, y RAG para respuestas inteligentes. Usar cuando el usuario
  necesite: (1) Migrar de MySQL a PostgreSQL con Drizzle ORM, (2) Implementar un Dashboard
  administrativo con Unified Inbox, (3) Integrar WhatsApp Web vía QR en Docker separado
  (sin WABA), (4) Conectar Instagram DMs/Comments via Graph API webhooks, (5) Configurar
  búsqueda semántica con pgvector y embeddings OpenAI, (6) Desplegar en EasyPanel/KVM2
  con optimización de recursos, o (7) Centralizar atención al cliente (ATC) con IA.
---

# Allmedic Omni-Channel Architect

> Skill para transformar Allmedic Frontstore (Next.js 16 + Prisma/MySQL) en una plataforma
> omnicanal con Dashboard Admin, WhatsApp Web, Instagram, PostgreSQL + pgvector y RAG.

---

## Quick Start — Árbol de Decisiones

```
¿Qué necesitas hacer?
│
├─► Migrar DB (MySQL → PostgreSQL)
│   └─► Leer references/SCHEMA_MIGRATION.md
│
├─► Integrar WhatsApp Web (QR, no WABA)
│   └─► Leer references/WHATSAPP_SERVICE.md
│   └─► Usar assets/docker/whatsapp-service/
│
├─► Integrar Instagram (DMs + Comments)
│   └─► Leer references/INSTAGRAM_WEBHOOKS.md
│
├─► Búsqueda semántica / RAG / Embeddings
│   └─► Leer references/RAG_VECTOR_SEARCH.md
│   └─► Ejecutar scripts/generate-embeddings.ts
│
├─► Construir Dashboard Admin / Unified Inbox
│   └─► Leer references/DASHBOARD_UI.md
│
├─► Seguridad, tokens, env vars, compliance
│   └─► Leer references/SECURITY_COMPLIANCE.md
│
└─► Todo lo anterior (implementación completa)
    └─► Seguir el orden: DB → Auth → WA → IG → RAG → Dashboard
```

---

## Reglas de Oro (Compliance)

1. **WhatsApp Web Protocol**: NUNCA usar WABA. Implementar `whatsapp-web.js` o `@whiskeysockets/baileys`
   dentro de un servicio Docker separado en EasyPanel. Persistir sesión del QR en volumen.
2. **Social Integration**: Centralizar DMs y comments de Instagram en tabla `conversations` unificada.
3. **Drizzle & Modular Schema**: Mantener `src/db/schema/` modular. Añadir `chats.ts` y `messages.ts`
   con soporte para vectores (`vector(1536)`).
4. **EasyPanel Resource Management**: En KVM2, limitar caché de medios de WhatsApp (max 500MB)
   y usar healthchecks de Docker.
5. **Security**: Tokens de IG y sesiones de WA en Postgres o Redis. NUNCA en código.

---

## Stack Tecnológico Target

| Capa | Tecnología | Versión / Notas |
|------|-----------|-----------------|
| Framework | Next.js (App Router) | 16.2.2 (existente) |
| React | React | 19.2.0 (existente) |
| ORM | Drizzle ORM | Última estable |
| DB | PostgreSQL | 15+ con pgvector |
| Auth | Auth.js (NextAuth v5) | `next-auth@beta` + Drizzle Adapter |
| WhatsApp | `whatsapp-web.js` o `baileys` | Servicio Docker separado |
| Instagram | Graph API Webhooks | Meta for Developers |
| Embeddings | OpenAI `text-embedding-3-small` | 1536 dims |
| Vector Search | pgvector + Drizzle | `cosineDistance()` |
| UI | shadcn/ui (existente) | Server Components por defecto |
| Realtime | Server-Sent Events / Polling | Para chat en vivo (KVM2 compatible) |

---

## Fases de Implementación

### Fase 1: Fundación (Semana 1)
1. Migrar Prisma → Drizzle ORM
2. Migrar MySQL → PostgreSQL + pgvector
3. Configurar Auth.js v5 con Drizzle Adapter
4. Crear schema modular en `src/db/schema/`

### Fase 2: WhatsApp + Instagram (Semana 2)
1. Desplegar servicio Docker de WhatsApp Web
2. Implementar webhook receptor en Next.js (`/api/webhooks/whatsapp`)
3. Configurar Instagram Graph API + webhooks (`/api/webhooks/instagram`)
4. Unificar mensajes en tabla `messages`

### Fase 3: RAG + Embeddings (Semana 3)
1. Añadir columna `embedding vector(1536)` a `products` y `messages`
2. Crear middleware que genere embeddings en insert/update
3. Implementar `cosineDistance` search en API routes
4. Cargar PDFs de catálogo médico para contexto RAG

### Fase 4: Dashboard Admin (Semana 4)
1. Crear layout admin con sidebar (`src/app/admin/layout.tsx`)
2. Implementar Unified Inbox (`/admin/inbox`)
3. Crear vista de leads, productos, analytics
4. Agregar sugerencias de respuesta IA en el chat

---

## Estructura de Archivos Target (Post-Implementación)

```
src/
├── app/
│   ├── (admin)/
│   │   ├── admin/
│   │   │   ├── login/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── inbox/page.tsx          # Unified Inbox
│   │   │   ├── products/page.tsx
│   │   │   ├── leads/page.tsx
│   │   │   └── analytics/page.tsx
│   │   └── layout.tsx                  # Admin layout + sidebar
│   ├── (store)/                        # Tienda actual (sin cambios)
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── webhooks/
│       │   ├── whatsapp/route.ts
│       │   └── instagram/route.ts
│       ├── chat/
│       │   ├── conversations/route.ts
│       │   └── messages/route.ts
│       └── search/semantic/route.ts    # Búsqueda vectorial
├── db/
│   ├── schema/
│   │   ├── index.ts                    # Exporta todo
│   │   ├── auth.ts                     # Auth.js tables
│   │   ├── products.ts                 # Productos + embeddings
│   │   ├── chats.ts                    # Conversations + messages
│   │   └── core.ts                     # Brands, Stores, etc.
│   ├── index.ts                        # Drizzle client
│   └── migrations/                     # Drizzle migrations
├── components/
│   ├── admin/                          # Sidebar, StatCards, etc.
│   └── chat/                           # ChatWidget, MessageBubble
├── lib/
│   ├── auth.ts                         # Auth.js config
│   ├── embeddings.ts                   # OpenAI embedding utils
│   ├── vector-search.ts                # cosineDistance helpers
│   └── whatsapp-webhook.ts             # Parse WA webhooks
└── hooks/
    ├── useAuth.ts
    └── useChat.ts
```

---

## Referencias Disponibles

| Archivo | Cuándo leer |
|---------|-------------|
| [references/SCHEMA_MIGRATION.md](references/SCHEMA_MIGRATION.md) | Al migrar MySQL → PostgreSQL o crear schema Drizzle |
| [references/WHATSAPP_SERVICE.md](references/WHATSAPP_SERVICE.md) | Al integrar WhatsApp Web vía QR |
| [references/INSTAGRAM_WEBHOOKS.md](references/INSTAGRAM_WEBHOOKS.md) | Al conectar Instagram DMs/Comments |
| [references/RAG_VECTOR_SEARCH.md](references/RAG_VECTOR_SEARCH.md) | Al implementar búsqueda semántica o RAG |
| [references/DASHBOARD_UI.md](references/DASHBOARD_UI.md) | Al construir el Dashboard Admin / Unified Inbox |
| [references/SECURITY_COMPLIANCE.md](references/SECURITY_COMPLIANCE.md) | Al configurar tokens, auth, env vars |

---

## Scripts Disponibles

| Script | Propósito |
|--------|-----------|
| [scripts/mysql-to-postgres-etl.ts](scripts/mysql-to-postgres-etl.ts) | ETL: migra datos de MySQL a PostgreSQL con transformaciones |
| [scripts/generate-embeddings.ts](scripts/generate-embeddings.ts) | Genera embeddings para productos existentes vía OpenAI |
| [scripts/whatsapp-keep-alive.js](scripts/whatsapp-keep-alive.js) | Healthcheck para el contenedor Docker de WhatsApp |

---

## Assets Disponibles

| Asset | Propósito |
|-------|-----------|
| [assets/docker/whatsapp-service/Dockerfile](assets/docker/whatsapp-service/Dockerfile) | Contenedor Docker para el servicio de WhatsApp Web |
| [assets/docker/whatsapp-service/docker-compose.yml](assets/docker/whatsapp-service/docker-compose.yml) | Compose con healthcheck y volumen de sesión |
| [assets/docker/whatsapp-service/package.json](assets/docker/whatsapp-service/package.json) | Dependencias del servicio (whatsapp-web.js o baileys) |

---

## Notas de Riesgo

1. **Credenciales expuestas**: El archivo `.env` del proyecto actual tiene credenciales de producción comiteadas. Rotar inmediatamente antes de cualquier migración.
2. **Prisma en cliente**: `src/lib/prisma.ts` usa `process.env` sin verificar `typeof window`. Con Drizzle, usar `src/db/index.ts` solo en Server Components / API routes.
3. **Hostinger shared hosting**: WebSockets nativos no funcionan. Usar SSE o polling para chat en vivo.
4. **KVM2 RAM limit**: El contenedor de WhatsApp con Puppeteer puede consumir 300-500MB. Limitar con `--memory=512m` en Docker.
5. **Meta App Review**: Instagram Graph API requiere app review para webhooks de DMs en producción.

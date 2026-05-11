# AllMedic Frontstore — Guía de Deploy en EasyPanel

> **Última actualización:** 2026-05-11  
> **Stack:** Next.js 16.2.2 + React 19 + Drizzle ORM + PostgreSQL 15+  
> **Imagen Docker:** Node 22 Alpine (multi-stage build)

---

## 📋 Índice

1. [Arquitectura del Deploy](#1-arquitectura-del-deploy)
2. [Paso 0: Preparar el repositorio](#2-paso-0-preparar-el-repositorio)
3. [Paso 1: Crear el servicio PostgreSQL](#3-paso-1-crear-el-servicio-postgresql)
4. [Paso 2: Crear el servicio de la App](#4-paso-2-crear-el-servicio-de-la-app)
5. [Paso 3: Configurar Autodeploy](#5-paso-3-configurar-autodeploy)
6. [Paso 4: Configurar dominio y SSL](#6-paso-4-configurar-dominio-y-ssl)
7. [Paso 5: Verificar el deploy](#7-paso-5-verificar-el-deploy)
8. [Paso 6: Poblar la base de datos](#8-paso-6-poblar-la-base-de-datos)
9. [Variables de entorno completas](#9-variables-de-entorno-completas)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Arquitectura del Deploy

```
┌─────────────────────────────────────────────────────────────┐
│                    EasyPanel (Hostinger KVM2)                │
│  ┌─────────────────┐      ┌─────────────────────────────┐  │
│  │  PostgreSQL 15  │◄────►│  Next.js 16 (Docker)        │  │
│  │  + pgvector     │      │  • Puerto: 3000             │  │
│  │  • Puerto: 5432 │      │  • Healthcheck: /api/health │  │
│  │  • Red interna  │      │  • Fallback: dummy data     │  │
│  └─────────────────┘      └─────────────────────────────┘  │
│           ▲                            ▲                    │
│           │                            │                    │
│     Puerto externo                 Nginx Proxy              │
│     (para desarrollo)          + SSL (Let's Encrypt)       │
│     31.220.56.1:5435           allmedic.tu-dominio.com     │
└─────────────────────────────────────────────────────────────┘
```

**Principio clave:** La app se conecta a PostgreSQL usando el **nombre del servicio** como host (DNS interno de Docker), no la IP pública. Esto es más rápido, seguro y no depende del firewall.

---

## 2. Paso 0: Preparar el repositorio

### 2.1 Asegurar que `.gitignore` incluye:

```gitignore
.env
.env.local
.env.*.local
.env.easypanel
```

### 2.2 Subir cambios al repositorio remoto

```bash
git add .
git commit -m "chore: add Docker config for EasyPanel deploy"
git push origin main
```

> **Nota:** El repositorio debe estar en GitHub, GitLab o Gitea para que EasyPanel pueda hacer autodeploy.

---

## 3. Paso 1: Crear el servicio PostgreSQL

### 3.1 En EasyPanel, ir a **Services → Create Service**

### 3.2 Seleccionar **PostgreSQL**

| Campo | Valor |
|-------|-------|
| **Service Name** | `postgres` (o el nombre que prefieras) |
| **Image** | `postgres:15-alpine` |
| **Port** | `5432` |

### 3.3 Configurar Environment Variables

```
POSTGRES_USER=amuUser
POSTGRES_PASSWORD=TU_PASSWORD_SEGURA_AQUI
POSTGRES_DB=amuData
```

### 3.4 Configurar Volumes

```
/var/lib/postgresql/data  →  postgres-data
```

### 3.5 Habilitar pgvector (extensión vectorial)

En la pestaña **Commands**, añadir el comando de inicialización:

```bash
# Esto se ejecuta al crear el contenedor
# La extensión pgvector se instala desde el paquete postgresql15-contrib
apk add --no-cache postgresql15-pgvector && \
  psql -U amuUser -d amuData -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

> **Alternativa:** Usa la imagen `ankane/pgvector:latest` en lugar de `postgres:15-alpine` (ya incluye pgvector).

### 3.6 Guardar y esperar a que el servicio esté **Running**

---

## 4. Paso 2: Crear el servicio de la App

### 4.1 En EasyPanel, ir a **Services → Create Service**

### 4.2 Seleccionar **Docker**

| Campo | Valor |
|-------|-------|
| **Service Name** | `allmedic-frontstore` |
| **Build Type** | `Git Repository` |
| **Repository URL** | `https://github.com/TU_USUARIO/allmedic-frontstore.git` |
| **Branch** | `main` |
| **Dockerfile Path** | `Dockerfile` |

### 4.3 Configurar Environment Variables

Copia y pega **TODAS** las variables de la sección [9. Variables de entorno completas](#9-variables-de-entorno-completas).

**Las más importantes:**

```
# ─── Base de datos (conexión INTERNA entre contenedores) ───
DB_USER=amuUser
DB_PASSWORD=TU_PASSWORD_SEGURA_AQUI
DB_HOST=postgres              # ← NOMBRE DEL SERVICIO POSTGRESQL
DB_PORT=5432
DB_NAME=amuData

# ─── Auth ───
AUTH_SECRET=TU_SECRET_DE_32_CHARS_MINIMO
AUTH_TRUST_HOST=true

# ─── WhatsApp ───
NEXT_PUBLIC_WHATSAPP_NUMBER=13164695701
VITE_WHATSAPP_NUMBER=13164695701

# ─── App ───
NODE_ENV=production
PORT=3000
FORCE_DUMMY_DATA=false
```

> **⚠️ CRÍTICO:** `DB_HOST` debe ser el **nombre del servicio PostgreSQL** (ej: `postgres`), NO la IP pública del servidor.

### 4.4 Configurar Healthcheck

EasyPanel detecta automáticamente el `HEALTHCHECK` del Dockerfile, pero puedes verificar:

- **Healthcheck Path:** `/api/health`
- **Port:** `3000`

### 4.5 Configurar Resources (recomendado)

| Recurso | Valor mínimo | Valor recomendado |
|---------|-------------|-------------------|
| **CPU** | 0.5 | 1.0 |
| **Memory** | 512 MB | 1 GB |
| **Disk** | 1 GB | 2 GB |

### 4.6 Guardar y esperar a que el build termine

El primer build tarda ~3-5 minutos porque descarga dependencias y compila Next.js.

---

## 5. Paso 3: Configurar Autodeploy

### 5.1 En el servicio de la app, ir a la pestaña **Settings → Webhooks**

### 5.2 Copiar la URL del webhook

Se verá algo así:
```
https://easypanel.tu-dominio.com/api/services/allmedic-frontstore/webhook/deploy?token=xxxxxxxx
```

### 5.3 Configurar el webhook en tu repositorio Git

#### GitHub:
1. Ir al repo → **Settings → Webhooks → Add webhook**
2. **Payload URL:** Pega la URL de EasyPanel
3. **Content type:** `application/json`
4. **Events:** Selecciona `Just the push event`
5. **Active:** ✅
6. Click **Add webhook**

#### GitLab:
1. Ir al repo → **Settings → Webhooks**
2. **URL:** Pega la URL de EasyPanel
3. **Trigger:** Selecciona `Push events` (branch: `main`)
4. **SSL verification:** ✅
5. Click **Add webhook**

### 5.4 Verificar el autodeploy

Haz un push a `main`:
```bash
git commit --allow-empty -m "test: trigger autodeploy"
git push origin main
```

En EasyPanel deberías ver:
- Un nuevo build en la pestaña **Builds**
- El servicio se reinicia automáticamente al terminar

---

## 6. Paso 4: Configurar dominio y SSL

### 6.1 En EasyPanel, ir al servicio de la app → **Domains**

### 6.2 Añadir dominio personalizado

| Campo | Valor |
|-------|-------|
| **Domain** | `allmedic.tu-dominio.com` |
| **SSL** | ✅ Let's Encrypt (auto) |
| **Force HTTPS** | ✅ Recomendado |

### 6.3 Configurar DNS

En tu proveedor de dominio, crea un registro **A**:

```
Tipo: A
Nombre: allmedic (o @ para root)
Valor: 31.220.56.1   ← IP pública de tu servidor EasyPanel
TTL: 3600
```

### 6.4 Actualizar AUTH_URL (si usas OAuth)

```
AUTH_URL=https://allmedic.tu-dominio.com
```

Guarda y reinicia el servicio.

---

## 7. Paso 5: Verificar el deploy

### 7.1 Healthcheck

```bash
curl https://allmedic.tu-dominio.com/api/health
```

Respuesta esperada:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-11T...",
  "checks": {
    "http": { "status": "ok", "latency": 0 },
    "database": { "status": "ok", "latency": 12 }
  }
}
```

### 7.2 Páginas principales

| URL | Qué verificar |
|-----|--------------|
| `/` | Home con productos destacados |
| `/catalogo` | Catálogo con filtros |
| `/marcas` | Marcas con logos |
| `/p/figs-casma-scrub-top` | Detalle de producto |
| `/api/health` | Healthcheck JSON |

### 7.3 Logs

En EasyPanel → Servicio → **Logs**, verifica que no hay errores críticos.

---

## 8. Paso 6: Poblar la base de datos

### 8.1 Ejecutar `db:push` (crear tablas)

En EasyPanel, ve al servicio de la app → **Terminal** (o usa SSH):

```bash
# Dentro del contenedor de la app
npx drizzle-kit push
```

O desde el host (si tienes acceso SSH):
```bash
docker exec -it allmedic-frontstore npx drizzle-kit push
```

### 8.2 Ejecutar `db:seed` (poblar con datos)

```bash
# Dentro del contenedor
npx tsx src/db/seed.ts
```

O desde el host:
```bash
docker exec -it allmedic-frontstore npx tsx src/db/seed.ts
```

### 8.3 Verificar datos

```bash
# Conectarse a PostgreSQL
docker exec -it postgres psql -U amuUser -d amuData

# Dentro de psql
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM brands;
SELECT COUNT(*) FROM product_variants;
\q
```

---

## 9. Variables de entorno completas

Copia y pega **TODAS** estas variables en EasyPanel → Servicio → Environment:

```
# ═══════════════════════════════════════════════════════
# BASE DE DATOS — Conexión INTERNA (entre contenedores)
# ═══════════════════════════════════════════════════════
DB_USER=amuUser
DB_PASSWORD=TU_PASSWORD_SEGURA_AQUI
DB_HOST=postgres
DB_PORT=5432
DB_NAME=amuData

# ═══════════════════════════════════════════════════════
# AUTENTICACIÓN — NextAuth.js v5
# ═══════════════════════════════════════════════════════
AUTH_SECRET=TU_SECRET_DE_32_CHARS_MINIMO
AUTH_TRUST_HOST=true
AUTH_URL=https://allmedic.tu-dominio.com

# ═══════════════════════════════════════════════════════
# WHATSAPP
# ═══════════════════════════════════════════════════════
NEXT_PUBLIC_WHATSAPP_NUMBER=13164695701
VITE_WHATSAPP_NUMBER=13164695701

# ═══════════════════════════════════════════════════════
# OPENAI (opcional)
# ═══════════════════════════════════════════════════════
OPENAI_API_KEY=sk-tu-openai-key

# ═══════════════════════════════════════════════════════
# INSTAGRAM (opcional)
# ═══════════════════════════════════════════════════════
IG_APP_SECRET=tu-app-secret
IG_VERIFY_TOKEN=tu-verify-token
IG_ACCESS_TOKEN=tu-access-token
IG_PAGE_ID=tu-page-id

# ═══════════════════════════════════════════════════════
# WHATSAPP WEB SERVICE (opcional)
# ═══════════════════════════════════════════════════════
WA_WEBHOOK_URL=https://wa-service.tu-dominio.com
WA_SERVICE_URL=https://wa-service.tu-dominio.com

# ═══════════════════════════════════════════════════════
# APP CONFIG
# ═══════════════════════════════════════════════════════
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
FORCE_DUMMY_DATA=false
```

---

## 10. Troubleshooting

### ❌ "Database configuration missing"

**Causa:** Faltan variables `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_NAME`.

**Solución:** Verifica que todas las variables de la sección "Base de Datos" estén configuradas en EasyPanel.

---

### ❌ "ECONNREFUSED" al conectar a PostgreSQL

**Causa:** La app intenta conectar a la IP pública en lugar del nombre del servicio.

**Solución:**
1. Cambia `DB_HOST` de `31.220.56.1` a `postgres` (nombre del servicio)
2. Cambia `DB_PORT` de `5435` a `5432` (puerto interno)
3. Reinicia el servicio de la app

---

### ❌ El build tarda mucho o falla

**Causa:** Falta memoria o CPU.

**Solución:**
- Aumenta Memory a **1 GB** mínimo
- Aumenta CPU a **1.0**
- El primer build siempre tarda más (descarga dependencias)

---

### ❌ Las imágenes de productos no cargan (404)

**Causa:** Las imágenes están en `public/images/` pero Next.js las sirve desde `/_next/static`.

**Solución:** Verifica que `images.unoptimized: true` está en `next.config.ts`. Esto ya está configurado.

---

### ❌ Autodeploy no funciona

**Causa:** El webhook no está configurado correctamente.

**Solución:**
1. Verifica la URL del webhook en EasyPanel → Settings → Webhooks
2. Verifica que el webhook en GitHub/GitLab responde con 200
3. En GitHub → Webhooks → Recent Deliveries, verifica que hay entregas exitosas

---

### ❌ "unauthorized" al hacer `drizzle-kit push`

**Causa:** La contraseña tiene caracteres especiales que no están URL-encoded.

**Solución:** La app construye la URL automáticamente con `encodeURIComponent()`. Si usas `DATABASE_URL` manualmente, codifica:
- `#` → `%23`
- `$` → `%24`
- `@` → `%40`
- `&` → `%26`

---

### ❌ Healthcheck devuelve `"database": { "status": "fail" }`

**Causa:** PostgreSQL no responde, pero la app sigue funcionando con dummy data.

**Solución:** Esto es **normal** si aún no has ejecutado `db:push`. La app tiene fallback a datos dummy. Ejecuta:
```bash
docker exec -it allmedic-frontstore npx drizzle-kit push
docker exec -it allmedic-frontstore npx tsx src/db/seed.ts
```

---

## 📎 Referencias

- [EasyPanel Docs](https://easypanel.io/docs)
- [Next.js Docker Deployment](https://nextjs.org/docs/app/building-your-application/deploying#docker-image)
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations)
- [NextAuth.js v5](https://authjs.dev/getting-started/installation)

# SECURITY_COMPLIANCE.md — Seguridad, Tokens y Variables de Entorno

> Guía para manejar de forma segura tokens, sesiones, secrets y variables de entorno
> en la plataforma Allmedic omnicanal.

---

## 1. Variables de Entorno Requeridas

### `.env.local` (nunca comitear)

```bash
# === DATABASE ===
DATABASE_URL="postgresql://user:password@localhost:5432/allmedic?sslmode=require"

# === AUTH.JS ===
AUTH_SECRET="openssl rand -base64 32"  # Mínimo 32 chars
AUTH_URL="http://localhost:3000"

# === OPENAI ===
OPENAI_API_KEY="sk-..."

# === WHATSAPP WEB SERVICE ===
WA_WEBHOOK_URL="http://localhost:8080"
WA_SERVICE_URL="http://localhost:8080"

# === INSTAGRAM GRAPH API ===
IG_APP_SECRET="..."
IG_VERIFY_TOKEN="openssl rand -base64 32"
IG_ACCESS_TOKEN="..."
IG_PAGE_ID="..."

# === NEXT.JS (legacy) ===
NEXT_PUBLIC_WHATSAPP_NUMBER="13164695701"
```

### `.env` (solo defaults, sin secrets)

```bash
# Este archivo PUEDE estar en el repo, solo con defaults públicos
NODE_ENV=development
```

---

## 2. Rotación de Credenciales Actuales

### Problema crítico identificado
El archivo `.env` del proyecto tiene credenciales de producción comiteadas:
```
DB_USER=u742656042_amuname
DB_PASSWORD=AllMedic_2026_Secure_Inventory
DB_HOST=srv1505.hstgr.io
```

### Acciones inmediatas

1. **Rotar password de MySQL** en Hostinger panel
2. **Mover `.env` a `.env.local`** y añadir a `.gitignore`
3. **Borrar `.env` del historial de Git**:
   ```bash
   git rm --cached .env
   git commit -m "security: remove .env from git history"
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch .env' \
     --prune-empty --tag-name-filter cat -- --all
   ```
4. **Añadir a `.gitignore`**:
   ```
   .env
   .env.local
   .env.*.local
   ```

---

## 3. Auth.js v5 Configuration

### `src/lib/auth.ts`

```typescript
import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/db';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { users } from '@/db/schema/auth';
import { eq } from 'drizzle-orm';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: DrizzleAdapter(db),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .limit(1);

        if (!user.length || !user[0].password) return null;

        const valid = await compare(credentials.password as string, user[0].password);
        if (!valid) return null;

        return {
          id: user[0].id,
          email: user[0].email,
          name: user[0].name,
          role: user[0].role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.role) {
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
```

---

## 4. Middleware de Protección

### `src/middleware.ts`

```typescript
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;

  const isAdminRoute = nextUrl.pathname.startsWith('/admin');
  const isApiAuthRoute = nextUrl.pathname.startsWith('/api/auth');

  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  if (isAdminRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL('/admin/login', nextUrl));
  }

  if (isAdminRoute && userRole !== 'SUPER_ADMIN' && userRole !== 'CATALOG_MANAGER') {
    return NextResponse.redirect(new URL('/', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
```

---

## 5. Almacenamiento Seguro de Tokens

### WhatsApp Session
- **Nunca** guardar en código o env vars
- Usar volumen Docker persistente: `/app/session`
- Backup periódico del volumen
- Si se usa baileys: `useMultiFileAuthState('/app/session')`

### Instagram Access Token
- Guardar en `.env.local` (no comiteado)
- Implementar refresh automático:
  ```typescript
  // src/lib/instagram-token-manager.ts
  export async function refreshAccessToken(currentToken: string): Promise<string> {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${process.env.IG_APP_ID}&` +
      `client_secret=${process.env.IG_APP_SECRET}&` +
      `fb_exchange_token=${currentToken}`
    );
    const data = await res.json();
    return data.access_token;
  }
  ```

### OpenAI API Key
- Guardar en `.env.local`
- Usar rate limiting en API routes:
  ```typescript
  // src/lib/rate-limit.ts
  import { LRUCache } from 'lru-cache';

  const rateLimitCache = new LRUCache<string, number>({
    max: 500,
    ttl: 60 * 1000, // 1 minuto
  });

  export function rateLimit(identifier: string, maxRequests: number = 10): boolean {
    const current = rateLimitCache.get(identifier) || 0;
    if (current >= maxRequests) return false;
    rateLimitCache.set(identifier, current + 1);
    return true;
  }
  ```

---

## 6. Headers de Seguridad

### `next.config.ts`

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ... existing config
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.openai.com https://graph.facebook.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

## 7. Validación de Webhooks

### Instagram
SIEMPRE verificar firma HMAC-SHA256:
```typescript
function verifySignature(body: string, signature: string, appSecret: string): boolean {
  const expected = createHmac('sha256', appSecret).update(body, 'utf8').digest('hex');
  return signature === `sha256=${expected}`;
}
```

### WhatsApp
Validar que el webhook viene del servicio autorizado:
```typescript
// Usar IP whitelist o shared secret
const WEBHOOK_SECRET = process.env.WA_WEBHOOK_SECRET;
```

---

## 8. Checklist de Seguridad Pre-Deploy

- [ ] `.env.local` en `.gitignore`
- [ ] `AUTH_SECRET` generado con `openssl rand -base64 32`
- [ ] Passwords hasheados con bcrypt (mínimo 10 rounds)
- [ ] Cookies con `httpOnly`, `secure`, `sameSite`
- [ ] Rate limiting en API routes
- [ ] CSP headers configurados
- [ ] Webhooks validan firma
- [ ] No hay `console.log` de secrets en producción
- [ ] Base de datos usa SSL (`sslmode=require`)
- [ ] WhatsApp service no expuesto públicamente (solo interno)

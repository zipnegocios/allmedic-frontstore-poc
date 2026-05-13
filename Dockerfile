# =============================================================================
# AllMedic Frontstore — Dockerfile para producción (EasyPanel / Hostinger KVM2)
# =============================================================================
# Stack: Next.js 16.2.2 + React 19 + TypeScript 5.9 + Drizzle ORM + PostgreSQL
# Node: 22 LTS (Alpine para imagen ligera)
# =============================================================================

# ─── STAGE 1: Dependencies ───
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copiar solo los archivos de dependencias para aprovechar cache de Docker
COPY package.json package-lock.json* ./
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# ─── STAGE 2: Builder ───
FROM node:22-alpine AS builder
WORKDIR /app

# Instalar dependencias completas (incluye devDependencies para build)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copiar código fuente
COPY . .

# Variables de entorno públicas necesarias en build time
# NEXT_PUBLIC_* se inyectan en el bundle del cliente
ARG NEXT_PUBLIC_WHATSAPP_NUMBER
ENV NEXT_PUBLIC_WHATSAPP_NUMBER=${NEXT_PUBLIC_WHATSAPP_NUMBER}
ENV NODE_ENV=production

# Construir la aplicación
RUN npm run build

# ─── STAGE 3: Runner ───
FROM node:22-alpine AS runner
WORKDIR /app

# Crear usuario no-root para seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar solo lo necesario desde el builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copiar node_modules de producción para que scripts/migrate.js funcione
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Copiar scripts de migración y entrypoint
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Verificar que server.js existe
RUN test -f server.js || (echo "ERROR: server.js not found" && exit 1)

# Healthcheck simple: solo verifica que el servidor HTTP responda
# No depende de la base de datos para evitar fallos durante el startup
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "import('http').then(({ get }) => { get('http://127.0.0.1:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1)) })"

# Puerto expuesto
EXPOSE 3000

# Variables de entorno en runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Cambiar al usuario no-root
USER nextjs

# Comando de inicio: ejecuta migraciones y luego inicia el servidor
ENTRYPOINT ["sh", "./scripts/start.sh"]

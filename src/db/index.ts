import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function getDatabaseUrl(): string {
  const rawUrl = process.env.DATABASE_URL;
  if (rawUrl?.startsWith('postgresql://') || rawUrl?.startsWith('postgres://')) {
    // Si la URL tiene caracteres especiales sin encodear en la contraseña,
    // parseamos manualmente para encodearla y reconstruir la URL limpia.
    try {
      const match = rawUrl.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@(.+)$/);
      if (match) {
        const [, user, password, rest] = match;
        return `postgresql://${user}:${encodeURIComponent(password)}@${rest}`;
      }
    } catch {
      // Si falla el parseo, devolvemos la URL original y que pg la intente
    }
    return rawUrl;
  }

  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME;

  if (!user || !password || !host || !database) {
    throw new Error(
      "Database configuration missing. Provide either DATABASE_URL (postgresql://...) or DB_USER, DB_PASSWORD, DB_HOST, DB_NAME"
    );
  }

  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

// ── Lazy initialization: no creamos el Pool hasta que se use ──
// Esto evita que el build falle cuando no hay variables de entorno disponibles.
let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: getDatabaseUrl() });
  }
  return _pool;
}

function getDb() {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

// Exportamos un proxy que crea el pool/db bajo demanda la primera vez
// que se accede a cualquier propiedad. Esto mantiene la API existente
// (db.select, db.insert, etc.) sin cambios en el resto del código.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return getDb()[prop as keyof typeof _db];
  },
}) as ReturnType<typeof drizzle<typeof schema>>;

// Exportamos la instancia real para casos donde se necesita el objeto DB
// directamente (ej: DrizzleAdapter de Auth.js que hace instanceof checks)
export function getDbInstance() {
  return getDb();
}

export type DB = typeof db;

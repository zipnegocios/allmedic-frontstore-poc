import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function getDatabaseUrl(): string {
  // Primero intentar DATABASE_URL (PostgreSQL)
  if (process.env.DATABASE_URL?.startsWith('postgresql://') || process.env.DATABASE_URL?.startsWith('postgres://')) {
    return process.env.DATABASE_URL;
  }
  // Fallback: construir desde variables individuales (compatibilidad con config anterior)
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

const pool = new Pool({ connectionString: getDatabaseUrl() });

export const db = drizzle(pool, { schema });
export type DB = typeof db;

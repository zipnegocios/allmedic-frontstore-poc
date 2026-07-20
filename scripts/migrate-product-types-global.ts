/**
 * Ejecuta la migración 0008_good_black_crow.sql (Tipos de Producto globales
 * reutilizables — PROMPT-tipos-atributos-globales.md) contra la base real, en
 * una sola transacción. `drizzle-kit push`/`migrate` no se usan aquí: el
 * proyecto no lleva tabla de tracking de migraciones (`__drizzle_migrations`
 * vacía, historial real aplicado vía `db:push` por diffing), y esta migración
 * mezcla DDL con DML (fusión de duplicados de `product_types`) que debe
 * ejecutarse en el orden exacto del archivo. Idempotente: sin duplicados que
 * fusionar, las sentencias de fusión no hacen nada.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getDatabaseUrl(): string {
  const rawUrl = process.env.DATABASE_URL;
  if (rawUrl) return rawUrl;
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT = "5432", DB_NAME } = process.env;
  if (!DB_USER || !DB_PASSWORD || !DB_HOST || !DB_NAME) throw new Error("Database configuration missing");
  return `postgresql://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
}

async function main() {
  const sqlPath = join(__dirname, "..", "src", "db", "migrations", "0008_good_black_crow.sql");
  const raw = readFileSync(sqlPath, "utf-8");
  const statements = raw.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);

  const pool = new Pool({ connectionString: getDatabaseUrl() });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const stmt of statements) {
      console.log("→", stmt.slice(0, 80).replace(/\s+/g, " "), "...");
      await client.query(stmt);
    }
    await client.query("COMMIT");
    console.log("✅ Migración 0008 aplicada.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Rollback:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

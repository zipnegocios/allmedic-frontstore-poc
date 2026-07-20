/**
 * Aplica un archivo de migración de `src/db/migrations/` contra la base real,
 * en una sola transacción, statement por statement. Este proyecto no usa
 * `drizzle-kit migrate` (la tabla `__drizzle_migrations` está vacía — el
 * historial real se aplicó siempre vía `db:push`/scripts ad-hoc), así que las
 * migraciones que mezclan DDL con DML deben aplicarse explícitamente así.
 *
 * Uso: npx tsx -r dotenv/config scripts/apply-migration.ts 0009_mushy_tempest.sql
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
  const filename = process.argv[2];
  if (!filename) throw new Error("Uso: apply-migration.ts <archivo.sql en src/db/migrations>");

  const sqlPath = join(__dirname, "..", "src", "db", "migrations", filename);
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
    console.log(`✅ ${filename} aplicada.`);
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

/**
 * One-off: puebla `brand_colors` (activación marca↔color) a partir del uso histórico
 * real — cada color que ya tiene variantes de productos de una marca queda vinculado
 * a esa marca, para no romper el picker de color al pasar a filtrado por marca.
 *
 * Idempotente: `ON CONFLICT (brand_id, color_id) DO NOTHING`, correr más de una vez
 * no duplica filas.
 *
 * Uso: npx tsx --env-file=.env.local scripts/backfill-brand-colors.ts [--dry-run]
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/db";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const preview = await db.execute(sql`
    SELECT COUNT(*)::int AS count FROM (
      SELECT DISTINCT p.brand_id, v.color_id
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      LEFT JOIN brand_colors bc ON bc.brand_id = p.brand_id AND bc.color_id = v.color_id
      WHERE bc.id IS NULL
    ) t
  `);
  const pending = Number((preview.rows[0] as { count: number }).count);
  console.log(`Vínculos marca↔color pendientes de crear: ${pending}`);

  if (DRY_RUN) {
    console.log("--dry-run: no se insertó nada.");
    return;
  }

  const result = await db.execute(sql`
    INSERT INTO brand_colors (id, brand_id, color_id)
    SELECT DISTINCT gen_random_uuid(), p.brand_id, v.color_id
    FROM product_variants v
    JOIN products p ON p.id = v.product_id
    ON CONFLICT (brand_id, color_id) DO NOTHING
  `);
  console.log(`Insertados: ${result.rowCount ?? 0}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

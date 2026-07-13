import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const taxPresetsData = [
  { name: "IVA 15%", rate: "15.00", pricesIncludeTaxDefault: true, sortOrder: 0 },
  { name: "IVA 0%", rate: "0.00", pricesIncludeTaxDefault: true, sortOrder: 1 },
  { name: "Exento", rate: "0.00", pricesIncludeTaxDefault: false, sortOrder: 2 },
];

const validityPresetsData = [
  { name: "7 días", days: 7, sortOrder: 0 },
  { name: "15 días", days: 15, sortOrder: 1 },
  { name: "30 días", days: 30, sortOrder: 2 },
];

async function seed() {
  console.log("🌱 Sembrando configuración de Cotizaciones Pro...");

  for (const preset of taxPresetsData) {
    await db
      .insert(schema.taxPresets)
      .values(preset)
      .onConflictDoNothing({ target: schema.taxPresets.name });
  }
  console.log(`  ✓ ${taxPresetsData.length} presets de impuestos`);

  for (const preset of validityPresetsData) {
    await db
      .insert(schema.validityPresets)
      .values(preset)
      .onConflictDoNothing({ target: schema.validityPresets.name });
  }
  console.log(`  ✓ ${validityPresetsData.length} presets de vigencia`);

  const existing = await db.select().from(schema.companySettings).limit(1);
  if (existing.length === 0) {
    await db.insert(schema.companySettings).values({
      razonSocial: "",
      ruc: "",
    });
    console.log("  ✓ fila singleton de company_settings creada");
  } else {
    console.log("  ✓ company_settings ya existía, sin cambios");
  }

  console.log("✅ Seed de Cotizaciones Pro completado.");
  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed falló:", err);
  process.exit(1);
});

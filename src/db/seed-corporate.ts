import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, isNull } from "drizzle-orm";
import * as schema from "./schema";
import { uuid } from "@/lib/uuid";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

// ── Reglas globales por defecto (sección 3.3 del plan) ──
const globalRulesData = [
  {
    name: "Mínimo de compra corporativa: 12 sets",
    ruleType: "MIN_QUANTITY",
    scope: "GLOBAL",
    config: { min: 12, countUnit: "SETS" },
  },
  {
    name: "Modo de tallas por defecto: matriz",
    ruleType: "SIZE_MODE",
    scope: "GLOBAL",
    config: { mode: "MATRIX" },
  },
  {
    name: "Visibilidad de precios: mostrar en ambos catálogos",
    ruleType: "PRICE_VISIBILITY",
    scope: "GLOBAL",
    config: { showPrices: true, catalog: "BOTH" },
  },
  {
    name: "Descuento por volumen — catálogo individual (default)",
    ruleType: "VOLUME_DISCOUNT_RETAIL",
    scope: "GLOBAL",
    config: {
      tiers: [
        { minItems: 3, pct: 10 },
        { minItems: 5, pct: 15 },
        { minItems: 10, pct: 20 },
      ],
    },
  },
];

async function seedGlobalRules() {
  console.log("  Insertando reglas globales por defecto...");
  for (const rule of globalRulesData) {
    const [existing] = await db
      .select({ id: schema.businessRules.id })
      .from(schema.businessRules)
      .where(
        and(
          eq(schema.businessRules.ruleType, rule.ruleType),
          eq(schema.businessRules.scope, "GLOBAL"),
          isNull(schema.businessRules.scopeId)
        )
      )
      .limit(1);

    if (existing) {
      console.log(`    - ${rule.ruleType} (GLOBAL) ya existe, se omite.`);
      continue;
    }

    await db.insert(schema.businessRules).values(rule);
    console.log(`    - ${rule.ruleType} (GLOBAL) creada.`);
  }
}

// ── Precios al mayor de ejemplo para productos usados en sets ──
async function seedWholesalePrices() {
  console.log("  Asignando precios al mayor de ejemplo...");
  const wholesalePrices: Record<string, { priceWholesale: string; priceWholesaleSale?: string; visibility: "BOTH" }> = {
    "figs-casma-scrub-top": { priceWholesale: "40.00", visibility: "BOTH" },
    "figs-yola-scrub-pants": { priceWholesale: "44.00", visibility: "BOTH" },
    "greys-anatomy-lexie-scrub-top": { priceWholesale: "32.00", visibility: "BOTH" },
    "koi-lindsey-scrub-pants": { priceWholesale: "35.00", visibility: "BOTH" },
    "cherokee-workwear-scrub-top": { priceWholesale: "20.00", priceWholesaleSale: "18.00", visibility: "BOTH" },
    "dickies-eds-scrub-top": { priceWholesale: "18.00", visibility: "BOTH" },
  };

  for (const [slug, prices] of Object.entries(wholesalePrices)) {
    await db
      .update(schema.products)
      .set(prices)
      .where(eq(schema.products.slug, slug));
  }
  console.log(`    - ${Object.keys(wholesalePrices).length} productos actualizados con precio al mayor.`);
}

// ── Sets corporativos de ejemplo ──
async function seedCorporateSets() {
  console.log("  Insertando sets corporativos de ejemplo...");

  // Buscar productos existentes por slug para armar los sets
  const productSlugs = [
    "figs-casma-scrub-top",
    "figs-yola-scrub-pants",
    "greys-anatomy-lexie-scrub-top",
    "koi-lindsey-scrub-pants",
    "cherokee-workwear-scrub-top",
    "dickies-eds-scrub-top",
  ];

  const products = await db
    .select({ id: schema.products.id, slug: schema.products.slug, brandId: schema.products.brandId })
    .from(schema.products);

  const productsBySlug = Object.fromEntries(products.filter(p => productSlugs.includes(p.slug)).map(p => [p.slug, p]));

  const figsProduct = productsBySlug["figs-casma-scrub-top"];

  const setsData = [
    {
      slug: "uniforme-figs-premium",
      name: "Uniforme FIGS Premium",
      description: "Camisa Casma + Pantalón Yola de FIGS. Set completo premium para profesionales de la salud.",
      brandId: figsProduct?.brandId ?? null,
      colorMode: "PAIRED" as const,
      isFeatured: true,
      items: [
        { slug: "figs-casma-scrub-top", quantityPerSet: 1 },
        { slug: "figs-yola-scrub-pants", quantityPerSet: 1 },
      ],
    },
    {
      slug: "uniforme-mixto-greys-koi",
      name: "Uniforme Mixto Grey's Anatomy + Koi",
      description: "Camisa Lexie de Grey's Anatomy + Pantalón Lindsey de Koi. Combinación versátil.",
      brandId: null,
      colorMode: "PAIRED" as const,
      isFeatured: false,
      items: [
        { slug: "greys-anatomy-lexie-scrub-top", quantityPerSet: 1 },
        { slug: "koi-lindsey-scrub-pants", quantityPerSet: 1 },
      ],
    },
    {
      slug: "pack-camisas-institucional",
      name: "Pack Camisas Institucional",
      description: "Pack de camisas Cherokee Workwear y Dickies EDS para instituciones y hospitales.",
      brandId: null,
      colorMode: "PAIRED" as const,
      isFeatured: true,
      items: [
        { slug: "cherokee-workwear-scrub-top", quantityPerSet: 2 },
        { slug: "dickies-eds-scrub-top", quantityPerSet: 1 },
      ],
    },
  ];

  for (const setData of setsData) {
    const { items, ...setFields } = setData;

    const [existing] = await db
      .select({ id: schema.corporateSets.id })
      .from(schema.corporateSets)
      .where(eq(schema.corporateSets.slug, setFields.slug))
      .limit(1);

    if (existing) {
      console.log(`    - Set "${setFields.name}" ya existe, se omite.`);
      continue;
    }

    const setId = uuid();
    await db.insert(schema.corporateSets).values({ id: setId, ...setFields });

    let sortOrder = 0;
    for (const item of items) {
      const product = productsBySlug[item.slug];
      if (!product) {
        console.warn(`    ⚠ Producto "${item.slug}" no encontrado, se omite del set.`);
        continue;
      }
      await db.insert(schema.setItems).values({
        id: uuid(),
        setId,
        productId: product.id,
        quantityPerSet: item.quantityPerSet,
        sortOrder: sortOrder++,
      });
    }

    console.log(`    - Set "${setFields.name}" creado con ${items.length} piezas.`);
  }
}

async function seedCorporate() {
  console.log("🌱 Iniciando seed corporativo (aditivo, no destructivo)...");

  await seedGlobalRules();
  await seedWholesalePrices();
  await seedCorporateSets();

  console.log("✅ Seed corporativo completado exitosamente.");
  await pool.end();
}

seedCorporate().catch((err) => {
  console.error("❌ Seed corporativo falló:", err);
  process.exit(1);
});

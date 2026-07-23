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

// ── Sets corporativos de ejemplo (modelo de bloques de alternancia) ──
// Cada set tiene exactamente 2 bloques (A y B), cada uno con exactamente 2 opciones — el
// cliente elige 1 opción por bloque. Si algún slug no existe en el catálogo actual, el bloque
// completo se omite con una advertencia (un set sin sus 2 bloques no queda utilizable, pero el
// seed es aditivo/best-effort y no debe fallar por catálogo incompleto).
async function seedCorporateSets() {
  console.log("  Insertando sets corporativos de ejemplo...");

  const productSlugs = [
    "figs-casma-scrub-top",
    "figs-catarina-scrub-top",
    "figs-yola-scrub-pants",
    "figs-livingston-scrub-pants",
    "greys-anatomy-lexie-scrub-top",
    "greys-anatomy-jane-scrub-top",
    "koi-lindsey-scrub-pants",
    "koi-morgan-scrub-pants",
    "cherokee-workwear-scrub-top",
    "cherokee-revolution-scrub-top",
    "dickies-eds-scrub-top",
    "dickies-gen-flex-scrub-top",
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
      description: "Camisa (Casma o Catarina) + Pantalón (Yola o Livingston) de FIGS. Set completo premium para profesionales de la salud.",
      brandId: figsProduct?.brandId ?? null,
      colorMode: "PAIRED" as const,
      isFeatured: true,
      blocks: [
        { blockCode: "A" as const, quantityPerSet: 1, optionSlugs: ["figs-casma-scrub-top", "figs-catarina-scrub-top"] },
        { blockCode: "B" as const, quantityPerSet: 1, optionSlugs: ["figs-yola-scrub-pants", "figs-livingston-scrub-pants"] },
      ],
      recommendedSlugs: [] as string[],
    },
    {
      slug: "uniforme-mixto-greys-koi",
      name: "Uniforme Mixto Grey's Anatomy + Koi",
      description: "Camisa (Lexie o Jane) de Grey's Anatomy + Pantalón (Lindsey o Morgan) de Koi. Combinación versátil.",
      brandId: null,
      colorMode: "PAIRED" as const,
      isFeatured: false,
      blocks: [
        { blockCode: "A" as const, quantityPerSet: 1, optionSlugs: ["greys-anatomy-lexie-scrub-top", "greys-anatomy-jane-scrub-top"] },
        { blockCode: "B" as const, quantityPerSet: 1, optionSlugs: ["koi-lindsey-scrub-pants", "koi-morgan-scrub-pants"] },
      ],
      recommendedSlugs: [] as string[],
    },
    {
      slug: "pack-camisas-institucional",
      name: "Pack Camisas Institucional",
      description: "Pack de camisas Cherokee Workwear/Revolution y Dickies EDS/Gen Flex para instituciones y hospitales.",
      brandId: null,
      colorMode: "PAIRED" as const,
      isFeatured: true,
      blocks: [
        { blockCode: "A" as const, quantityPerSet: 2, optionSlugs: ["cherokee-workwear-scrub-top", "cherokee-revolution-scrub-top"] },
        { blockCode: "B" as const, quantityPerSet: 1, optionSlugs: ["dickies-eds-scrub-top", "dickies-gen-flex-scrub-top"] },
      ],
      recommendedSlugs: [] as string[],
    },
  ];

  for (const setData of setsData) {
    const { blocks, recommendedSlugs, ...setFields } = setData;

    const [existing] = await db
      .select({ id: schema.corporateSets.id })
      .from(schema.corporateSets)
      .where(eq(schema.corporateSets.slug, setFields.slug))
      .limit(1);

    if (existing) {
      console.log(`    - Set "${setFields.name}" ya existe, se omite.`);
      continue;
    }

    // Cada bloque exige sus 2 opciones disponibles en el catálogo actual — si falta alguna, se
    // omite el bloque completo (y con él, el set: un set sin sus 2 bloques no es válido).
    const resolvedBlocks = blocks.map((block) => ({
      ...block,
      options: block.optionSlugs.map((slug) => productsBySlug[slug]).filter((p): p is NonNullable<typeof p> => !!p),
    }));
    const missingBlock = resolvedBlocks.find((b) => b.options.length < 2);
    if (missingBlock) {
      console.warn(`    ⚠ Set "${setFields.name}" omitido: Bloque ${missingBlock.blockCode} no tiene sus 2 opciones en el catálogo actual.`);
      continue;
    }

    const setId = uuid();
    await db.insert(schema.corporateSets).values({ id: setId, ...setFields });

    for (const block of resolvedBlocks) {
      const [insertedBlock] = await db.insert(schema.setBlocks).values({
        id: uuid(),
        setId,
        blockCode: block.blockCode,
        quantityPerSet: block.quantityPerSet,
      }).returning();

      await db.insert(schema.setBlockOptions).values(
        block.options.map((product, idx) => ({
          id: uuid(),
          blockId: insertedBlock.id,
          productId: product.id,
          sortOrder: idx,
        }))
      );
    }

    const recommendedProducts = recommendedSlugs.map((slug) => productsBySlug[slug]).filter((p): p is NonNullable<typeof p> => !!p);
    if (recommendedProducts.length > 0) {
      await db.insert(schema.setRecommendedItems).values(
        recommendedProducts.map((product, idx) => ({
          id: uuid(),
          setId,
          productId: product.id,
          sortOrder: idx,
        }))
      );
    }

    console.log(`    - Set "${setFields.name}" creado con 2 bloques (${resolvedBlocks.map((b) => `${b.blockCode}: ${b.options.length} opciones`).join(', ')}).`);
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

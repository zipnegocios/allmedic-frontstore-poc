/**
 * Backfill de datos — Fase 1 de la migración de taxonomía universal de catálogo
 * (ver docs/superpowers/plans/PLAN-matriz-datos-universal.md).
 *
 * Puebla, a partir de los campos planos legacy (`products.category`,
 * `product_variants.fit`, `products.styles`), la nueva taxonomía EAV:
 *   1. `products.code` — código de estilo obligatorio y único global.
 *   2. `product_types` — uno por combinación (marca, categoría) realmente en uso,
 *      y asignación de `products.product_type_id`.
 *   3. Atributo "Corte" (Petite/Short/Regular/Tall) + `variant_attribute_values`
 *      desde `product_variants.fit`.
 *   4. `styles` (JSONB) → EAV: mapeo genérico: no hay contenido real hoy (100% `[]`),
 *      así que no se ejecuta ninguna transformación real; se deja el mapeo listo
 *      para entornos con datos.
 *
 * NO borra `products.category`, `products.product_type`, `products.styles` ni
 * `product_variants.fit` — conviven con los campos nuevos hasta la fase de limpieza.
 * NO calcula `attributes_payload` (JSONB desnormalizado) — eso es la Fase 2.
 *
 * Idempotente: cada paso primero busca por clave natural (slug de producto ya con
 * `code`, `(brandId, slug)` de tipo, `(attributeId, value)` de valor, etc.) antes de
 * insertar, así que correrlo más de una vez no duplica filas.
 *
 * --dry-run: ejecuta todos los INSERT/UPDATE dentro de una transacción real y hace
 * ROLLBACK al final — permite ver el resultado exacto (incluyendo ids generados) sin
 * persistir nada.
 *
 * Uso: npx tsx --env-file=.env.local scripts/migrate-catalog-taxonomy-backfill.ts [--dry-run]
 */
import "dotenv/config";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  products,
  productTypes,
  attributes,
  attributeValues,
  productTypeAttributes,
  productVariants,
  variantAttributeValues,
} from "@/db/schema";

const DRY_RUN = process.argv.includes("--dry-run");
const ROLLBACK_SENTINEL = "__DRY_RUN_ROLLBACK__";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Categorías cuyo nombre determina el tipo tipo-pantalón para la asociación del
// atributo "Corte" (paso 3). Solo "Pantalones" está presente en los datos reales.
const PANTS_CATEGORIES = new Set(["Pantalones"]);

async function run() {
  const provisionalCodes: Array<{ slug: string; code: string; reason: string }> = [];
  const skippedStylesKeys: string[] = [];
  const fitLinksCreated: Array<{ variantId: string; productSlug: string; productCategory: string; fit: string }> = [];

  const runInTx = async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => {
    // ── 1. Backfill products.code ──
    const allProducts = await tx.select().from(products);
    for (const p of allProducts) {
      if (p.code) continue; // ya tiene code (re-ejecución idempotente)

      let code: string;
      if (p.sku && p.sku.trim() !== "") {
        code = p.sku.trim();
        provisionalCodes.push({ slug: p.slug, code, reason: "sku real reutilizado (no provisional)" });
      } else {
        code = `TMP-${p.slug}`;
        provisionalCodes.push({ slug: p.slug, code, reason: p.sku === null ? "sku NULL -> provisional" : "sku vacío ('') -> provisional" });
      }

      await tx.update(products).set({ code }).where(eq(products.id, p.id));
      p.code = code; // reflejar en memoria para los pasos siguientes
    }

    // ── 2. category → product_types (por marca, solo combinaciones en uso) ──
    const distinctBrandCategory = await tx
      .selectDistinct({ brandId: products.brandId, category: products.category })
      .from(products);

    const typeIdByBrandCategory = new Map<string, string>();

    for (const { brandId, category } of distinctBrandCategory) {
      const slug = slugify(category);
      const [existing] = await tx
        .select()
        .from(productTypes)
        .where(and(eq(productTypes.brandId, brandId), eq(productTypes.slug, slug)));

      let typeId: string;
      if (existing) {
        typeId = existing.id;
      } else {
        const [created] = await tx
          .insert(productTypes)
          .values({ brandId, name: category, slug })
          .returning();
        typeId = created.id;
      }
      typeIdByBrandCategory.set(`${brandId}::${category}`, typeId);
    }

    for (const p of allProducts) {
      const typeId = typeIdByBrandCategory.get(`${p.brandId}::${p.category}`);
      if (typeId) {
        await tx.update(products).set({ productTypeId: typeId }).where(eq(products.id, p.id));
      }
    }

    // ── 3. fit → EAV: atributo "Corte" ──
    const CORTE_SLUG = "corte";
    const CORTE_VALUES = ["Petite", "Short", "Regular", "Tall"];

    let [corteAttr] = await tx.select().from(attributes).where(eq(attributes.slug, CORTE_SLUG));
    if (!corteAttr) {
      [corteAttr] = await tx
        .insert(attributes)
        .values({ name: "Corte", slug: CORTE_SLUG, displayType: "select" })
        .returning();
    }

    const valueIdByLabel = new Map<string, string>();
    for (const label of CORTE_VALUES) {
      let [existingValue] = await tx
        .select()
        .from(attributeValues)
        .where(and(eq(attributeValues.attributeId, corteAttr.id), eq(attributeValues.value, label)));
      if (!existingValue) {
        [existingValue] = await tx
          .insert(attributeValues)
          .values({ attributeId: corteAttr.id, value: label })
          .returning();
      }
      valueIdByLabel.set(label, existingValue.id);
    }

    // Poblar variant_attribute_values desde product_variants.fit (dato real, tal
    // cual existe hoy — independiente de si el tipo de producto de esa variante
    // está o no asociado a "Corte" en product_type_attributes; ver reporte). Se
    // hace ANTES de la asociación en `product_type_attributes` porque el paso
    // siguiente necesita saber qué product_types tienen datos reales de "Corte"
    // (por ejemplo dickies-eds-scrub-top, categoría "Camisas", fuera de
    // PANTS_CATEGORIES — ver docs/superpowers/plans/PLAN-matriz-datos-universal.md).
    const variantsWithFit = await tx
      .select({
        id: productVariants.id,
        fit: productVariants.fit,
        productId: productVariants.productId,
      })
      .from(productVariants)
      .where(sql`${productVariants.fit} IS NOT NULL AND ${productVariants.fit} != ''`);

    const productById = new Map(allProducts.map((p) => [p.id, p]));
    const typeIdsWithRealFitData = new Set<string>();

    for (const v of variantsWithFit) {
      const valueId = valueIdByLabel.get(v.fit!);
      if (!valueId) continue; // valor de fit no reconocido, no se inventa
      const product = productById.get(v.productId);
      if (product?.productTypeId) {
        typeIdsWithRealFitData.add(product.productTypeId);
      }
      const [existingLink] = await tx
        .select()
        .from(variantAttributeValues)
        .where(and(eq(variantAttributeValues.variantId, v.id), eq(variantAttributeValues.attributeValueId, valueId)));
      if (!existingLink) {
        await tx.insert(variantAttributeValues).values({ variantId: v.id, attributeValueId: valueId });
        fitLinksCreated.push({
          variantId: v.id,
          productSlug: product?.slug ?? "?",
          productCategory: product?.category ?? "?",
          fit: v.fit!,
        });
      }
    }

    // Asociar "Corte" a los product_types cuya categoría es tipo-pantalón, y
    // también a cualquier product_type que tenga datos reales de "Corte" vía
    // `fit` aunque su categoría no esté en PANTS_CATEGORIES (p.ej. Dickies EDS
    // Scrub Top, categoría "Camisas", tiene 7 variantes reales con fit='Regular').
    // Sin esto, esas variantes tendrían un valor EAV para un atributo no
    // declarado como válido para su product_type — inconsistencia de modelado.
    const typeIdsToAssociateWithCorte = new Set<string>(typeIdsWithRealFitData);
    for (const [key, typeId] of typeIdByBrandCategory.entries()) {
      const category = key.split("::")[1];
      if (PANTS_CATEGORIES.has(category)) {
        typeIdsToAssociateWithCorte.add(typeId);
      }
    }

    for (const typeId of typeIdsToAssociateWithCorte) {
      const [existingAssoc] = await tx
        .select()
        .from(productTypeAttributes)
        .where(and(eq(productTypeAttributes.productTypeId, typeId), eq(productTypeAttributes.attributeId, corteAttr.id)));
      if (!existingAssoc) {
        await tx.insert(productTypeAttributes).values({
          productTypeId: typeId,
          attributeId: corteAttr.id,
          isRequired: false,
          sortOrder: 0,
        });
      }
    }

    // ── 4. styles JSONB → EAV (mapeo genérico, sin ejecución real hoy) ──
    // Los datos actuales tienen `styles = []` en el 100% de los productos, así que
    // este bloque no encuentra ninguna clave que mapear. Se deja la iteración lista
    // para el día que existan datos: cualquier clave presente en `styles` que no
    // tenga un atributo EAV correspondiente se reporta en `skippedStylesKeys` y se
    // descarta (no se inventa un atributo nuevo aquí).
    const KNOWN_STYLE_KEY_TO_ATTRIBUTE_SLUG: Record<string, string> = {
      // Ejemplo de mapeo futuro: "cuello" -> "tipo-cuello". Vacío hoy: sin datos reales.
    };
    for (const p of allProducts) {
      const styles = p.styles as unknown;
      if (!Array.isArray(styles) || styles.length === 0) continue;
      for (const entry of styles) {
        const key = typeof entry === "string" ? entry : (entry as { key?: string })?.key;
        if (!key) continue;
        if (!KNOWN_STYLE_KEY_TO_ATTRIBUTE_SLUG[key]) {
          skippedStylesKeys.push(key);
        }
      }
    }

    if (DRY_RUN) {
      throw new Error(ROLLBACK_SENTINEL);
    }
  };

  await db.transaction(runInTx).catch((err) => {
    if (err?.message !== ROLLBACK_SENTINEL) throw err;
  });

  console.log(`\n${DRY_RUN ? "[DRY RUN, se hizo ROLLBACK] " : ""}Backfill completado.\n`);
  console.log("Códigos de producto asignados:");
  for (const c of provisionalCodes) {
    console.log(`  - ${c.slug} -> code="${c.code}" (${c.reason})`);
  }
  console.log(`\nEnlaces variant_attribute_values creados desde fit (${fitLinksCreated.length}):`);
  for (const f of fitLinksCreated) {
    console.log(`  - variant ${f.variantId} (producto "${f.productSlug}", categoría "${f.productCategory}") -> Corte=${f.fit}`);
  }
  if (skippedStylesKeys.length > 0) {
    console.log("\nClaves de `styles` no mapeadas (descartadas):", skippedStylesKeys);
  } else {
    console.log("\nClaves de `styles` no mapeadas: ninguna (100% de los productos tiene styles = []).");
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});

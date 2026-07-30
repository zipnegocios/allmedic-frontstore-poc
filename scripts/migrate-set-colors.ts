/**
 * One-off: puebla `set_colors` a partir de los sets existentes, calculando la intersección de
 * colores entre los bloques (A/B) de cada set (colores presentes en variantes AVAILABLE/BACKORDER
 * de TODAS las piezas del set), e insertando una fila por color con `sortOrder` incremental.
 *
 * Para cada set, mueve las filas actuales de `media_links` (entityType='SET', role IN
 * ('COVER','COVER_SECONDARY'), colorId IS NULL) asignándoles `colorId` = primer color de la
 * intersección — el resto de los colores de la intersección quedan sin portada (el admin las
 * carga manualmente luego).
 *
 * Idempotente: usa `ON CONFLICT (set_id, color_id) DO NOTHING` en `set_colors`, y solo toca
 * media_links que todavía tengan `colorId IS NULL`.
 *
 * Uso: npx tsx --env-file=.env.local scripts/migrate-set-colors.ts [--dry-run]
 */
import "dotenv/config";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  corporateSets,
  setBlocks,
  setBlockOptions,
  setColors,
  productVariants,
  mediaLinks,
} from "@/db/schema";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  // Solo sets vigentes (no en papelera) — los borrados no deben recibir set_colors ni que se
  // les toquen sus media_links, aunque sigan existiendo en la tabla.
  const sets = await db
    .select({ id: corporateSets.id, name: corporateSets.name })
    .from(corporateSets)
    .where(isNull(corporateSets.deletedAt));
  console.log(`[migrate-set-colors] ${sets.length} set(s) vigente(s) encontrados.`);

  for (const set of sets) {
    const blocks = await db
      .select({ id: setBlocks.id })
      .from(setBlocks)
      .where(eq(setBlocks.setId, set.id));

    if (blocks.length === 0) {
      console.log(`[migrate-set-colors] Set "${set.name}" (${set.id}) sin bloques — se omite.`);
      continue;
    }

    const options = await db
      .select({ blockId: setBlockOptions.blockId, productId: setBlockOptions.productId })
      .from(setBlockOptions)
      .where(inArray(setBlockOptions.blockId, blocks.map((b) => b.id)));

    const productIdsByBlock = new Map<string, Set<string>>();
    for (const opt of options) {
      if (!productIdsByBlock.has(opt.blockId)) productIdsByBlock.set(opt.blockId, new Set());
      productIdsByBlock.get(opt.blockId)!.add(opt.productId);
    }

    const allProductIds = Array.from(new Set(options.map((o) => o.productId)));
    if (allProductIds.length === 0) {
      console.log(`[migrate-set-colors] Set "${set.name}" (${set.id}) sin piezas — se omite.`);
      continue;
    }

    const variants = await db
      .select({ productId: productVariants.productId, colorId: productVariants.colorId })
      .from(productVariants)
      .where(and(
        inArray(productVariants.productId, allProductIds),
        sql`${productVariants.status} != 'OUT_OF_STOCK'`
      ));

    // Colores por bloque: unión de colores de las piezas (opciones) de ese bloque.
    const colorsByBlock = new Map<string, Set<string>>();
    for (const [blockId, productIds] of productIdsByBlock) {
      const colorSet = new Set<string>();
      for (const v of variants) {
        if (productIds.has(v.productId)) colorSet.add(v.colorId);
      }
      colorsByBlock.set(blockId, colorSet);
    }

    // Intersección entre TODOS los bloques del set.
    const blockColorSets = Array.from(colorsByBlock.values());
    if (blockColorSets.length === 0) continue;
    let intersection = blockColorSets[0];
    for (const s of blockColorSets.slice(1)) {
      intersection = new Set(Array.from(intersection).filter((c) => s.has(c)));
    }

    if (intersection.size === 0) {
      console.log(`[migrate-set-colors] Set "${set.name}" (${set.id}) sin colores en común entre bloques — se omite.`);
      continue;
    }

    const orderedColorIds = Array.from(intersection);
    console.log(`[migrate-set-colors] Set "${set.name}" (${set.id}): ${orderedColorIds.length} color(es) en la intersección.`);

    if (DRY_RUN) continue;

    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedColorIds.length; i++) {
        await tx
          .insert(setColors)
          .values({ setId: set.id, colorId: orderedColorIds[i], sortOrder: i })
          .onConflictDoNothing({ target: [setColors.setId, setColors.colorId] });
      }

      const defaultColorId = orderedColorIds[0];
      await tx
        .update(mediaLinks)
        .set({ colorId: defaultColorId })
        .where(and(
          eq(mediaLinks.entityType, "SET"),
          eq(mediaLinks.entityId, set.id),
          inArray(mediaLinks.role, ["COVER", "COVER_SECONDARY"]),
          isNull(mediaLinks.colorId)
        ));
    });

    console.log(`[migrate-set-colors] Set "${set.name}" (${set.id}) migrado — color por defecto asignado a portada existente.`);
  }

  console.log(DRY_RUN ? "[migrate-set-colors] Dry-run finalizado, sin cambios persistidos." : "[migrate-set-colors] Migración completa.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate-set-colors] Error:", err);
  process.exit(1);
});

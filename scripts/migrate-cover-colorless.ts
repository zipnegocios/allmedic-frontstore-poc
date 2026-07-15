import "dotenv/config";
import { eq, and, asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  products as productsTable,
  mediaLinks as mediaLinksTable,
  productVariants as variantsTable,
} from "@/db/schema";

async function main() {
  console.log("\n=== MIGRACIÓN IDEMPOTENTE: PORTADAS (COVER) Y GALERÍAS SIN COLOR ===\n");

  // 1. Obtener todos los productos activos
  const activeProducts = await db.select().from(productsTable);
  console.log(`Encontrados ${activeProducts.length} productos en la base de datos.`);

  let coversCreated = 0;
  let linksColorized = 0;
  let exceptionsCount = 0;

  for (const product of activeProducts) {
    // A. Comprobar si el producto ya tiene portada (role = 'COVER')
    const [existingCover] = await db
      .select()
      .from(mediaLinksTable)
      .where(
        and(
          eq(mediaLinksTable.entityType, "PRODUCT"),
          eq(mediaLinksTable.entityId, product.id),
          eq(mediaLinksTable.role, "COVER")
        )
      )
      .limit(1);

    if (!existingCover) {
      // Buscar el primer medio GALLERY ordenado por sortOrder
      const galleryLinks = await db
        .select()
        .from(mediaLinksTable)
        .where(
          and(
            eq(mediaLinksTable.entityType, "PRODUCT"),
            eq(mediaLinksTable.entityId, product.id),
            eq(mediaLinksTable.role, "GALLERY")
          )
        )
        .orderBy(asc(mediaLinksTable.sortOrder));

      if (galleryLinks.length > 0) {
        const firstGalleryLink = galleryLinks[0];
        // Crear un vínculo COVER independiente apuntando al mismo assetId
        await db.insert(mediaLinksTable).values({
          assetId: firstGalleryLink.assetId,
          entityType: "PRODUCT",
          entityId: product.id,
          role: "COVER",
          sortOrder: 0,
          altOverride: firstGalleryLink.altOverride,
          colorId: null, // COVER no lleva color
        });
        coversCreated++;
        console.log(`[COVER] Creada portada para: "${product.name}" usando asset de galería.`);
      } else {
        console.log(`[AVISO] El producto "${product.name}" no tiene medios GALLERY para generar COVER.`);
      }
    }

    // B. Buscar vínculos GALLERY sin colorId (colorless)
    const colorlessLinks = await db
      .select()
      .from(mediaLinksTable)
      .where(
        and(
          eq(mediaLinksTable.entityType, "PRODUCT"),
          eq(mediaLinksTable.entityId, product.id),
          eq(mediaLinksTable.role, "GALLERY"),
          eq(mediaLinksTable.colorId, null as any) // drizzle-orm compatible check or handled below
        )
      );

    // Filtrar los nulos estrictos en JS para estar 100% seguros
    const strictColorless = colorlessLinks.filter(l => l.colorId === null || l.colorId === undefined);

    if (strictColorless.length > 0) {
      // Buscar variantes del producto para obtener el primer color
      const productVariants = await db
        .select()
        .from(variantsTable)
        .where(eq(variantsTable.productId, product.id))
        .limit(1);

      if (productVariants.length > 0 && productVariants[0].colorId) {
        const targetColorId = productVariants[0].colorId;
        const linkIds = strictColorless.map(l => l.id);

        await db
          .update(mediaLinksTable)
          .set({ colorId: targetColorId })
          .where(inArray(mediaLinksTable.id, linkIds));

        linksColorized += linkIds.length;
        console.log(`[COLOR] Reasignados ${linkIds.length} medios sin color al color: "${productVariants[0].colorId}" para producto: "${product.name}".`);
      } else {
        exceptionsCount += strictColorless.length;
        console.warn(`[EXCEPCIÓN] Producto "${product.name}" tiene ${strictColorless.length} medios sin color pero NO posee variantes/colores. Se dejan intactos.`);
      }
    }
  }

  console.log("\n=== RESUMEN DE MIGRACIÓN ===");
  console.log(`- Portadas creadas (COVER): ${coversCreated}`);
  console.log(`- Medios de galería colorizados: ${linksColorized}`);
  console.log(`- Excepciones (medios sin color sin variantes disponibles): ${exceptionsCount}`);
  console.log("============================\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error en la migración de portadas/colores:", err);
  process.exit(1);
});

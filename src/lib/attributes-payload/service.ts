// ─── Servicio de sincronización de `attributes_payload` (Fase 2) ───
// Capa con DB alrededor del núcleo puro (`build-payload.ts`). Carga las relaciones
// ya resueltas de una variante vía la API relacional de Drizzle (una sola consulta
// con `with`), arma el payload con `buildAttributesPayload` y persiste el resultado.
//
// También expone funciones de recálculo en cascada para cuando cambian datos que
// afectan a variantes ya sincronizadas (rename de un attributeValue/collection/
// productType, cambio del `code` de un producto, etc.). Fase 3 decidirá dónde
// cablear automáticamente cada trigger de rename — aquí solo se deja la función
// lista para invocar.

import { db } from "@/db";
import { productVariants, products, variantAttributeValues } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildAttributesPayload, type AttributesPayloadStyleInput } from "./build-payload";

/** Variante no encontrada al intentar sincronizar/recalcular su payload. */
export class AttributesPayloadSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttributesPayloadSyncError";
  }
}

async function loadVariantPayloadInput(variantId: string) {
  const variant = await db.query.productVariants.findFirst({
    where: eq(productVariants.id, variantId),
    with: {
      product: {
        with: { brand: true, collection: true, productType: true },
      },
      color: true,
      attributeValues: {
        with: { attributeValue: { with: { attribute: true } } },
      },
    },
  });

  if (!variant) {
    throw new AttributesPayloadSyncError(`Variante no encontrada: ${variantId}`);
  }

  const styles: AttributesPayloadStyleInput[] = variant.attributeValues.map((vav) => ({
    attributeSlug: vav.attributeValue.attribute.slug,
    value: vav.attributeValue.value,
  }));

  return buildAttributesPayload({
    brandName: variant.product.brand.name,
    collectionName: variant.product.collection?.name ?? null,
    productTypeName: variant.product.productType?.name ?? null,
    code: variant.product.code,
    colorCode: variant.color.code,
    size: variant.size,
    gender: variant.product.gender,
    styles,
  });
}

/**
 * Recalcula y persiste `attributes_payload` para UNA variante, a partir de sus
 * relaciones actuales en la base de datos.
 */
export async function syncVariantAttributesPayload(variantId: string): Promise<void> {
  const payload = await loadVariantPayloadInput(variantId);
  await db.update(productVariants).set({ attributesPayload: payload }).where(eq(productVariants.id, variantId));
}

/**
 * Recalcula `attributes_payload` de TODAS las variantes de un producto. Úsalo
 * cuando cambia algo a nivel de producto que afecta el payload de sus variantes:
 * `code`, `gender`, `brandId`, `collectionId`, `productTypeId` (incluye el caso de
 * renombrar la colección/tipo de producto asociados, que ya se refleja al releer
 * el nombre actual desde la relación).
 */
export async function recalculateVariantPayloadsForProduct(productId: string): Promise<void> {
  const variants = await db.query.productVariants.findMany({
    where: eq(productVariants.productId, productId),
    columns: { id: true },
  });

  for (const v of variants) {
    await syncVariantAttributesPayload(v.id);
  }
}

/**
 * Recalcula `attributes_payload` de todas las variantes que usan un `attributeValue`
 * dado. Úsalo cuando se renombra el `value` de un attributeValue (ej. "Petite" ->
 * "Petite (P)") — las variantes que lo tienen asignado deben reflejar el nuevo texto.
 */
export async function recalculateVariantPayloadsForAttributeValue(attributeValueId: string): Promise<void> {
  const links = await db.query.variantAttributeValues.findMany({
    where: eq(variantAttributeValues.attributeValueId, attributeValueId),
    columns: { variantId: true },
  });

  for (const link of links) {
    await syncVariantAttributesPayload(link.variantId);
  }
}

/**
 * Recalcula `attributes_payload` de todas las variantes de todos los productos de
 * una colección. Úsalo cuando se renombra `collections.name`.
 */
export async function recalculateVariantPayloadsForCollection(collectionId: string): Promise<void> {
  const affectedProducts = await db.query.products.findMany({
    where: eq(products.collectionId, collectionId),
    columns: { id: true },
  });

  for (const p of affectedProducts) {
    await recalculateVariantPayloadsForProduct(p.id);
  }
}

/**
 * Recalcula `attributes_payload` de todas las variantes de todos los productos de
 * un tipo de producto. Úsalo cuando se renombra `productTypes.name`.
 */
export async function recalculateVariantPayloadsForProductType(productTypeId: string): Promise<void> {
  const affectedProducts = await db.query.products.findMany({
    where: eq(products.productTypeId, productTypeId),
    columns: { id: true },
  });

  for (const p of affectedProducts) {
    await recalculateVariantPayloadsForProduct(p.id);
  }
}

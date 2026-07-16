// ─── Construcción de `attributes_payload` (Fase 2 de la migración EAV) ───
// Módulo puro y testeable — sin dependencias de base de datos. Recibe los datos
// ya resueltos de las relaciones de una variante (marca, colección, tipo de
// producto, estilos, color) y arma el JSON desnormalizado que se persiste en
// `product_variants.attributes_payload` para lectura pública (catálogo/filtros).
//
// Decisión (documentada en el reporte de Fase 2): cuando `collectionName` o
// `productTypeName` no existen (null/undefined — ambas columnas son nullable en
// `products`), la clave correspondiente se OMITE del payload en vez de guardarse
// como `null`. Motivo: consistencia con cómo Postgres/GIN indexa jsonb — una
// clave ausente es más barata de filtrar ("no tiene collection") que una
// presente con valor `null`, y evita que los consumidores del payload (filtros
// de catálogo) tengan que distinguir "ausente" de "null" como dos casos.

export interface AttributesPayloadStyleInput {
  /** Slug del atributo (ej. "corte_pantalon") — es la clave estable, no el `name`. */
  attributeSlug: string;
  /** Valor del `attributeValue` asociado a la variante (ej. "Petite"). */
  value: string;
}

export interface BuildAttributesPayloadInput {
  brandName: string;
  /** Nombre de la colección, o `null`/`undefined` si el producto no tiene `collectionId`. */
  collectionName?: string | null;
  /** Nombre del tipo de producto, o `null`/`undefined` si el producto no tiene `productTypeId`. */
  productTypeName?: string | null;
  code: string;
  /** `code` del color de la variante (no el `name`). */
  colorCode: string;
  size: string;
  gender: string;
  styles: AttributesPayloadStyleInput[];
}

export interface AttributesPayload {
  brand: string;
  collection?: string;
  product_type?: string;
  code: string;
  styles: Record<string, string>;
  color_code: string;
  size: string;
  gender: string;
}

export function buildAttributesPayload(input: BuildAttributesPayloadInput): AttributesPayload {
  const styles: Record<string, string> = {};
  for (const style of input.styles) {
    styles[style.attributeSlug] = style.value;
  }

  return {
    brand: input.brandName,
    ...(input.collectionName != null ? { collection: input.collectionName } : {}),
    ...(input.productTypeName != null ? { product_type: input.productTypeName } : {}),
    code: input.code,
    styles,
    color_code: input.colorCode,
    size: input.size,
    gender: input.gender,
  };
}

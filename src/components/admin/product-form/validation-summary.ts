import type { FieldErrors } from 'react-hook-form';
import type { ProductFormData } from './schema';

/** Etiquetas legibles para los campos top-level de `ProductFormSchema` que pueden
 * fallar validación al guardar — mismo texto que el label visible en el formulario,
 * para que el panel de resumen sea consistente con lo que el usuario ve en pantalla. */
const TOP_LEVEL_LABELS: Partial<Record<keyof ProductFormData, string>> = {
  name: 'Nombre',
  slug: 'Slug',
  brandId: 'Marca',
  productTypeId: 'Tipo de Producto',
  code: 'Código de Estilo',
  gender: 'Género',
  priceNormal: 'Precio Normal',
};

/** Etiquetas legibles por campo de `VariantSchema`/`ImageSchema` — usadas para
 * listar CUALQUIER sub-campo que falle en una fila (no solo Color/Talla), ya que
 * limitarse a esos dos dejaba el resumen vacío cuando el error real venía de otro
 * campo. */
const VARIANT_FIELD_LABELS: Record<string, string> = {
  colorId: 'Color',
  size: 'Talla',
  sku: 'SKU',
  status: 'Estado',
  attributeValueIds: 'Atributos',
};

const IMAGE_FIELD_LABELS: Record<string, string> = {
  assetId: 'imagen',
  colorId: 'color asociado',
  alt: 'texto alternativo',
  sortOrder: 'orden',
};

/** Extrae los nombres de los sub-campos que efectivamente tienen error dentro de
 * un objeto de error de fila (`errors.variants[i]`/`errors.images[i]`), mapeados
 * a una etiqueta legible — genérico en vez de chequear campos puntuales a mano. */
function rowErrorLabels(rowError: unknown, labels: Record<string, string>): string[] {
  if (!rowError || typeof rowError !== 'object') return [];
  return Object.keys(rowError)
    .filter((key) => Boolean((rowError as Record<string, unknown>)[key]))
    .map((key) => labels[key] ?? key);
}

export interface GroupedValidationSummary {
  /** Errores de la pestaña "General" (nombre, marca, precio, portada, etc.). */
  general: string[];
  /** Errores de la pestaña "Variantes y Medios" (filas de talla/color y medios). */
  variantsMedia: string[];
}

/**
 * Construye el resumen de errores agrupado por sección del formulario — usado por
 * el modal de detalle que se abre al hacer clic en el badge "Con errores" de un
 * color, y por `buildValidationSummary` (versión plana, para el banner/toast).
 */
export function buildValidationSummaryGrouped(errors: FieldErrors<ProductFormData>): GroupedValidationSummary {
  const general: string[] = [];

  for (const key of Object.keys(TOP_LEVEL_LABELS) as (keyof ProductFormData)[]) {
    if (errors[key]) {
      general.push(TOP_LEVEL_LABELS[key]!);
    }
  }

  if (errors.cover?.assetId) {
    general.push('Portada del Producto');
  }

  const variantsMedia: string[] = [];

  const variantErrors = errors.variants;
  if (Array.isArray(variantErrors)) {
    variantErrors.forEach((variantError, idx) => {
      const missing = rowErrorLabels(variantError, VARIANT_FIELD_LABELS);
      if (missing.length > 0) {
        variantsMedia.push(`Variante ${idx + 1}: falta ${missing.join(' y ')}`);
      }
    });
  }

  const imageErrors = errors.images;
  if (Array.isArray(imageErrors)) {
    imageErrors.forEach((imageError, idx) => {
      const missing = rowErrorLabels(imageError, IMAGE_FIELD_LABELS);
      if (missing.length > 0) {
        variantsMedia.push(`Medio ${idx + 1}: falta ${missing.join(' y ')}`);
      }
    });
  } else if (imageErrors && typeof imageErrors === 'object' && 'message' in imageErrors) {
    // Error a nivel de todo el array `images` (ej. el `superRefine` de "cada color
    // debe tener al menos una imagen"), sin índice de fila asociado.
    const message = (imageErrors as { message?: string }).message;
    if (message) variantsMedia.push(message);
  }

  return { general, variantsMedia };
}

/**
 * Construye una lista plana de mensajes legibles a partir de `formState.errors` de
 * `ProductForm`, para mostrarlos completos en el banner/toast — a diferencia del
 * toast original, que solo mostraba el primer error encontrado por DFS y dejaba al
 * usuario sin saber cuántos/cuáles campos faltaban (ej. varias filas de `variants`
 * inválidas a la vez).
 */
export function buildValidationSummary(errors: FieldErrors<ProductFormData>): string[] {
  const { general, variantsMedia } = buildValidationSummaryGrouped(errors);
  return [...general, ...variantsMedia];
}

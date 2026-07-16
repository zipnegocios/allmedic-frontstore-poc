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

/**
 * Construye una lista de mensajes legibles a partir de `formState.errors` de
 * `ProductForm`, para mostrarlos completos en un panel de alerta — a diferencia del
 * toast anterior, que solo mostraba el primer error encontrado por DFS y dejaba al
 * usuario sin saber cuántos/cuáles campos faltaban (ej. varias filas de `variants`
 * inválidas a la vez).
 */
export function buildValidationSummary(errors: FieldErrors<ProductFormData>): string[] {
  const messages: string[] = [];

  for (const key of Object.keys(TOP_LEVEL_LABELS) as (keyof ProductFormData)[]) {
    if (errors[key]) {
      messages.push(TOP_LEVEL_LABELS[key]!);
    }
  }

  if (errors.cover?.assetId) {
    messages.push('Portada del Producto');
  }

  const variantErrors = errors.variants;
  if (Array.isArray(variantErrors)) {
    variantErrors.forEach((variantError, idx) => {
      if (!variantError) return;
      const missing: string[] = [];
      if (variantError.colorId) missing.push('Color');
      if (variantError.size) missing.push('Talla');
      if (missing.length > 0) {
        messages.push(`Variante ${idx + 1}: falta ${missing.join(' y ')}`);
      }
    });
  }

  const imageErrors = errors.images;
  if (Array.isArray(imageErrors)) {
    imageErrors.forEach((imageError, idx) => {
      if (!imageError) return;
      const missing: string[] = [];
      if (imageError.assetId) missing.push('imagen');
      if (imageError.colorId) missing.push('color asociado');
      if (missing.length > 0) {
        messages.push(`Medio ${idx + 1}: falta ${missing.join(' y ')}`);
      }
    });
  }

  return messages;
}

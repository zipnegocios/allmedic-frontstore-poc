import type { FieldErrors } from 'react-hook-form';
import type { SetFormData } from './schema';

/** Etiquetas legibles para los campos top-level de `SetFormSchema` que pueden fallar
 * validación al guardar — mismo criterio que `product-form/validation-summary.ts`. */
const TOP_LEVEL_LABELS: Partial<Record<keyof SetFormData, string>> = {
  name: 'Nombre',
  slug: 'Slug',
  coverAssetId: 'Portada primaria del Set',
  secondaryCoverAssetId: 'Portada secundaria del Set',
};

/**
 * Construye una lista de mensajes legibles a partir de `formState.errors` de
 * `SetForm`, análogo a `buildValidationSummary` de productos.
 */
export function buildSetValidationSummary(errors: FieldErrors<SetFormData>): string[] {
  const messages: string[] = [];

  for (const key of Object.keys(TOP_LEVEL_LABELS) as (keyof SetFormData)[]) {
    if (errors[key]) {
      messages.push(TOP_LEVEL_LABELS[key]!);
    }
  }

  const itemsError = errors.items;
  if (Array.isArray(itemsError)) {
    itemsError.forEach((itemError, idx) => {
      if (!itemError) return;
      const missing: string[] = [];
      if (itemError.productId) missing.push('Producto');
      if (itemError.quantityPerSet) missing.push('Cantidad');
      if (missing.length > 0) {
        messages.push(`Pieza ${idx + 1}: falta ${missing.join(' y ')}`);
      }
    });
  } else if (itemsError && typeof itemsError.message === 'string') {
    // Error a nivel de array completo (ej. `items.min(1)` sin ninguna pieza agregada).
    messages.push(itemsError.message);
  }

  return messages;
}

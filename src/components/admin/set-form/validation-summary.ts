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

  const blocksError = errors.blocks;
  const blockLabels = ['A', 'B'] as const;
  if (Array.isArray(blocksError)) {
    blocksError.forEach((blockError, blockIdx) => {
      if (!blockError) return;
      if (blockError.quantityPerSet) {
        messages.push(`Bloque ${blockLabels[blockIdx] ?? blockIdx + 1}: cantidad por set inválida`);
      }
      const optionsError = blockError.options;
      if (Array.isArray(optionsError)) {
        optionsError.forEach((optionError, optionIdx) => {
          if (optionError?.productId) {
            messages.push(`Bloque ${blockLabels[blockIdx] ?? blockIdx + 1}, opción ${optionIdx + 1}: falta el producto`);
          }
        });
      }
    });
  } else if (blocksError && typeof (blocksError as { message?: string }).message === 'string') {
    messages.push((blocksError as { message: string }).message);
  }

  return messages;
}

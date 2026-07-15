import type { ProductFormData } from './schema';

/**
 * Partición de pasos del wizard mobile de `ProductForm` (Task 7, Fase 3).
 * Pura data + lógica sin dependencias de React: se reutiliza para renderizar
 * el wizard y para validar el paso actual con `trigger()` de react-hook-form
 * (mismo esquema zod que ya usa el formulario, sin inventar validación
 * nueva).
 */

export type WizardStepId = 'identification' | 'pricing' | 'content' | 'variants_and_media';

export interface WizardStepDef {
  id: WizardStepId;
  /** Nombre de paso a mostrar al usuario, en español. */
  label: string;
  /**
   * Paths de campos de `ProductFormData` (compatibles con `trigger()` de
   * react-hook-form) que deben ser válidos para avanzar desde este paso.
   * Array vacío = el paso no bloquea el avance (no tiene campos requeridos).
   */
  fields: Array<keyof ProductFormData | `variants` | `images` | `cover`>;
}

export const PRODUCT_FORM_WIZARD_STEPS: WizardStepDef[] = [
  {
    id: 'identification',
    label: 'Identificación',
    fields: ['name', 'slug', 'brandId', 'category', 'gender'],
  },
  {
    id: 'pricing',
    label: 'Precios y visibilidad',
    fields: ['priceNormal'],
  },
  {
    id: 'content',
    label: 'Contenido enriquecido',
    fields: [],
  },
  {
    id: 'variants_and_media',
    label: 'Variantes y Medios',
    fields: ['variants', 'images', 'cover'],
  },
];


/**
 * Etiqueta de progreso a mostrar en el indicador del wizard, ej.
 * `"2/5 · Precios y visibilidad"`. Devuelve cadena vacía si el índice está
 * fuera de rango.
 */
export function getStepProgressLabel(
  stepIndex: number,
  steps: WizardStepDef[] = PRODUCT_FORM_WIZARD_STEPS
): string {
  const step = steps[stepIndex];
  if (!step) return '';
  return `${stepIndex + 1}/${steps.length} · ${step.label}`;
}

/**
 * Determina si se puede navegar libremente a `targetIndex`: solo pasos ya
 * visitados (índice <= máximo índice visitado) son alcanzables sin pasar por
 * la validación de "Siguiente". Esto habilita "saltar a un paso ya
 * visitado" sin forzar linealidad estricta.
 */
export function canNavigateToStep(targetIndex: number, maxVisitedIndex: number): boolean {
  return targetIndex >= 0 && targetIndex <= maxVisitedIndex;
}

/** Nuevo máximo de índice visitado tras navegar a `newIndex`. */
export function nextMaxVisitedIndex(currentMaxVisitedIndex: number, newIndex: number): number {
  return Math.max(currentMaxVisitedIndex, newIndex);
}

export const PRODUCT_FORM_WIZARD_STEP_COUNT = PRODUCT_FORM_WIZARD_STEPS.length;

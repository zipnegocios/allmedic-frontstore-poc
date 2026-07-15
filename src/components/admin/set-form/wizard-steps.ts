import type { SetFormData } from './schema';

/**
 * Partición de pasos del wizard mobile de `SetForm` (Task 8, Fase 3).
 * Pura data + lógica sin dependencias de React: se reutiliza para renderizar
 * el wizard y para validar el paso actual con `trigger()` de react-hook-form
 * (mismo esquema zod que ya usa el formulario, sin inventar validación
 * nueva). Cada paso coincide 1:1 con uno de los `Card` secuenciales que ya
 * existían en la vista desktop.
 */

export type SetFormWizardStepId = 'general' | 'pieces' | 'price' | 'rules';

export interface SetFormWizardStepDef {
  id: SetFormWizardStepId;
  /** Nombre de paso a mostrar al usuario, en español. */
  label: string;
  /**
   * Paths de campos de `SetFormData` (compatibles con `trigger()` de
   * react-hook-form) que deben ser válidos para avanzar desde este paso.
   * Array vacío = el paso no bloquea el avance (no tiene campos requeridos
   * propios; ej. "Precio" es siempre opcional y "Reglas" no usa campos del
   * formulario de react-hook-form).
   */
  fields: Array<keyof SetFormData>;
}

export const SET_FORM_WIZARD_STEPS: SetFormWizardStepDef[] = [
  {
    id: 'general',
    label: 'Datos generales',
    fields: ['name', 'slug', 'coverAssetId'],
  },
  {
    id: 'pieces',
    label: 'Piezas del set',
    fields: ['items'],
  },
  {
    id: 'price',
    label: 'Precio',
    fields: [],
  },
  {
    id: 'rules',
    label: 'Reglas del set',
    fields: [],
  },
];

/**
 * Etiqueta de progreso a mostrar en el indicador del wizard, ej.
 * `"2/4 · Piezas del set"`. Devuelve cadena vacía si el índice está fuera de
 * rango.
 */
export function getStepProgressLabel(
  stepIndex: number,
  steps: SetFormWizardStepDef[] = SET_FORM_WIZARD_STEPS
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

export const SET_FORM_WIZARD_STEP_COUNT = SET_FORM_WIZARD_STEPS.length;

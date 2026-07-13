/**
 * Partición de pasos del wizard mobile de `QuoteEditor` (Task 10, Fase 3 —
 * último de los 4 formularios grandes con wizard). Pura data + lógica sin
 * dependencias de React, siguiendo la misma convención que
 * `rule-form/wizard-steps.ts` (Task 9): `QuoteEditor` usa `useState` plano
 * (no react-hook-form), así que aquí se replican como predicados puros
 * exactamente los mismos chequeos que ya existían de forma implícita en el
 * componente (botón "Generar cotización definitiva" deshabilitado sin
 * líneas) — no se inventa validación nueva.
 */

export type QuoteEditorWizardStepId = 'client' | 'lines' | 'totals' | 'notes';

export interface QuoteEditorWizardStepDef {
  id: QuoteEditorWizardStepId;
  /** Nombre de paso a mostrar al usuario, en español. */
  label: string;
}

export const QUOTE_EDITOR_WIZARD_STEPS: QuoteEditorWizardStepDef[] = [
  { id: 'client', label: 'Cliente' },
  { id: 'lines', label: 'Líneas' },
  { id: 'totals', label: 'Totales y vigencia' },
  { id: 'notes', label: 'Notas y envío' },
];

export const QUOTE_EDITOR_WIZARD_STEP_COUNT = QUOTE_EDITOR_WIZARD_STEPS.length;

/**
 * Etiqueta de progreso a mostrar en el indicador del wizard, ej.
 * `"2/4 · Líneas"`. Devuelve cadena vacía si el índice está fuera de rango.
 */
export function getStepProgressLabel(
  stepIndex: number,
  steps: QuoteEditorWizardStepDef[] = QUOTE_EDITOR_WIZARD_STEPS
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

export interface ClientStepInput {
  customerName: string;
}

/**
 * Validación del paso 1 ("Cliente"): nombre/razón social no vacío. Es el
 * único campo identificador obligatorio del cliente — el resto (contacto,
 * correo, teléfono, ciudad, dirección) es opcional tanto aquí como en el
 * esquema zod de `PATCH /api/admin/quotes/[id]` (`customerName: z.string().min(1)`).
 */
export function isClientStepValid({ customerName }: ClientStepInput): boolean {
  return customerName.trim().length > 0;
}

export interface LinesStepInput {
  itemCount: number;
}

/**
 * Validación del paso 2 ("Líneas"): al menos una línea agregada. Replica el
 * mismo criterio que ya bloqueaba "Generar cotización definitiva" en la
 * barra de acciones (`disabled={... || items.length === 0}`) — el paso 3
 * (Totales y vigencia) depende del subtotal calculado de `items`, así que no
 * tiene sentido avanzar con la lista vacía.
 */
export function isLinesStepValid({ itemCount }: LinesStepInput): boolean {
  return itemCount > 0;
}

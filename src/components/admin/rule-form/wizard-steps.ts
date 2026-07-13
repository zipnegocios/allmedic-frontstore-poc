import type { RuleTypeKey } from '@/lib/rule-config-schemas';

/**
 * Partición de pasos del wizard mobile de `RuleForm` (Task 9, Fase 3).
 * Pura data + lógica sin dependencias de React. A diferencia de
 * `product-form/wizard-steps.ts` y `set-form/wizard-steps.ts` (que validan
 * el paso con `trigger()` de react-hook-form), `RuleForm` no usa
 * react-hook-form — es `useState` plano — así que aquí se replican, como
 * predicados puros, exactamente los mismos chequeos que ya hace
 * `handleSubmit` en `RuleForm.tsx` antes de guardar. No se inventa
 * validación nueva.
 */

export type RuleFormWizardStepId = 'type-scope' | 'config' | 'review';

export interface RuleFormWizardStepDef {
  id: RuleFormWizardStepId;
  /** Nombre de paso a mostrar al usuario, en español. */
  label: string;
}

export const RULE_FORM_WIZARD_STEPS: RuleFormWizardStepDef[] = [
  { id: 'type-scope', label: 'Tipo y ámbito' },
  { id: 'config', label: 'Configuración' },
  { id: 'review', label: 'Revisión y conflictos' },
];

export const RULE_FORM_WIZARD_STEP_COUNT = RULE_FORM_WIZARD_STEPS.length;

/**
 * Etiqueta de progreso a mostrar en el indicador del wizard, ej.
 * `"1/3 · Tipo y ámbito"`. Devuelve cadena vacía si el índice está fuera de
 * rango.
 */
export function getStepProgressLabel(
  stepIndex: number,
  steps: RuleFormWizardStepDef[] = RULE_FORM_WIZARD_STEPS
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

type Scope = 'GLOBAL' | 'BRAND' | 'SET_GROUP' | 'SET' | 'PRODUCT';

export interface TypeScopeStepInput {
  name: string;
  scope: Scope;
  scopeId: string | null;
}

/**
 * Validación del paso 1 ("Tipo y ámbito"): mismo criterio que ya usa
 * `handleSubmit` en `RuleForm.tsx` — nombre no vacío y, si el ámbito no es
 * Global, un `scopeId` seleccionado. El tipo de regla siempre tiene un
 * valor por defecto válido (no puede quedar vacío desde el `Select`), por
 * lo que no requiere chequeo adicional aquí.
 */
export function isTypeScopeStepValid({ name, scope, scopeId }: TypeScopeStepInput): boolean {
  if (!name.trim()) return false;
  if (scope !== 'GLOBAL' && !scopeId) return false;
  return true;
}

export interface ConfigStepInput {
  ruleType: RuleTypeKey;
  config: Record<string, unknown>;
}

/**
 * Validación del paso 2 ("Configuración"): replica exactamente los
 * chequeos específicos de `ruleType === 'PROMO'` que ya existían dentro de
 * `handleSubmit` (exclusividad pct/amount en THRESHOLD_DISCOUNT, condición
 * + descripción en GIFT, set disparador/objetivo en COMBO). El resto de
 * los 10 tipos de regla no tiene validación propia más allá de la que ya
 * aplica `RuleConfigFields` al no dejar campos en blanco con valores
 * inválidos — se preserva ese comportamiento sin endurecerlo.
 */
export function isConfigStepValid({ ruleType, config }: ConfigStepInput): boolean {
  if (ruleType !== 'PROMO') return true;

  const kind = config.kind;

  if (kind === 'THRESHOLD_DISCOUNT') {
    const hasPct = config.pct !== undefined && config.pct !== null && config.pct !== '';
    const hasAmount = config.amount !== undefined && config.amount !== null && config.amount !== '';
    if (hasPct === hasAmount) return false;
  }

  if (kind === 'GIFT') {
    const hasMinQty = config.minQty !== undefined && config.minQty !== null && config.minQty !== '';
    const hasMinSubtotal = config.minSubtotal !== undefined && config.minSubtotal !== null && config.minSubtotal !== '';
    if (!hasMinQty && !hasMinSubtotal) return false;
    if (!String(config.description ?? '').trim()) return false;
  }

  if (kind === 'COMBO' && (!config.triggerSetId || !config.targetSetId)) return false;

  return true;
}

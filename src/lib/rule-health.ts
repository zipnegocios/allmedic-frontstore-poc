/**
 * Determina el estado de salud de una regla de negocio a partir de si está
 * activa y de sus conteos de conflictos (errores/advertencias) ya calculados
 * por el motor de reglas (`src/lib/rules-engine/`). Esta función es pura UI:
 * no reimplementa ni consume lógica interna del motor, solo interpreta los
 * conteos que la API ya expone, para que la vista de tabla (columna "Salud")
 * y la vista de tarjetas mobile de `reglas/page.tsx` muestren siempre el
 * mismo estado sin duplicar la lógica de branching.
 */
export type RuleHealthStatus = 'inactive' | 'error' | 'warning' | 'ok';

export interface RuleHealthInput {
  isActive: boolean;
  conflictErrors: number;
  conflictWarnings: number;
}

export function getRuleHealthStatus(rule: RuleHealthInput): RuleHealthStatus {
  if (!rule.isActive) return 'inactive';
  if (rule.conflictErrors > 0) return 'error';
  if (rule.conflictWarnings > 0) return 'warning';
  return 'ok';
}

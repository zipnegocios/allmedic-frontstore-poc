/**
 * Determina qué acciones de cambio de estado (Aprobar / Rechazar / Suspender)
 * están disponibles para una cuenta corporativa según su estado actual.
 * Refleja exactamente las condiciones ya usadas en la vista de tabla de
 * `cuentas-corporativas/page.tsx`, de modo que la vista de tarjetas mobile
 * (dropdown ⋮ de `AdminListCard`) muestre siempre el mismo conjunto de
 * acciones que la tabla desktop.
 */
export interface CorporateAccountActionFlags {
  canApprove: boolean;
  canReject: boolean;
  canSuspend: boolean;
}

export function getCorporateAccountActionFlags(status: string): CorporateAccountActionFlags {
  return {
    canApprove: status !== 'APPROVED',
    canReject: status === 'PENDING',
    canSuspend: status === 'APPROVED',
  };
}

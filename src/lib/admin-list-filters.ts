/**
 * Cuenta cuántos filtros de un listado admin están activos (es decir, con un
 * valor distinto al valor "todos"/por defecto). Se usa para mostrar el
 * contador de filtros activos en el botón "Filtros" que agrupa los selects
 * en un Drawer en mobile cuando un módulo tiene más de dos filtros.
 */
export function countActiveFilters(
  values: Array<string | undefined | null>,
  defaultValue: string = 'ALL'
): number {
  return values.filter((value) => !!value && value !== defaultValue).length;
}

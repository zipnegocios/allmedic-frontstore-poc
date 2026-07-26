/**
 * Determina si una ruta de navegación está activa — coincidencia exacta o por prefijo de
 * segmento (`/admin/productos` activa también en `/admin/productos/123`).
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

/**
 * Variante para listas de navegación que incluyen la raíz del panel (`/admin`, Dashboard).
 * A diferencia del resto de rutas, `/admin` no debe coincidir por prefijo, ya que `/admin/`
 * es prefijo de absolutamente todas las demás rutas del admin (`/admin/productos`,
 * `/admin/cotizaciones`, etc.) — sin este caso especial, Dashboard se marca como activo en
 * casi cualquier página del panel (bug detectado en AdminSidebar, corregido 2026-07-26).
 */
export function isNavItemActiveInList(pathname: string, href: string): boolean {
  if (href === '/admin') {
    return pathname === '/admin';
  }
  return isNavItemActive(pathname, href);
}

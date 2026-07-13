import { describe, it, expect } from 'vitest';
import { isNavItemActive } from '../AdminBottomNav';

describe('isNavItemActive', () => {
  it('marca activo en coincidencia exacta', () => {
    expect(isNavItemActive('/admin/cotizaciones', '/admin/cotizaciones')).toBe(true);
  });

  it('marca activo en subrutas', () => {
    expect(isNavItemActive('/admin/cotizaciones/nueva', '/admin/cotizaciones')).toBe(true);
  });

  it('no marca activo otra ruta con el mismo prefijo textual', () => {
    // /admin/cotizaciones-legacy no debe activar /admin/cotizaciones
    expect(isNavItemActive('/admin/cotizaciones-legacy', '/admin/cotizaciones')).toBe(false);
  });

  it('no marca activo rutas no relacionadas', () => {
    expect(isNavItemActive('/admin/productos', '/admin/cotizaciones')).toBe(false);
  });

  it('distingue el dashboard raiz de sus subrutas', () => {
    expect(isNavItemActive('/admin', '/admin')).toBe(true);
    expect(isNavItemActive('/admin/productos', '/admin')).toBe(true);
  });
});

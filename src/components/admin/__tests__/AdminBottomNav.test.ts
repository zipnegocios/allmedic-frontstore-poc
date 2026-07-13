import { describe, it, expect } from 'vitest';
import { isNavItemActive, isNavItemActiveInList } from '../AdminBottomNav';

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

  it('coincide por prefijo de segmento inclusive para la raiz /admin (comportamiento general sin cambios)', () => {
    // isNavItemActive es una coincidencia de prefijo genérica: /admin es
    // literalmente un prefijo de segmento de cualquier otra ruta del admin.
    // Este comportamiento se mantiene intencionalmente sin cambios; el caso
    // especial de la raíz /admin se resuelve en `isNavItemActiveInList`,
    // usada específicamente por las listas de navegación que incluyen el
    // Dashboard (p. ej. el tab "Más").
    expect(isNavItemActive('/admin', '/admin')).toBe(true);
    expect(isNavItemActive('/admin/productos', '/admin')).toBe(true);
  });
});

describe('isNavItemActiveInList', () => {
  it('marca activo el Dashboard (/admin) solo en coincidencia exacta', () => {
    expect(isNavItemActiveInList('/admin', '/admin')).toBe(true);
  });

  it('no marca activo el Dashboard (/admin) en ninguna subruta del admin', () => {
    expect(isNavItemActiveInList('/admin/productos', '/admin')).toBe(false);
    expect(isNavItemActiveInList('/admin/cotizaciones', '/admin')).toBe(false);
    expect(isNavItemActiveInList('/admin/prospectos', '/admin')).toBe(false);
    expect(isNavItemActiveInList('/admin/cuentas-corporativas', '/admin')).toBe(false);
  });

  it('mantiene el comportamiento de prefijo normal para otras rutas', () => {
    expect(isNavItemActiveInList('/admin/productos', '/admin/productos')).toBe(true);
    expect(isNavItemActiveInList('/admin/productos/123', '/admin/productos')).toBe(true);
    expect(isNavItemActiveInList('/admin/productos-legacy', '/admin/productos')).toBe(false);
  });
});

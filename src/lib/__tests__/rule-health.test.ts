import { describe, it, expect } from 'vitest';
import { getRuleHealthStatus } from '../rule-health';

describe('getRuleHealthStatus', () => {
  it('regla inactiva: siempre "inactive", sin importar conflictos', () => {
    expect(getRuleHealthStatus({ isActive: false, conflictErrors: 3, conflictWarnings: 2 })).toBe(
      'inactive'
    );
  });

  it('regla activa con errores: "error", incluso si también hay advertencias', () => {
    expect(getRuleHealthStatus({ isActive: true, conflictErrors: 1, conflictWarnings: 1 })).toBe(
      'error'
    );
  });

  it('regla activa sin errores pero con advertencias: "warning"', () => {
    expect(getRuleHealthStatus({ isActive: true, conflictErrors: 0, conflictWarnings: 1 })).toBe(
      'warning'
    );
  });

  it('regla activa sin conflictos: "ok"', () => {
    expect(getRuleHealthStatus({ isActive: true, conflictErrors: 0, conflictWarnings: 0 })).toBe(
      'ok'
    );
  });
});

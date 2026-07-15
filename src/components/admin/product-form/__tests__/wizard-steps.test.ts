import { describe, it, expect } from 'vitest';
import {
  PRODUCT_FORM_WIZARD_STEPS,
  getStepProgressLabel,
  canNavigateToStep,
  nextMaxVisitedIndex,
  type WizardStepDef,
} from '../wizard-steps';

describe('PRODUCT_FORM_WIZARD_STEPS', () => {
  it('define exactamente 4 pasos en el orden del plan (Identificación, Precios, Contenido, Variantes y Medios)', () => {
    expect(PRODUCT_FORM_WIZARD_STEPS.map((s) => s.id)).toEqual([
      'identification',
      'pricing',
      'content',
      'variants_and_media',
    ]);
  });

  it('cada paso tiene una etiqueta en español no vacía', () => {
    for (const step of PRODUCT_FORM_WIZARD_STEPS) {
      expect(step.label.length).toBeGreaterThan(0);
    }
  });
});

describe('getStepProgressLabel', () => {
  it('formatea "N/total · Etiqueta"', () => {
    expect(getStepProgressLabel(0)).toBe('1/4 · Identificación');
    expect(getStepProgressLabel(1)).toBe('2/4 · Precios y visibilidad');
    expect(getStepProgressLabel(3)).toBe('4/4 · Variantes y Medios');
  });


  it('retorna cadena vacía si el índice está fuera de rango', () => {
    expect(getStepProgressLabel(-1)).toBe('');
    expect(getStepProgressLabel(99)).toBe('');
  });

  it('funciona con una lista de pasos custom', () => {
    const steps: WizardStepDef[] = [
      { id: 'identification', label: 'Uno', fields: [] },
      { id: 'pricing', label: 'Dos', fields: [] },
    ];
    expect(getStepProgressLabel(1, steps)).toBe('2/2 · Dos');
  });
});

describe('canNavigateToStep', () => {
  it('permite navegar a cualquier paso visitado (índice <= máximo visitado)', () => {
    expect(canNavigateToStep(0, 3)).toBe(true);
    expect(canNavigateToStep(3, 3)).toBe(true);
  });

  it('bloquea navegar a un paso no visitado aún (índice > máximo visitado)', () => {
    expect(canNavigateToStep(4, 3)).toBe(false);
  });

  it('bloquea índices negativos', () => {
    expect(canNavigateToStep(-1, 3)).toBe(false);
  });
});

describe('nextMaxVisitedIndex', () => {
  it('avanza el máximo cuando el nuevo índice es mayor', () => {
    expect(nextMaxVisitedIndex(1, 2)).toBe(2);
  });

  it('no retrocede el máximo al navegar hacia atrás a un paso ya visitado', () => {
    expect(nextMaxVisitedIndex(3, 1)).toBe(3);
  });

  it('se mantiene igual si el nuevo índice es el mismo', () => {
    expect(nextMaxVisitedIndex(2, 2)).toBe(2);
  });
});

import { describe, it, expect } from 'vitest';
import {
  QUOTE_EDITOR_WIZARD_STEPS,
  QUOTE_EDITOR_WIZARD_STEP_COUNT,
  getStepProgressLabel,
  canNavigateToStep,
  nextMaxVisitedIndex,
  isClientStepValid,
  isLinesStepValid,
  type QuoteEditorWizardStepDef,
} from '../wizard-steps';

describe('QUOTE_EDITOR_WIZARD_STEPS', () => {
  it('define exactamente 4 pasos en el orden del plan (Cliente, Líneas, Totales y vigencia, Notas y envío)', () => {
    expect(QUOTE_EDITOR_WIZARD_STEPS.map((s) => s.id)).toEqual(['client', 'lines', 'totals', 'notes']);
    expect(QUOTE_EDITOR_WIZARD_STEP_COUNT).toBe(4);
  });

  it('cada paso tiene una etiqueta en español no vacía', () => {
    for (const step of QUOTE_EDITOR_WIZARD_STEPS) {
      expect(step.label.length).toBeGreaterThan(0);
    }
  });
});

describe('getStepProgressLabel', () => {
  it('formatea "N/total · Etiqueta"', () => {
    expect(getStepProgressLabel(0)).toBe('1/4 · Cliente');
    expect(getStepProgressLabel(1)).toBe('2/4 · Líneas');
    expect(getStepProgressLabel(2)).toBe('3/4 · Totales y vigencia');
    expect(getStepProgressLabel(3)).toBe('4/4 · Notas y envío');
  });

  it('retorna cadena vacía si el índice está fuera de rango', () => {
    expect(getStepProgressLabel(-1)).toBe('');
    expect(getStepProgressLabel(99)).toBe('');
  });

  it('funciona con una lista de pasos custom', () => {
    const steps: QuoteEditorWizardStepDef[] = [
      { id: 'client', label: 'Uno' },
      { id: 'lines', label: 'Dos' },
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
    expect(canNavigateToStep(3, 1)).toBe(false);
  });

  it('bloquea índices negativos', () => {
    expect(canNavigateToStep(-1, 2)).toBe(false);
  });
});

describe('nextMaxVisitedIndex', () => {
  it('avanza el máximo cuando el nuevo índice es mayor', () => {
    expect(nextMaxVisitedIndex(0, 1)).toBe(1);
  });

  it('no retrocede el máximo al navegar hacia atrás a un paso ya visitado', () => {
    expect(nextMaxVisitedIndex(2, 0)).toBe(2);
  });

  it('se mantiene igual si el nuevo índice es el mismo', () => {
    expect(nextMaxVisitedIndex(1, 1)).toBe(1);
  });
});

describe('isClientStepValid', () => {
  it('rechaza nombre vacío o solo espacios', () => {
    expect(isClientStepValid({ customerName: '' })).toBe(false);
    expect(isClientStepValid({ customerName: '   ' })).toBe(false);
  });

  it('acepta nombre no vacío', () => {
    expect(isClientStepValid({ customerName: 'Clínica San Rafael' })).toBe(true);
  });
});

describe('isLinesStepValid', () => {
  it('rechaza sin líneas', () => {
    expect(isLinesStepValid({ itemCount: 0 })).toBe(false);
  });

  it('acepta con al menos una línea', () => {
    expect(isLinesStepValid({ itemCount: 1 })).toBe(true);
    expect(isLinesStepValid({ itemCount: 5 })).toBe(true);
  });
});

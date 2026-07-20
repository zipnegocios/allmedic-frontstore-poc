import { describe, it, expect } from 'vitest';
import {
  SET_FORM_WIZARD_STEPS,
  getStepProgressLabel,
  canNavigateToStep,
  nextMaxVisitedIndex,
  type SetFormWizardStepDef,
} from '../wizard-steps';

describe('SET_FORM_WIZARD_STEPS', () => {
  it('define exactamente 4 pasos en el orden del plan (Datos generales, Piezas, Precio, Reglas)', () => {
    expect(SET_FORM_WIZARD_STEPS.map((s) => s.id)).toEqual([
      'general',
      'pieces',
      'price',
      'rules',
    ]);
  });

  it('el paso de reglas va al final (depende de que el set ya exista)', () => {
    expect(SET_FORM_WIZARD_STEPS[SET_FORM_WIZARD_STEPS.length - 1].id).toBe('rules');
  });

  it('cada paso tiene una etiqueta en español no vacía', () => {
    for (const step of SET_FORM_WIZARD_STEPS) {
      expect(step.label.length).toBeGreaterThan(0);
    }
  });

  it('solo "general" y "pieces" tienen campos que bloquean el avance', () => {
    const general = SET_FORM_WIZARD_STEPS.find((s) => s.id === 'general')!;
    const pieces = SET_FORM_WIZARD_STEPS.find((s) => s.id === 'pieces')!;
    const price = SET_FORM_WIZARD_STEPS.find((s) => s.id === 'price')!;
    const rules = SET_FORM_WIZARD_STEPS.find((s) => s.id === 'rules')!;

    expect(general.fields).toEqual(['name', 'slug', 'coverAssetId', 'secondaryCoverAssetId']);
    expect(pieces.fields).toEqual(['items']);
    expect(price.fields).toEqual([]);
    expect(rules.fields).toEqual([]);
  });
});

describe('getStepProgressLabel', () => {
  it('formatea "N/total · Etiqueta"', () => {
    expect(getStepProgressLabel(0)).toBe('1/4 · Datos generales');
    expect(getStepProgressLabel(1)).toBe('2/4 · Piezas del set');
    expect(getStepProgressLabel(3)).toBe('4/4 · Reglas del set');
  });

  it('retorna cadena vacía si el índice está fuera de rango', () => {
    expect(getStepProgressLabel(-1)).toBe('');
    expect(getStepProgressLabel(99)).toBe('');
  });

  it('funciona con una lista de pasos custom', () => {
    const steps: SetFormWizardStepDef[] = [
      { id: 'general', label: 'Uno', fields: [] },
      { id: 'pieces', label: 'Dos', fields: [] },
    ];
    expect(getStepProgressLabel(1, steps)).toBe('2/2 · Dos');
  });
});

describe('canNavigateToStep', () => {
  it('permite navegar a cualquier paso visitado (índice <= máximo visitado)', () => {
    expect(canNavigateToStep(0, 2)).toBe(true);
    expect(canNavigateToStep(2, 2)).toBe(true);
  });

  it('bloquea navegar a un paso no visitado aún (índice > máximo visitado)', () => {
    expect(canNavigateToStep(3, 2)).toBe(false);
  });

  it('bloquea índices negativos', () => {
    expect(canNavigateToStep(-1, 2)).toBe(false);
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

import { describe, it, expect } from 'vitest';
import {
  RULE_FORM_WIZARD_STEPS,
  RULE_FORM_WIZARD_STEP_COUNT,
  getStepProgressLabel,
  canNavigateToStep,
  nextMaxVisitedIndex,
  isTypeScopeStepValid,
  isConfigStepValid,
  type RuleFormWizardStepDef,
} from '../wizard-steps';

describe('RULE_FORM_WIZARD_STEPS', () => {
  it('define exactamente 3 pasos en el orden del plan (Tipo y ámbito, Configuración, Revisión y conflictos)', () => {
    expect(RULE_FORM_WIZARD_STEPS.map((s) => s.id)).toEqual(['type-scope', 'config', 'review']);
    expect(RULE_FORM_WIZARD_STEP_COUNT).toBe(3);
  });

  it('cada paso tiene una etiqueta en español no vacía', () => {
    for (const step of RULE_FORM_WIZARD_STEPS) {
      expect(step.label.length).toBeGreaterThan(0);
    }
  });
});

describe('getStepProgressLabel', () => {
  it('formatea "N/total · Etiqueta"', () => {
    expect(getStepProgressLabel(0)).toBe('1/3 · Tipo y ámbito');
    expect(getStepProgressLabel(1)).toBe('2/3 · Configuración');
    expect(getStepProgressLabel(2)).toBe('3/3 · Revisión y conflictos');
  });

  it('retorna cadena vacía si el índice está fuera de rango', () => {
    expect(getStepProgressLabel(-1)).toBe('');
    expect(getStepProgressLabel(99)).toBe('');
  });

  it('funciona con una lista de pasos custom', () => {
    const steps: RuleFormWizardStepDef[] = [
      { id: 'type-scope', label: 'Uno' },
      { id: 'config', label: 'Dos' },
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
    expect(canNavigateToStep(2, 1)).toBe(false);
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

describe('isTypeScopeStepValid', () => {
  it('rechaza nombre vacío o solo espacios', () => {
    expect(isTypeScopeStepValid({ name: '', scope: 'GLOBAL', scopeId: null })).toBe(false);
    expect(isTypeScopeStepValid({ name: '   ', scope: 'GLOBAL', scopeId: null })).toBe(false);
  });

  it('acepta ámbito Global sin scopeId', () => {
    expect(isTypeScopeStepValid({ name: 'Regla X', scope: 'GLOBAL', scopeId: null })).toBe(true);
  });

  it('rechaza ámbito no-Global sin scopeId seleccionado', () => {
    expect(isTypeScopeStepValid({ name: 'Regla X', scope: 'BRAND', scopeId: null })).toBe(false);
  });

  it('acepta ámbito no-Global con scopeId seleccionado', () => {
    expect(isTypeScopeStepValid({ name: 'Regla X', scope: 'BRAND', scopeId: 'brand-1' })).toBe(true);
  });
});

describe('isConfigStepValid', () => {
  it('siempre válido para tipos que no son PROMO', () => {
    expect(isConfigStepValid({ ruleType: 'MIN_QUANTITY', config: {} })).toBe(true);
    expect(isConfigStepValid({ ruleType: 'COLOR_RESTRICTION', config: {} })).toBe(true);
  });

  it('PROMO no-THRESHOLD/GIFT/COMBO es válido sin chequeo adicional', () => {
    expect(isConfigStepValid({ ruleType: 'PROMO', config: { kind: 'N_PLUS_ONE', buy: 13, free: 1 } })).toBe(true);
  });

  describe('PROMO THRESHOLD_DISCOUNT', () => {
    it('rechaza cuando pct y amount están ambos definidos', () => {
      expect(
        isConfigStepValid({ ruleType: 'PROMO', config: { kind: 'THRESHOLD_DISCOUNT', pct: 10, amount: 5 } })
      ).toBe(false);
    });

    it('rechaza cuando ni pct ni amount están definidos', () => {
      expect(isConfigStepValid({ ruleType: 'PROMO', config: { kind: 'THRESHOLD_DISCOUNT' } })).toBe(false);
    });

    it('acepta exactamente uno de los dos', () => {
      expect(
        isConfigStepValid({ ruleType: 'PROMO', config: { kind: 'THRESHOLD_DISCOUNT', pct: 10 } })
      ).toBe(true);
      expect(
        isConfigStepValid({ ruleType: 'PROMO', config: { kind: 'THRESHOLD_DISCOUNT', amount: 5 } })
      ).toBe(true);
    });
  });

  describe('PROMO GIFT', () => {
    it('rechaza sin minQty ni minSubtotal', () => {
      expect(
        isConfigStepValid({ ruleType: 'PROMO', config: { kind: 'GIFT', description: 'Gorro' } })
      ).toBe(false);
    });

    it('rechaza sin descripción aunque tenga minQty', () => {
      expect(
        isConfigStepValid({ ruleType: 'PROMO', config: { kind: 'GIFT', minQty: 12, description: '' } })
      ).toBe(false);
    });

    it('acepta con minQty y descripción', () => {
      expect(
        isConfigStepValid({ ruleType: 'PROMO', config: { kind: 'GIFT', minQty: 12, description: 'Gorro' } })
      ).toBe(true);
    });
  });

  describe('PROMO COMBO', () => {
    it('rechaza sin triggerSetId o sin targetSetId', () => {
      expect(
        isConfigStepValid({ ruleType: 'PROMO', config: { kind: 'COMBO', triggerSetId: '', targetSetId: 'set-2' } })
      ).toBe(false);
      expect(
        isConfigStepValid({ ruleType: 'PROMO', config: { kind: 'COMBO', triggerSetId: 'set-1', targetSetId: '' } })
      ).toBe(false);
    });

    it('acepta con ambos sets seleccionados', () => {
      expect(
        isConfigStepValid({ ruleType: 'PROMO', config: { kind: 'COMBO', triggerSetId: 'set-1', targetSetId: 'set-2' } })
      ).toBe(true);
    });
  });
});

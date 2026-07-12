import { describe, it, expect } from "vitest";
import { detectConflicts } from "../conflicts";
import type { BusinessRule } from "../types";

function rule(overrides: Partial<BusinessRule>): BusinessRule {
  return {
    id: overrides.id ?? "existing-1",
    name: overrides.name ?? "Regla existente",
    ruleType: overrides.ruleType ?? "MIN_QUANTITY",
    scope: overrides.scope ?? "GLOBAL",
    scopeId: overrides.scopeId ?? null,
    config: overrides.config ?? {},
    isActive: overrides.isActive ?? true,
    priority: overrides.priority ?? 0,
    validFrom: overrides.validFrom ?? null,
    validTo: overrides.validTo ?? null,
  };
}

function candidate(overrides: Partial<BusinessRule>): BusinessRule {
  return rule({ id: "", name: "Regla nueva", ...overrides });
}

describe("detectConflicts — DUPLICATE_SAME_SCOPE", () => {
  it("ERROR cuando existe una regla activa idéntica en tipo/ámbito con la misma prioridad", () => {
    const existing = [rule({ id: "e1", ruleType: "MIN_QUANTITY", scope: "GLOBAL", priority: 0 })];
    const candidateRule = candidate({ ruleType: "MIN_QUANTITY", scope: "GLOBAL", priority: 0 });
    const conflicts = detectConflicts(candidateRule, existing);
    const dup = conflicts.find((c) => c.code === "DUPLICATE_SAME_SCOPE");
    expect(dup?.severity).toBe("ERROR");
    expect(dup?.conflictingRuleId).toBe("e1");
  });

  it("WARNING cuando la prioridad es distinta (el desempate es determinístico)", () => {
    const existing = [rule({ id: "e1", ruleType: "MIN_QUANTITY", scope: "GLOBAL", priority: 5 })];
    const candidateRule = candidate({ ruleType: "MIN_QUANTITY", scope: "GLOBAL", priority: 1 });
    const conflicts = detectConflicts(candidateRule, existing);
    const dup = conflicts.find((c) => c.code === "DUPLICATE_SAME_SCOPE");
    expect(dup?.severity).toBe("WARNING");
  });

  it("no hay conflicto si el scopeId es distinto", () => {
    const existing = [rule({ id: "e1", ruleType: "MULTIPLES_ONLY", scope: "SET", scopeId: "set-a", priority: 0 })];
    const candidateRule = candidate({ ruleType: "MULTIPLES_ONLY", scope: "SET", scopeId: "set-b", priority: 0 });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.find((c) => c.code === "DUPLICATE_SAME_SCOPE")).toBeUndefined();
  });

  it("no hay conflicto si las ventanas de vigencia no se solapan", () => {
    const existing = [
      rule({
        id: "e1", ruleType: "MIN_QUANTITY", scope: "GLOBAL", priority: 0,
        validFrom: "2026-01-01", validTo: "2026-02-01",
      }),
    ];
    const candidateRule = candidate({
      ruleType: "MIN_QUANTITY", scope: "GLOBAL", priority: 0,
      validFrom: "2026-03-01", validTo: "2026-04-01",
    });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.find((c) => c.code === "DUPLICATE_SAME_SCOPE")).toBeUndefined();
  });

  it("ignora reglas inactivas al buscar duplicados", () => {
    const existing = [rule({ id: "e1", ruleType: "MIN_QUANTITY", scope: "GLOBAL", priority: 0, isActive: false })];
    const candidateRule = candidate({ ruleType: "MIN_QUANTITY", scope: "GLOBAL", priority: 0 });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.find((c) => c.code === "DUPLICATE_SAME_SCOPE")).toBeUndefined();
  });

  it("no se compara consigo misma en modo edición (mismo id)", () => {
    const existing = [rule({ id: "same-id", ruleType: "MIN_QUANTITY", scope: "GLOBAL", priority: 0 })];
    const candidateRule = candidate({ id: "same-id", ruleType: "MIN_QUANTITY", scope: "GLOBAL", priority: 0 });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.find((c) => c.code === "DUPLICATE_SAME_SCOPE")).toBeUndefined();
  });
});

describe("detectConflicts — INACTIVE_TWIN", () => {
  it("INFO cuando existe una regla idéntica pero desactivada", () => {
    const existing = [
      rule({ id: "e1", ruleType: "MIN_QUANTITY", scope: "GLOBAL", scopeId: null, isActive: false, config: { min: 12, countUnit: "SETS" } }),
    ];
    const candidateRule = candidate({ ruleType: "MIN_QUANTITY", scope: "GLOBAL", scopeId: null, config: { min: 12, countUnit: "SETS" } });
    const conflicts = detectConflicts(candidateRule, existing);
    const twin = conflicts.find((c) => c.code === "INACTIVE_TWIN");
    expect(twin?.severity).toBe("INFO");
    expect(twin?.conflictingRuleId).toBe("e1");
  });
});

describe("detectConflicts — SHADOWED_BY_SPECIFIC / SHADOWS_BROADER", () => {
  it("SHADOWED_BY_SPECIFIC: una regla GLOBAL nueva es eclipsada por una regla SET existente del mismo tipo", () => {
    const existing = [rule({ id: "e1", ruleType: "MULTIPLES_ONLY", scope: "SET", scopeId: "set-a", isActive: true })];
    const candidateRule = candidate({ ruleType: "MULTIPLES_ONLY", scope: "GLOBAL" });
    const conflicts = detectConflicts(candidateRule, existing);
    const info = conflicts.find((c) => c.code === "SHADOWED_BY_SPECIFIC");
    expect(info?.severity).toBe("INFO");
    expect(info?.conflictingRuleId).toBe("e1");
  });

  it("SHADOWS_BROADER: una regla SET nueva eclipsará una regla GLOBAL existente del mismo tipo", () => {
    const existing = [rule({ id: "e1", ruleType: "MULTIPLES_ONLY", scope: "GLOBAL", isActive: true })];
    const candidateRule = candidate({ ruleType: "MULTIPLES_ONLY", scope: "SET", scopeId: "set-a" });
    const conflicts = detectConflicts(candidateRule, existing);
    const info = conflicts.find((c) => c.code === "SHADOWS_BROADER");
    expect(info?.severity).toBe("INFO");
    expect(info?.conflictingRuleId).toBe("e1");
  });
});

describe("detectConflicts — semánticas entre tipos", () => {
  it("MIN_ABOVE_RANGE_MAX: ERROR si el mínimo nuevo supera el máximo de un QUANTITY_RANGE existente en el mismo ámbito", () => {
    const existing = [rule({ id: "e1", ruleType: "QUANTITY_RANGE", scope: "GLOBAL", config: { min: 1, max: 10 } })];
    const candidateRule = candidate({ ruleType: "MIN_QUANTITY", scope: "GLOBAL", config: { min: 12, countUnit: "SETS" } });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.some((c) => c.code === "MIN_ABOVE_RANGE_MAX" && c.severity === "ERROR")).toBe(true);
  });

  it("MIN_ABOVE_RANGE_MAX: sin conflicto si el rango no tiene máximo (null)", () => {
    const existing = [rule({ id: "e1", ruleType: "QUANTITY_RANGE", scope: "GLOBAL", config: { min: 1, max: null } })];
    const candidateRule = candidate({ ruleType: "MIN_QUANTITY", scope: "GLOBAL", config: { min: 100, countUnit: "SETS" } });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.some((c) => c.code === "MIN_ABOVE_RANGE_MAX")).toBe(false);
  });

  it("MIN_NOT_MULTIPLE: WARNING si el mínimo no es múltiplo de MULTIPLES_ONLY existente", () => {
    const existing = [rule({ id: "e1", ruleType: "MULTIPLES_ONLY", scope: "GLOBAL", config: { multipleOf: 5 } })];
    const candidateRule = candidate({ ruleType: "MIN_QUANTITY", scope: "GLOBAL", config: { min: 12, countUnit: "SETS" } });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.some((c) => c.code === "MIN_NOT_MULTIPLE" && c.severity === "WARNING")).toBe(true);
  });

  it("RANGE_EXCLUDES_MULTIPLES: ERROR si ningún múltiplo cae dentro del rango", () => {
    const existing = [rule({ id: "e1", ruleType: "MULTIPLES_ONLY", scope: "GLOBAL", config: { multipleOf: 20 } })];
    const candidateRule = candidate({ ruleType: "QUANTITY_RANGE", scope: "GLOBAL", config: { min: 1, max: 10 } });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.some((c) => c.code === "RANGE_EXCLUDES_MULTIPLES" && c.severity === "ERROR")).toBe(true);
  });

  it("PROMO_UNREACHABLE: WARNING si buy supera el máximo permitido (N_PLUS_ONE)", () => {
    const existing = [rule({ id: "e1", ruleType: "QUANTITY_RANGE", scope: "SET", scopeId: "set-a", config: { min: 1, max: 10 } })];
    const candidateRule = candidate({ ruleType: "PROMO", scope: "SET", scopeId: "set-a", config: { kind: "N_PLUS_ONE", buy: 13, free: 1 } });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.some((c) => c.code === "PROMO_UNREACHABLE" && c.severity === "WARNING")).toBe(true);
  });

  it("PROMO_UNREACHABLE: no aplica a tipos de PROMO sin campo 'buy' (ej. PERCENT_OFF)", () => {
    const existing = [rule({ id: "e1", ruleType: "QUANTITY_RANGE", scope: "SET", scopeId: "set-a", config: { min: 1, max: 10 } })];
    const candidateRule = candidate({ ruleType: "PROMO", scope: "SET", scopeId: "set-a", config: { kind: "PERCENT_OFF", pct: 20 } });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.some((c) => c.code === "PROMO_UNREACHABLE")).toBe(false);
  });

  it("PROMO_DOUBLE_DISCOUNT: WARNING si FIXED_PRICE coexiste con PERCENT_OFF en el mismo ámbito", () => {
    const existing = [rule({ id: "e1", ruleType: "PROMO", scope: "SET", scopeId: "set-a", config: { kind: "PERCENT_OFF", pct: 10 } })];
    const candidateRule = candidate({ ruleType: "PROMO", scope: "SET", scopeId: "set-a", config: { kind: "FIXED_PRICE", price: 50 } });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.some((c) => c.code === "PROMO_DOUBLE_DISCOUNT" && c.severity === "WARNING")).toBe(true);
  });

  it("PROMO_DOUBLE_DISCOUNT: WARNING también en la dirección inversa (candidato PERCENT_OFF vs FIXED_PRICE existente)", () => {
    const existing = [rule({ id: "e1", ruleType: "PROMO", scope: "GLOBAL", config: { kind: "FIXED_PRICE", price: 50 } })];
    const candidateRule = candidate({ ruleType: "PROMO", scope: "GLOBAL", config: { kind: "FIXED_AMOUNT_OFF", amountPerUnit: 5 } });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.some((c) => c.code === "PROMO_DOUBLE_DISCOUNT" && c.severity === "WARNING")).toBe(true);
  });

  it("PROMO_DOUBLE_DISCOUNT: sin conflicto entre dos PERCENT_OFF (no involucra FIXED_PRICE)", () => {
    const existing = [rule({ id: "e1", ruleType: "PROMO", scope: "GLOBAL", config: { kind: "PERCENT_OFF", pct: 10 } })];
    const candidateRule = candidate({ ruleType: "PROMO", scope: "GLOBAL", config: { kind: "PERCENT_OFF", pct: 5 } });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.some((c) => c.code === "PROMO_DOUBLE_DISCOUNT")).toBe(false);
  });

  it("DISCOUNT_ON_HIDDEN_PRICES: no aplica a PROMO GIFT (sin efecto monetario que ocultar)", () => {
    const existing = [
      rule({ id: "e1", ruleType: "PRICE_VISIBILITY", scope: "GLOBAL", config: { showPrices: false, catalog: "CORPORATE" } }),
    ];
    const candidateRule = candidate({
      ruleType: "PROMO", scope: "GLOBAL",
      config: { kind: "GIFT", minQty: 12, description: "Regalo de cortesía" },
    });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.some((c) => c.code === "DISCOUNT_ON_HIDDEN_PRICES")).toBe(false);
  });

  it("TIERS_BELOW_MIN: WARNING si algún tramo queda bajo el mínimo efectivo", () => {
    const existing = [rule({ id: "e1", ruleType: "MIN_QUANTITY", scope: "GLOBAL", config: { min: 12, countUnit: "SETS" } })];
    const candidateRule = candidate({
      ruleType: "VOLUME_SCALE", scope: "GLOBAL",
      config: { tiers: [{ minQty: 5, discountPct: 3 }, { minQty: 50, discountPct: 8 }] },
    });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.some((c) => c.code === "TIERS_BELOW_MIN" && c.severity === "WARNING")).toBe(true);
  });

  it("TIERS_NOT_ASCENDING: ERROR si los tramos están desordenados o con pct fuera de rango", () => {
    const candidateRule = candidate({
      ruleType: "VOLUME_SCALE", scope: "GLOBAL",
      config: { tiers: [{ minQty: 50, discountPct: 8 }, { minQty: 12, discountPct: 0 }] },
    });
    const conflicts = detectConflicts(candidateRule, []);
    expect(conflicts.some((c) => c.code === "TIERS_NOT_ASCENDING" && c.severity === "ERROR")).toBe(true);
  });

  it("TIERS_NOT_ASCENDING: ERROR si algún pct está fuera de [0, 100]", () => {
    const candidateRule = candidate({
      ruleType: "VOLUME_DISCOUNT_RETAIL", scope: "GLOBAL",
      config: { tiers: [{ minItems: 3, pct: 150 }] },
    });
    const conflicts = detectConflicts(candidateRule, []);
    expect(conflicts.some((c) => c.code === "TIERS_NOT_ASCENDING" && c.severity === "ERROR")).toBe(true);
  });

  it("DISCOUNT_ON_HIDDEN_PRICES: WARNING si hay un descuento donde los precios están ocultos", () => {
    const existing = [
      rule({ id: "e1", ruleType: "PRICE_VISIBILITY", scope: "GLOBAL", config: { showPrices: false, catalog: "CORPORATE" } }),
    ];
    const candidateRule = candidate({
      ruleType: "VOLUME_SCALE", scope: "GLOBAL",
      config: { tiers: [{ minQty: 12, discountPct: 8 }] },
    });
    const conflicts = detectConflicts(candidateRule, existing);
    expect(conflicts.some((c) => c.code === "DISCOUNT_ON_HIDDEN_PRICES" && c.severity === "WARNING")).toBe(true);
  });

  it("EXPIRED_ON_CREATE: WARNING si validTo ya pasó al momento de crear", () => {
    const candidateRule = candidate({ ruleType: "MIN_QUANTITY", scope: "GLOBAL", validTo: "2020-01-01" });
    const conflicts = detectConflicts(candidateRule, [], new Date("2026-07-13"));
    expect(conflicts.some((c) => c.code === "EXPIRED_ON_CREATE" && c.severity === "WARNING")).toBe(true);
  });

  it("sin reglas conflictivas, no reporta nada", () => {
    const conflicts = detectConflicts(
      candidate({ ruleType: "SIZE_MODE", scope: "GLOBAL", config: { mode: "MATRIX" } }),
      []
    );
    expect(conflicts).toEqual([]);
  });
});

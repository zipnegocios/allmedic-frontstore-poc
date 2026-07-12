import { describe, it, expect } from "vitest";
import { resolveRules } from "../resolve";
import { validateCorporateCart } from "../validate";
import { computeCartPricing } from "../pricing";
import type { BusinessRule, CorporateCart } from "../types";

function rule(overrides: Partial<BusinessRule>): BusinessRule {
  return {
    id: overrides.id ?? "rule-1",
    name: overrides.name ?? "Regla de prueba",
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

describe("resolveRules", () => {
  it("aplica los defaults del sistema cuando no hay reglas", () => {
    const resolved = resolveRules([], {});
    expect(resolved.minQuantity).toEqual({ min: 12, countUnit: "SETS" });
    expect(resolved.sizeMode).toEqual({ mode: "MATRIX" });
    expect(resolved.inventoryMode).toEqual({ mode: "IGNORE" });
    expect(resolved.priceVisibility).toEqual({ showPrices: true, catalog: "BOTH" });
  });

  it("una regla SET específica sobreescribe la regla GLOBAL", () => {
    const rules = [
      rule({ id: "g1", ruleType: "MIN_QUANTITY", scope: "GLOBAL", config: { min: 12, countUnit: "SETS" } }),
      rule({ id: "s1", ruleType: "MIN_QUANTITY", scope: "SET", scopeId: "set-abc", config: { min: 6, countUnit: "SETS" } }),
    ];
    const resolved = resolveRules(rules, { setId: "set-abc" });
    expect(resolved.minQuantity.min).toBe(6);
  });

  it("respeta la jerarquía SET > SET_GROUP > BRAND > GLOBAL", () => {
    const rules = [
      rule({ id: "g", ruleType: "SIZE_MODE", scope: "GLOBAL", config: { mode: "MATRIX" } }),
      rule({ id: "b", ruleType: "SIZE_MODE", scope: "BRAND", scopeId: "brand-1", config: { mode: "PER_PIECE" } }),
      rule({ id: "sg", ruleType: "SIZE_MODE", scope: "SET_GROUP", scopeId: "group-1", config: { mode: "NO_SIZES" } }),
    ];
    const resolved = resolveRules(rules, { brandId: "brand-1", setGroupId: "group-1" });
    expect(resolved.sizeMode.mode).toBe("NO_SIZES");
  });

  it("ignora reglas inactivas", () => {
    const rules = [
      rule({ ruleType: "MIN_QUANTITY", scope: "GLOBAL", isActive: false, config: { min: 99, countUnit: "SETS" } }),
    ];
    const resolved = resolveRules(rules, {});
    expect(resolved.minQuantity.min).toBe(12); // default
  });

  it("ignora reglas fuera de su ventana de vigencia", () => {
    const past = new Date("2020-01-01");
    const rules = [
      rule({
        ruleType: "MIN_QUANTITY",
        scope: "GLOBAL",
        config: { min: 99, countUnit: "SETS" },
        validTo: past,
      }),
    ];
    const resolved = resolveRules(rules, {}, new Date());
    expect(resolved.minQuantity.min).toBe(12);
  });

  it("recolecta todas las restricciones de color aplicables (multi-instancia)", () => {
    const rules = [
      rule({ id: "c1", ruleType: "COLOR_RESTRICTION", scope: "GLOBAL", config: { colorCode: "PINK", min: 6 } }),
      rule({ id: "c2", ruleType: "COLOR_RESTRICTION", scope: "GLOBAL", config: { colorCode: "RED", min: 3 } }),
    ];
    const resolved = resolveRules(rules, {});
    expect(resolved.colorRestrictions).toHaveLength(2);
  });
});

describe("validateCorporateCart — mínimo de sets", () => {
  const rules = [rule({ ruleType: "MIN_QUANTITY", scope: "GLOBAL", config: { min: 12, countUnit: "SETS" } })];

  it("bloquea el envío con 11 sets", () => {
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-1",
          setName: "Uniforme FIGS",
          sizeMode: "MATRIX",
          lines: [{ size: "M", quantity: 11 }],
        },
      ],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.canSubmit).toBe(false);
    expect(result.totalSets).toBe(11);
    expect(result.setsRemaining).toBe(1);
    expect(result.violations.some((v) => v.code === "MIN_QUANTITY")).toBe(true);
    expect(result.violations[0].message).toContain("1 set más");
  });

  it("permite el envío con 12 sets", () => {
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-1",
          setName: "Uniforme FIGS",
          sizeMode: "MATRIX",
          lines: [{ size: "M", quantity: 12 }],
        },
      ],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.canSubmit).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("suma cantidades de múltiples sets y líneas para el total", () => {
    const cart: CorporateCart = {
      items: [
        { setId: "set-1", sizeMode: "MATRIX", lines: [{ size: "S", quantity: 4 }, { size: "M", quantity: 4 }] },
        { setId: "set-2", sizeMode: "NO_SIZES", lines: [{ quantity: 4 }] },
      ],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.totalSets).toBe(12);
    expect(result.canSubmit).toBe(true);
  });
});

describe("validateCorporateCart — matriz de tallas (SIZE_MODE)", () => {
  const rules: BusinessRule[] = [];

  it("exige talla cuando el modo resuelto es MATRIX", () => {
    const cart: CorporateCart = {
      items: [{ setId: "set-1", setName: "Set X", sizeMode: "MATRIX", lines: [{ quantity: 12 }] }],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.violations.some((v) => v.code === "MISSING_SIZE")).toBe(true);
  });

  it("no exige talla cuando el modo es NO_SIZES", () => {
    const cart: CorporateCart = {
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 12 }] }],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.violations.some((v) => v.code === "MISSING_SIZE")).toBe(false);
  });

  it("exige pieceSelections cuando el modo es PER_PIECE", () => {
    const cart: CorporateCart = {
      items: [{ setId: "set-1", setName: "Set Y", sizeMode: "PER_PIECE", lines: [{ quantity: 12 }] }],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.violations.some((v) => v.code === "MISSING_PIECE_SELECTIONS")).toBe(true);
  });
});

describe("validateCorporateCart — reglas adicionales", () => {
  it("MULTIPLES_ONLY rechaza cantidades que no son múltiplo exacto", () => {
    const rules = [rule({ ruleType: "MULTIPLES_ONLY", scope: "GLOBAL", config: { multipleOf: 6 } })];
    const cart: CorporateCart = {
      items: [{ setId: "set-1", setName: "Set Z", sizeMode: "NO_SIZES", lines: [{ quantity: 13 }] }],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.violations.some((v) => v.code === "MULTIPLES_ONLY")).toBe(true);
  });

  it("MULTIPLES_ONLY acepta múltiplos exactos", () => {
    const rules = [rule({ ruleType: "MULTIPLES_ONLY", scope: "GLOBAL", config: { multipleOf: 6 } })];
    const cart: CorporateCart = {
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 12 }] }],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.violations.some((v) => v.code === "MULTIPLES_ONLY")).toBe(false);
  });

  it("COLOR_RESTRICTION exige mínimo por color", () => {
    const rules = [rule({ ruleType: "COLOR_RESTRICTION", scope: "GLOBAL", config: { colorCode: "PINK", min: 6 } })];
    const cart: CorporateCart = {
      items: [{ setId: "set-1", setName: "Set Rosa", sizeMode: "NO_SIZES", lines: [{ quantity: 3, color: "PINK" }] }],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.violations.some((v) => v.code === "COLOR_RESTRICTION")).toBe(true);
  });
});

describe("computeCartPricing — escala de volumen", () => {
  it("calcula subtotal sin descuento cuando no hay VOLUME_SCALE", () => {
    const cart: CorporateCart = {
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 12 }] }],
    };
    const result = computeCartPricing(cart, { "set-1": { pricePerSet: 50, hasMissingPrices: false } }, []);
    expect(result.subtotalBeforeDiscount).toBe(600);
    expect(result.volumeDiscountPct).toBe(0);
    expect(result.total).toBe(600);
  });

  it("aplica el tier de descuento correcto según el total de sets", () => {
    const rules = [
      rule({
        ruleType: "VOLUME_SCALE",
        scope: "GLOBAL",
        config: {
          tiers: [
            { minQty: 12, discountPct: 0 },
            { minQty: 50, discountPct: 8 },
          ],
        },
      }),
    ];
    const cart: CorporateCart = {
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 60 }] }],
    };
    const result = computeCartPricing(
      cart,
      { "set-1": { pricePerSet: 10, hasMissingPrices: false } },
      rules
    );
    expect(result.volumeDiscountPct).toBe(8);
    expect(result.subtotalBeforeDiscount).toBe(600);
    expect(result.volumeDiscountAmount).toBe(48);
    expect(result.total).toBe(552);
  });

  it("marca hasMissingPrices cuando alguna pieza no tiene precio al mayor", () => {
    const cart: CorporateCart = {
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 12 }] }],
    };
    const result = computeCartPricing(
      cart,
      { "set-1": { pricePerSet: 0, hasMissingPrices: true } },
      []
    );
    expect(result.hasMissingPrices).toBe(true);
  });
});

describe("resolveRules — VOLUME_DISCOUNT_RETAIL (descuento catálogo individual)", () => {
  it("resuelve VOLUME_DISCOUNT_RETAIL desde una regla GLOBAL", () => {
    const rules = [
      rule({
        ruleType: "VOLUME_DISCOUNT_RETAIL",
        scope: "GLOBAL",
        config: { tiers: [{ minItems: 3, pct: 10 }] },
      }),
    ];
    const resolved = resolveRules(rules, {}, new Date());
    expect(resolved.volumeDiscountRetail?.tiers).toEqual([{ minItems: 3, pct: 10 }]);
  });

  it("devuelve null cuando no hay regla VOLUME_DISCOUNT_RETAIL activa", () => {
    const resolved = resolveRules([], {}, new Date());
    expect(resolved.volumeDiscountRetail).toBeNull();
  });
});

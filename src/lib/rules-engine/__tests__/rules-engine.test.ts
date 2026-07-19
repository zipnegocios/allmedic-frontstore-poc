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
          lines: [{ quantity: 11, pieceSelections: [{ productId: "prod-1", size: "M" }] }],
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
          lines: [{ quantity: 12, pieceSelections: [{ productId: "prod-1", size: "M" }] }],
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
        {
          setId: "set-1",
          sizeMode: "MATRIX",
          lines: [
            { quantity: 4, pieceSelections: [{ productId: "prod-1", size: "S" }] },
            { quantity: 4, pieceSelections: [{ productId: "prod-1", size: "M" }] },
          ],
        },
        { setId: "set-2", sizeMode: "NO_SIZES", lines: [{ quantity: 4, pieceSelections: [{ productId: "prod-2" }] }] },
      ],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.totalSets).toBe(12);
    expect(result.canSubmit).toBe(true);
  });

  it("countUnit por defecto (SETS) reporta countUnit: 'SETS' en el resultado", () => {
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-1",
          sizeMode: "MATRIX",
          lines: [{ quantity: 12, pieceSelections: [{ productId: "prod-1", size: "M" }] }],
        },
      ],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.countUnit).toBe("SETS");
  });
});

describe("validateCorporateCart — mínimo con countUnit: PIECES", () => {
  const rules = [rule({ ruleType: "MIN_QUANTITY", scope: "GLOBAL", config: { min: 24, countUnit: "PIECES" } })];

  it("cuenta piezas reales (quantity de sets × piezas por set), no sets", () => {
    // set-1 tiene 2 piezas por set (ej. camisa + pantalón); 10 sets = 20 piezas, bajo el mínimo de 24
    const cart: CorporateCart = {
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 10, pieceSelections: [{ productId: "prod-1" }] }] }],
    };
    const setMeta = { "set-1": { piecesPerSet: 2 } };
    const result = validateCorporateCart(cart, rules, setMeta);
    expect(result.countUnit).toBe("PIECES");
    expect(result.totalSets).toBe(20); // 10 sets * 2 piezas
    expect(result.canSubmit).toBe(false);
    expect(result.setsRemaining).toBe(4);
    expect(result.violations.some((v) => v.code === "MIN_QUANTITY")).toBe(true);
    expect(result.violations[0].message).toContain("piezas");
  });

  it("permite el envío cuando las piezas reales alcanzan el mínimo", () => {
    const cart: CorporateCart = {
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 12, pieceSelections: [{ productId: "prod-1" }] }] }],
    };
    const setMeta = { "set-1": { piecesPerSet: 2 } };
    const result = validateCorporateCart(cart, rules, setMeta);
    expect(result.totalSets).toBe(24); // 12 sets * 2 piezas
    expect(result.canSubmit).toBe(true);
  });

  it("sin piecesPerSet en setMeta, asume 1 pieza por set (fallback seguro, no rompe)", () => {
    const cart: CorporateCart = {
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 24, pieceSelections: [{ productId: "prod-1" }] }] }],
    };
    const result = validateCorporateCart(cart, rules, {});
    expect(result.totalSets).toBe(24);
    expect(result.canSubmit).toBe(true);
  });
});

describe("validateCorporateCart — armador de combinaciones (estructura unificada)", () => {
  const rules: BusinessRule[] = [];

  it("exige talla por pieza cuando el modo resuelto es MATRIX", () => {
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-1",
          setName: "Set X",
          sizeMode: "MATRIX",
          lines: [{ quantity: 12, pieceSelections: [{ productId: "prod-1" }] }],
        },
      ],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.violations.some((v) => v.code === "MISSING_SIZE")).toBe(true);
  });

  it("no exige talla cuando el modo es NO_SIZES", () => {
    const cart: CorporateCart = {
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 12, pieceSelections: [{ productId: "prod-1" }] }] }],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.violations.some((v) => v.code === "MISSING_SIZE")).toBe(false);
  });

  it("exige al menos una combinación (pieceSelections) sin importar el modo", () => {
    const cart: CorporateCart = {
      items: [{ setId: "set-1", setName: "Set Y", sizeMode: "PER_PIECE", lines: [{ quantity: 12, pieceSelections: [] }] }],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.violations.some((v) => v.code === "MISSING_PIECE_SELECTIONS")).toBe(true);
  });
});

describe("validateCorporateCart — reglas adicionales", () => {
  it("MULTIPLES_ONLY rechaza cantidades que no son múltiplo exacto", () => {
    const rules = [rule({ ruleType: "MULTIPLES_ONLY", scope: "GLOBAL", config: { multipleOf: 6 } })];
    const cart: CorporateCart = {
      items: [{ setId: "set-1", setName: "Set Z", sizeMode: "NO_SIZES", lines: [{ quantity: 13, pieceSelections: [{ productId: "prod-1" }] }] }],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.violations.some((v) => v.code === "MULTIPLES_ONLY")).toBe(true);
  });

  it("MULTIPLES_ONLY acepta múltiplos exactos", () => {
    const rules = [rule({ ruleType: "MULTIPLES_ONLY", scope: "GLOBAL", config: { multipleOf: 6 } })];
    const cart: CorporateCart = {
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 12, pieceSelections: [{ productId: "prod-1" }] }] }],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.violations.some((v) => v.code === "MULTIPLES_ONLY")).toBe(false);
  });

  it("COLOR_RESTRICTION exige mínimo por pieza en el color elegido", () => {
    const rules = [rule({ ruleType: "COLOR_RESTRICTION", scope: "GLOBAL", config: { colorCode: "PINK", min: 6 } })];
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-1",
          setName: "Set Rosa",
          sizeMode: "NO_SIZES",
          lines: [{ quantity: 3, pieceSelections: [{ productId: "prod-1", color: "PINK" }] }],
        },
      ],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.violations.some((v) => v.code === "COLOR_RESTRICTION")).toBe(true);
  });

  it("COLOR_RESTRICTION calcula unidades con quantityPerSet de la pieza (setMeta.pieces)", () => {
    const rules = [rule({ ruleType: "COLOR_RESTRICTION", scope: "GLOBAL", config: { colorCode: "PINK", min: 6 } })];
    const setMeta = { "set-1": { pieces: [{ productId: "prod-1", productName: "Camisa", quantityPerSet: 2 }] } };
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-1",
          setName: "Set Rosa",
          sizeMode: "NO_SIZES",
          // 3 sets * 2 piezas/set = 6 unidades — alcanza el mínimo exacto.
          lines: [{ quantity: 3, pieceSelections: [{ productId: "prod-1", color: "PINK" }] }],
        },
      ],
    };
    const result = validateCorporateCart(cart, rules, setMeta);
    expect(result.violations.some((v) => v.code === "COLOR_RESTRICTION")).toBe(false);
  });

  it("una pieza sin color elegido no dispara COLOR_RESTRICTION", () => {
    const rules = [rule({ ruleType: "COLOR_RESTRICTION", scope: "GLOBAL", config: { colorCode: "PINK", min: 6 } })];
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-1",
          sizeMode: "NO_SIZES",
          lines: [{ quantity: 1, pieceSelections: [{ productId: "prod-1" }] }],
        },
      ],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.violations.some((v) => v.code === "COLOR_RESTRICTION")).toBe(false);
  });

  it("un color distinto al restringido no dispara COLOR_RESTRICTION", () => {
    const rules = [rule({ ruleType: "COLOR_RESTRICTION", scope: "GLOBAL", config: { colorCode: "PINK", min: 6 } })];
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-1",
          sizeMode: "NO_SIZES",
          lines: [{ quantity: 1, pieceSelections: [{ productId: "prod-1", color: "BLUE" }] }],
        },
      ],
    };
    const result = validateCorporateCart(cart, rules);
    expect(result.violations.some((v) => v.code === "COLOR_RESTRICTION")).toBe(false);
  });
});

describe("computeCartPricing — escala de volumen", () => {
  it("calcula subtotal sin descuento cuando no hay VOLUME_SCALE", () => {
    const cart: CorporateCart = {
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 12, pieceSelections: [{ productId: "prod-1" }] }] }],
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
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 60, pieceSelections: [{ productId: "prod-1" }] }] }],
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
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 12, pieceSelections: [{ productId: "prod-1" }] }] }],
    };
    const result = computeCartPricing(
      cart,
      { "set-1": { pricePerSet: 0, hasMissingPrices: true } },
      []
    );
    expect(result.hasMissingPrices).toBe(true);
  });

  it("promoDiscountAmount es 0 cuando no hay reglas PROMO", () => {
    const cart: CorporateCart = {
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 12, pieceSelections: [{ productId: "prod-1" }] }] }],
    };
    const result = computeCartPricing(cart, { "set-1": { pricePerSet: 10, hasMissingPrices: false } }, []);
    expect(result.promoDiscountAmount).toBe(0);
  });
});

describe("computeCartPricing — PROMO (N_PLUS_ONE)", () => {
  it("aplica 13+1: cada 13 unidades del set, 1 sale gratis", () => {
    const rules = [
      rule({ ruleType: "PROMO", scope: "SET", scopeId: "set-1", config: { kind: "N_PLUS_ONE", buy: 13, free: 1 } }),
    ];
    const cart: CorporateCart = {
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 26, pieceSelections: [{ productId: "prod-1" }] }] }],
    };
    const result = computeCartPricing(
      cart,
      { "set-1": { pricePerSet: 10, hasMissingPrices: false } },
      rules,
      { "set-1": {} }
    );
    // 26 unidades -> 2 ciclos de 13 -> 2 gratis -> 2 * 10 = 20 de descuento
    expect(result.promoDiscountAmount).toBe(20);
    expect(result.subtotalBeforeDiscount).toBe(260);
    expect(result.total).toBe(240);
  });

  it("no aplica la promo si la cantidad no alcanza un ciclo completo de 'buy'", () => {
    const rules = [
      rule({ ruleType: "PROMO", scope: "SET", scopeId: "set-1", config: { kind: "N_PLUS_ONE", buy: 13, free: 1 } }),
    ];
    const cart: CorporateCart = {
      items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 12, pieceSelections: [{ productId: "prod-1" }] }] }],
    };
    const result = computeCartPricing(
      cart,
      { "set-1": { pricePerSet: 10, hasMissingPrices: false } },
      rules,
      { "set-1": {} }
    );
    expect(result.promoDiscountAmount).toBe(0);
  });

  it("una promo de ámbito SET no afecta a otro set sin esa regla", () => {
    const rules = [
      rule({ ruleType: "PROMO", scope: "SET", scopeId: "set-1", config: { kind: "N_PLUS_ONE", buy: 13, free: 1 } }),
    ];
    const cart: CorporateCart = {
      items: [
        { setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 13, pieceSelections: [{ productId: "prod-1" }] }] },
        { setId: "set-2", sizeMode: "NO_SIZES", lines: [{ quantity: 13, pieceSelections: [{ productId: "prod-2" }] }] },
      ],
    };
    const result = computeCartPricing(
      cart,
      {
        "set-1": { pricePerSet: 10, hasMissingPrices: false },
        "set-2": { pricePerSet: 10, hasMissingPrices: false },
      },
      rules,
      { "set-1": {}, "set-2": {} }
    );
    // Solo set-1 tiene la promo activa: 1 ciclo de 13 -> 1 gratis -> 10 de descuento
    expect(result.promoDiscountAmount).toBe(10);
  });

  it("una promo GLOBAL aplica a todos los sets del carrito (acumulable)", () => {
    const rules = [
      rule({ ruleType: "PROMO", scope: "GLOBAL", config: { kind: "N_PLUS_ONE", buy: 10, free: 1 } }),
    ];
    const cart: CorporateCart = {
      items: [
        { setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 10, pieceSelections: [{ productId: "prod-1" }] }] },
        { setId: "set-2", sizeMode: "NO_SIZES", lines: [{ quantity: 10, pieceSelections: [{ productId: "prod-2" }] }] },
      ],
    };
    const result = computeCartPricing(
      cart,
      {
        "set-1": { pricePerSet: 5, hasMissingPrices: false },
        "set-2": { pricePerSet: 8, hasMissingPrices: false },
      },
      rules,
      { "set-1": {}, "set-2": {} }
    );
    // set-1: 1 ciclo * $5 = $5 ; set-2: 1 ciclo * $8 = $8 -> total $13
    expect(result.promoDiscountAmount).toBe(13);
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

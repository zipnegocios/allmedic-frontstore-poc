import { describe, it, expect } from "vitest";
import { resolveRules } from "../resolve";
import { validateCorporateCart } from "../validate";
import { computeCartPricing } from "../pricing";
import type { BusinessRule, CorporateCart, SetMeta } from "../types";

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

const PRICE_10 = { pricePerSet: 10, hasMissingPrices: false };

describe("resolveRules — ámbito PRODUCT", () => {
  it("una regla PRODUCT aplica si el producto está entre las piezas del contexto (productIds)", () => {
    const rules = [rule({ ruleType: "SIZE_MODE", scope: "PRODUCT", scopeId: "prod-a", config: { mode: "NO_SIZES" } })];
    const resolved = resolveRules(rules, { setId: "set-1", productIds: ["prod-a", "prod-b"] });
    expect(resolved.sizeMode.mode).toBe("NO_SIZES");
  });

  it("una regla PRODUCT no aplica si el producto no está en productIds", () => {
    const rules = [rule({ ruleType: "SIZE_MODE", scope: "PRODUCT", scopeId: "prod-x", config: { mode: "NO_SIZES" } })];
    const resolved = resolveRules(rules, { setId: "set-1", productIds: ["prod-a", "prod-b"] });
    expect(resolved.sizeMode.mode).toBe("MATRIX"); // default, la regla PRODUCT no matcheó
  });

  it("PRODUCT es más específico que SET: gana sobre una regla SET del mismo tipo", () => {
    const rules = [
      rule({ id: "s1", ruleType: "SIZE_MODE", scope: "SET", scopeId: "set-1", config: { mode: "PER_PIECE" } }),
      rule({ id: "p1", ruleType: "SIZE_MODE", scope: "PRODUCT", scopeId: "prod-a", config: { mode: "NO_SIZES" } }),
    ];
    const resolved = resolveRules(rules, { setId: "set-1", productIds: ["prod-a"] });
    expect(resolved.sizeMode.mode).toBe("NO_SIZES");
  });

  it("desempate por priority entre dos reglas PRODUCT del mismo tipo en el mismo set (dos productos distintos)", () => {
    const rules = [
      rule({ id: "p1", ruleType: "SIZE_MODE", scope: "PRODUCT", scopeId: "prod-a", priority: 1, config: { mode: "NO_SIZES" } }),
      rule({ id: "p2", ruleType: "SIZE_MODE", scope: "PRODUCT", scopeId: "prod-b", priority: 5, config: { mode: "PER_PIECE" } }),
    ];
    const resolved = resolveRules(rules, { setId: "set-1", productIds: ["prod-a", "prod-b"] });
    expect(resolved.sizeMode.mode).toBe("PER_PIECE"); // p2 tiene mayor priority
  });

  it("compatibilidad: productId singular sigue funcionando como fallback (retail, un solo producto)", () => {
    const rules = [rule({ ruleType: "PRICE_VISIBILITY", scope: "PRODUCT", scopeId: "prod-a", config: { showPrices: false, catalog: "INDIVIDUAL" } })];
    const resolved = resolveRules(rules, { productId: "prod-a" });
    expect(resolved.priceVisibility.showPrices).toBe(false);
  });
});

describe("validateCorporateCart — MIN_QUANTITY contextual", () => {
  it("una regla BRAND bloquea solo si el subconjunto de esa marca no alcanza su propio mínimo, aunque el total global sí alcance", () => {
    const rules = [
      rule({ id: "g", ruleType: "MIN_QUANTITY", scope: "GLOBAL", config: { min: 10, countUnit: "SETS" } }),
      rule({ id: "b", name: "Mínimo FIGS", ruleType: "MIN_QUANTITY", scope: "BRAND", scopeId: "brand-figs", config: { min: 20, countUnit: "SETS" } }),
    ];
    const setMeta: Record<string, SetMeta> = {
      "set-figs": { brandId: "brand-figs" },
      "set-other": { brandId: "brand-other" },
    };
    const cart: CorporateCart = {
      items: [
        { setId: "set-figs", setName: "Set FIGS", sizeMode: "NO_SIZES", lines: [{ quantity: 8 }] },
        { setId: "set-other", setName: "Set Other", sizeMode: "NO_SIZES", lines: [{ quantity: 5 }] },
      ],
    };
    const result = validateCorporateCart(cart, rules, setMeta);
    // Global: 13 >= 10 (cumple). Contextual FIGS: 8 < 20 (no cumple) -> debe bloquear.
    expect(result.canSubmit).toBe(false);
    expect(result.violations.some((v) => v.message.includes("Mínimo FIGS"))).toBe(true);
  });

  it("si el mínimo contextual también se cumple, no hay violación adicional", () => {
    const rules = [
      rule({ id: "g", ruleType: "MIN_QUANTITY", scope: "GLOBAL", config: { min: 10, countUnit: "SETS" } }),
      rule({ id: "b", name: "Mínimo FIGS", ruleType: "MIN_QUANTITY", scope: "BRAND", scopeId: "brand-figs", config: { min: 5, countUnit: "SETS" } }),
    ];
    const setMeta: Record<string, SetMeta> = { "set-figs": { brandId: "brand-figs" } };
    const cart: CorporateCart = { items: [{ setId: "set-figs", setName: "Set FIGS", sizeMode: "NO_SIZES", lines: [{ quantity: 10 }] }] };
    const result = validateCorporateCart(cart, rules, setMeta);
    expect(result.canSubmit).toBe(true);
  });

  it("countUnit PIECES contextual convierte a piezas reales vía piecesPerSet", () => {
    const rules = [
      rule({ id: "b", name: "Mínimo piezas Marca X", ruleType: "MIN_QUANTITY", scope: "BRAND", scopeId: "brand-x", config: { min: 20, countUnit: "PIECES" } }),
    ];
    const setMeta: Record<string, SetMeta> = { "set-x": { brandId: "brand-x", piecesPerSet: 2 } };
    const cart: CorporateCart = { items: [{ setId: "set-x", setName: "Set X", sizeMode: "NO_SIZES", lines: [{ quantity: 8 }] }] };
    const result = validateCorporateCart(cart, rules, setMeta);
    // 8 sets * 2 piezas = 16 piezas < 20 -> viola
    expect(result.canSubmit).toBe(false);
  });
});

describe("resolveRules — PRICE_VISIBILITY por ítem (grid)", () => {
  it("una regla de ámbito Marca oculta precios solo para los ítems de esa marca", () => {
    const rules = [rule({ ruleType: "PRICE_VISIBILITY", scope: "BRAND", scopeId: "brand-a", config: { showPrices: false, catalog: "CORPORATE" } })];
    const resolvedA = resolveRules(rules, { brandId: "brand-a" });
    const resolvedB = resolveRules(rules, { brandId: "brand-b" });
    expect(resolvedA.priceVisibility.showPrices).toBe(false);
    expect(resolvedB.priceVisibility.showPrices).toBe(true); // default, no aplica a otra marca
  });
});

describe("computeCartPricing — VOLUME_SCALE por ítem, sin acumulación", () => {
  it("una escala de ámbito Marca aplica solo al subtotal de esa marca", () => {
    const rules = [
      rule({ id: "vs-brand", ruleType: "VOLUME_SCALE", scope: "BRAND", scopeId: "brand-a", config: { tiers: [{ minQty: 5, discountPct: 20 }] } }),
    ];
    const setMeta: Record<string, SetMeta> = { "set-a": { brandId: "brand-a" }, "set-b": { brandId: "brand-b" } };
    const cart: CorporateCart = {
      items: [
        { setId: "set-a", sizeMode: "NO_SIZES", lines: [{ quantity: 5 }] }, // marca A: qty 5 alcanza el tramo
        { setId: "set-b", sizeMode: "NO_SIZES", lines: [{ quantity: 5 }] }, // marca B: sin regla, no descuenta
      ],
    };
    const result = computeCartPricing(cart, { "set-a": PRICE_10, "set-b": PRICE_10 }, rules, setMeta);
    // set-a: subtotal 50, 20% = 10. set-b: sin descuento.
    expect(result.volumeDiscountAmount).toBe(10);
    expect(result.volumeScaleBreakdown).toHaveLength(1);
    expect(result.volumeScaleBreakdown[0].scope).toBe("BRAND");
  });

  it("no se acumulan escalas: la más específica gana sobre GLOBAL para los ítems que cubre", () => {
    const rules = [
      rule({ id: "vs-global", ruleType: "VOLUME_SCALE", scope: "GLOBAL", config: { tiers: [{ minQty: 1, discountPct: 5 }] } }),
      rule({ id: "vs-set", ruleType: "VOLUME_SCALE", scope: "SET", scopeId: "set-a", config: { tiers: [{ minQty: 1, discountPct: 15 }] } }),
    ];
    const cart: CorporateCart = { items: [{ setId: "set-a", sizeMode: "NO_SIZES", lines: [{ quantity: 5 }] }] };
    const result = computeCartPricing(cart, { "set-a": PRICE_10 }, rules, {});
    // Si se acumularan, sería 5+15=20%; ganando solo la más específica, debe ser 15% = $7.5 sobre $50
    expect(result.volumeDiscountAmount).toBe(7.5);
    expect(result.volumeScaleBreakdown).toHaveLength(1);
  });

  it("GLOBAL sin ninguna regla más específica se comporta igual que antes (sobre el carrito completo)", () => {
    const rules = [rule({ ruleType: "VOLUME_SCALE", scope: "GLOBAL", config: { tiers: [{ minQty: 10, discountPct: 8 }] } })];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 60 }] }] };
    const result = computeCartPricing(cart, { "set-1": PRICE_10 }, rules, {});
    expect(result.volumeDiscountPct).toBe(8);
    expect(result.volumeDiscountAmount).toBe(48);
  });
});

describe("validateCorporateCart — COLOR_RESTRICTION", () => {
  it("línea con el color restringido bajo el mínimo -> violación", () => {
    const rules = [rule({ ruleType: "COLOR_RESTRICTION", scope: "GLOBAL", config: { colorCode: "PINK", min: 6 } })];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "MATRIX", lines: [{ size: "M", color: "PINK", quantity: 3 }] }] };
    const result = validateCorporateCart(cart, rules, {});
    expect(result.violations.some((v) => v.code === "COLOR_RESTRICTION")).toBe(true);
  });

  it("línea con un color distinto al restringido -> sin efecto", () => {
    const rules = [rule({ ruleType: "COLOR_RESTRICTION", scope: "GLOBAL", config: { colorCode: "PINK", min: 6 } })];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "MATRIX", lines: [{ size: "M", color: "BLUE", quantity: 1 }] }] };
    const result = validateCorporateCart(cart, rules, {});
    expect(result.violations.some((v) => v.code === "COLOR_RESTRICTION")).toBe(false);
  });

  it("línea sin color -> sin efecto (la restricción no se evalúa)", () => {
    const rules = [rule({ ruleType: "COLOR_RESTRICTION", scope: "GLOBAL", config: { colorCode: "PINK", min: 6 } })];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "MATRIX", lines: [{ size: "M", quantity: 1 }] }] };
    const result = validateCorporateCart(cart, rules, {});
    expect(result.violations.some((v) => v.code === "COLOR_RESTRICTION")).toBe(false);
  });

  it("ámbito PRODUCT: la restricción de color solo aplica si el set contiene ese producto", () => {
    const rules = [rule({ ruleType: "COLOR_RESTRICTION", scope: "PRODUCT", scopeId: "prod-a", config: { colorCode: "PINK", min: 6 } })];
    const setMetaWith: Record<string, SetMeta> = { "set-1": { pieces: [{ productId: "prod-a", quantityPerSet: 1 }] } };
    const setMetaWithout: Record<string, SetMeta> = { "set-1": { pieces: [{ productId: "prod-z", quantityPerSet: 1 }] } };
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "MATRIX", lines: [{ size: "M", color: "PINK", quantity: 3 }] }] };
    expect(validateCorporateCart(cart, rules, setMetaWith).violations.some((v) => v.code === "COLOR_RESTRICTION")).toBe(true);
    expect(validateCorporateCart(cart, rules, setMetaWithout).violations.some((v) => v.code === "COLOR_RESTRICTION")).toBe(false);
  });
});

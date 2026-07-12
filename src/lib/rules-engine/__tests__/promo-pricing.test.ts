import { describe, it, expect } from "vitest";
import { computeCartPricing } from "../pricing";
import type { BusinessRule, CorporateCart, SetMeta } from "../types";

function rule(overrides: Partial<BusinessRule>): BusinessRule {
  return {
    id: overrides.id ?? "rule-1",
    name: overrides.name ?? "Regla de prueba",
    ruleType: overrides.ruleType ?? "PROMO",
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

describe("computeCartPricing — PROMO PERCENT_OFF", () => {
  it("aplica pct% sobre el subtotal de la línea", () => {
    const rules = [rule({ scope: "SET", scopeId: "set-1", config: { kind: "PERCENT_OFF", pct: 20 } })];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 10 }] }] };
    const result = computeCartPricing(cart, { "set-1": PRICE_10 }, rules, { "set-1": {} });
    // subtotal 100, 20% = 20
    expect(result.promoDiscountAmount).toBe(20);
    expect(result.promoBreakdown).toEqual([{ ruleId: "rule-1", ruleName: "Regla de prueba", kind: "PERCENT_OFF", amount: 20 }]);
  });

  it("no aplica si la regla no cubre ese set (otro ámbito SET)", () => {
    const rules = [rule({ scope: "SET", scopeId: "set-2", config: { kind: "PERCENT_OFF", pct: 20 } })];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 10 }] }] };
    const result = computeCartPricing(cart, { "set-1": PRICE_10 }, rules, { "set-1": {} });
    expect(result.promoDiscountAmount).toBe(0);
  });
});

describe("computeCartPricing — PROMO FIXED_AMOUNT_OFF", () => {
  it("descuenta cantidad x amountPerUnit", () => {
    const rules = [rule({ scope: "GLOBAL", config: { kind: "FIXED_AMOUNT_OFF", amountPerUnit: 2 } })];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 10 }] }] };
    const result = computeCartPricing(cart, { "set-1": PRICE_10 }, rules, { "set-1": {} });
    expect(result.promoDiscountAmount).toBe(20);
  });

  it("nunca deja la línea negativa (tope en el lineSubtotal)", () => {
    const rules = [rule({ scope: "GLOBAL", config: { kind: "FIXED_AMOUNT_OFF", amountPerUnit: 50 } })];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 10 }] }] };
    const result = computeCartPricing(cart, { "set-1": PRICE_10 }, rules, { "set-1": {} });
    // 10 x 50 = 500, pero el lineSubtotal es solo 100
    expect(result.promoDiscountAmount).toBe(100);
    expect(result.total).toBe(0);
  });
});

describe("computeCartPricing — PROMO FIXED_PRICE", () => {
  it("descuenta la diferencia entre el precio normal y el promocional", () => {
    const rules = [rule({ scope: "GLOBAL", config: { kind: "FIXED_PRICE", price: 7 } })];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 10 }] }] };
    const result = computeCartPricing(cart, { "set-1": PRICE_10 }, rules, { "set-1": {} });
    // (10 - 7) * 10 = 30
    expect(result.promoDiscountAmount).toBe(30);
  });

  it("no encarece: si el precio promocional es mayor o igual al normal, no descuenta nada", () => {
    const rules = [rule({ scope: "GLOBAL", config: { kind: "FIXED_PRICE", price: 15 } })];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 10 }] }] };
    const result = computeCartPricing(cart, { "set-1": PRICE_10 }, rules, { "set-1": {} });
    expect(result.promoDiscountAmount).toBe(0);
  });
});

describe("computeCartPricing — PROMO NTH_UNIT_PCT", () => {
  it("2da unidad al 50%: cada bloque de 2 unidades descuenta media unidad", () => {
    const rules = [rule({ scope: "GLOBAL", config: { kind: "NTH_UNIT_PCT", n: 2, pct: 50 } })];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 6 }] }] };
    const result = computeCartPricing(cart, { "set-1": PRICE_10 }, rules, { "set-1": {} });
    // 6 unidades -> 3 ciclos de 2 -> 3 * 10 * 0.5 = 15
    expect(result.promoDiscountAmount).toBe(15);
  });

  it("no aplica si la cantidad no alcanza un ciclo completo de n", () => {
    const rules = [rule({ scope: "GLOBAL", config: { kind: "NTH_UNIT_PCT", n: 3, pct: 50 } })];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 2 }] }] };
    const result = computeCartPricing(cart, { "set-1": PRICE_10 }, rules, { "set-1": {} });
    expect(result.promoDiscountAmount).toBe(0);
  });
});

describe("computeCartPricing — PROMO THRESHOLD_DISCOUNT", () => {
  it("aplica una sola vez cuando el subtotal GLOBAL alcanza el mínimo", () => {
    const rules = [rule({ scope: "GLOBAL", config: { kind: "THRESHOLD_DISCOUNT", minSubtotal: 100, pct: 10 } })];
    const cart: CorporateCart = {
      items: [
        { setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 6 }] },
        { setId: "set-2", sizeMode: "NO_SIZES", lines: [{ quantity: 6 }] },
      ],
    };
    const result = computeCartPricing(
      cart,
      { "set-1": PRICE_10, "set-2": PRICE_10 },
      rules,
      { "set-1": {}, "set-2": {} }
    );
    // subtotal = 120 >= 100 -> 10% = 12, una sola vez
    expect(result.promoDiscountAmount).toBe(12);
    expect(result.promoBreakdown).toHaveLength(1);
  });

  it("no aplica si el subtotal del contexto no alcanza el mínimo", () => {
    const rules = [rule({ scope: "GLOBAL", config: { kind: "THRESHOLD_DISCOUNT", minSubtotal: 1000, pct: 10 } })];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 6 }] }] };
    const result = computeCartPricing(cart, { "set-1": PRICE_10 }, rules, { "set-1": {} });
    expect(result.promoDiscountAmount).toBe(0);
  });

  it("ámbito BRAND: solo cuenta el subtotal de los sets de esa marca, no el carrito completo", () => {
    const rules = [
      rule({ scope: "BRAND", scopeId: "brand-x", config: { kind: "THRESHOLD_DISCOUNT", minSubtotal: 50, amount: 5 } }),
    ];
    const setMeta: Record<string, SetMeta> = { "set-1": { brandId: "brand-x" }, "set-2": { brandId: "brand-y" } };
    const cart: CorporateCart = {
      items: [
        { setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 6 }] }, // brand-x: $60
        { setId: "set-2", sizeMode: "NO_SIZES", lines: [{ quantity: 1 }] }, // brand-y: $10, no cuenta
      ],
    };
    const result = computeCartPricing(cart, { "set-1": PRICE_10, "set-2": PRICE_10 }, rules, setMeta);
    // brand-x subtotal = 60 >= 50 -> amount fijo $5
    expect(result.promoDiscountAmount).toBe(5);
  });
});

describe("computeCartPricing — PROMO GIFT (informativa)", () => {
  it("agrega una nota sin alterar el total cuando se cumple la condición", () => {
    const rules = [
      rule({ scope: "GLOBAL", config: { kind: "GIFT", minQty: 10, description: "Regalo: 12 gorros quirúrgicos de cortesía" } }),
    ];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 10 }] }] };
    const result = computeCartPricing(cart, { "set-1": PRICE_10 }, rules, { "set-1": {} });
    expect(result.promoNotes).toEqual(["Regalo: 12 gorros quirúrgicos de cortesía"]);
    expect(result.promoDiscountAmount).toBe(0);
    expect(result.total).toBe(result.subtotalBeforeDiscount);
    expect(result.promoBreakdown).toEqual([]);
  });

  it("no agrega nota si la condición no se cumple", () => {
    const rules = [rule({ scope: "GLOBAL", config: { kind: "GIFT", minQty: 100, description: "No debería aparecer" } })];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 10 }] }] };
    const result = computeCartPricing(cart, { "set-1": PRICE_10 }, rules, { "set-1": {} });
    expect(result.promoNotes).toEqual([]);
  });
});

describe("computeCartPricing — PROMO COMBO", () => {
  it("descuenta el set objetivo cuando el disparador alcanza el mínimo y ambos están en el carrito", () => {
    const rules = [
      rule({ scope: "GLOBAL", config: { kind: "COMBO", triggerSetId: "set-a", triggerMinQty: 5, targetSetId: "set-b", pct: 10 } }),
    ];
    const cart: CorporateCart = {
      items: [
        { setId: "set-a", sizeMode: "NO_SIZES", lines: [{ quantity: 5 }] },
        { setId: "set-b", sizeMode: "NO_SIZES", lines: [{ quantity: 2 }] },
      ],
    };
    const result = computeCartPricing(
      cart,
      { "set-a": PRICE_10, "set-b": { pricePerSet: 20, hasMissingPrices: false } },
      rules,
      { "set-a": {}, "set-b": {} }
    );
    // set-b subtotal = 40, 10% = 4
    expect(result.promoDiscountAmount).toBe(4);
    expect(result.promoBreakdown[0].kind).toBe("COMBO");
  });

  it("no aplica (sin error) si el set objetivo no está en el carrito", () => {
    const rules = [
      rule({ scope: "GLOBAL", config: { kind: "COMBO", triggerSetId: "set-a", triggerMinQty: 5, targetSetId: "set-b", pct: 10 } }),
    ];
    const cart: CorporateCart = { items: [{ setId: "set-a", sizeMode: "NO_SIZES", lines: [{ quantity: 5 }] }] };
    const result = computeCartPricing(cart, { "set-a": PRICE_10 }, rules, { "set-a": {} });
    expect(result.promoDiscountAmount).toBe(0);
  });

  it("no aplica si el disparador no alcanza el mínimo", () => {
    const rules = [
      rule({ scope: "GLOBAL", config: { kind: "COMBO", triggerSetId: "set-a", triggerMinQty: 10, targetSetId: "set-b", pct: 10 } }),
    ];
    const cart: CorporateCart = {
      items: [
        { setId: "set-a", sizeMode: "NO_SIZES", lines: [{ quantity: 3 }] },
        { setId: "set-b", sizeMode: "NO_SIZES", lines: [{ quantity: 2 }] },
      ],
    };
    const result = computeCartPricing(
      cart,
      { "set-a": PRICE_10, "set-b": { pricePerSet: 20, hasMissingPrices: false } },
      rules,
      { "set-a": {}, "set-b": {} }
    );
    expect(result.promoDiscountAmount).toBe(0);
  });
});

describe("computeCartPricing — acumulación y topes", () => {
  it("acumula varios tipos de PROMO sobre el mismo set, topado al lineSubtotal", () => {
    const rules = [
      rule({ id: "r1", scope: "GLOBAL", config: { kind: "PERCENT_OFF", pct: 60 } }),
      rule({ id: "r2", scope: "GLOBAL", config: { kind: "FIXED_AMOUNT_OFF", amountPerUnit: 8 } }),
    ];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 10 }] }] };
    const result = computeCartPricing(cart, { "set-1": PRICE_10 }, rules, { "set-1": {} });
    // lineSubtotal = 100. PERCENT_OFF 60% = 60 (aplica primero). FIXED_AMOUNT_OFF pediría 80 más,
    // pero solo quedan 40 de headroom -> total topado en 100 (nunca negativo).
    expect(result.promoDiscountAmount).toBe(100);
    expect(result.total).toBe(0);
    expect(result.promoBreakdown).toHaveLength(2);
    expect(result.promoBreakdown[0].amount).toBe(60);
    expect(result.promoBreakdown[1].amount).toBe(40);
  });

  it("el total del carrito nunca queda negativo aunque las promos combinadas excedan el subtotal", () => {
    const rules = [
      rule({ id: "r1", scope: "GLOBAL", config: { kind: "FIXED_AMOUNT_OFF", amountPerUnit: 100 } }),
      rule({ id: "r2", scope: "GLOBAL", config: { kind: "THRESHOLD_DISCOUNT", minSubtotal: 1, amount: 500 } }),
    ];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 10 }] }] };
    const result = computeCartPricing(cart, { "set-1": PRICE_10 }, rules, { "set-1": {} });
    expect(result.total).toBe(0);
    expect(result.promoDiscountAmount).toBe(result.subtotalBeforeDiscount);
  });
});

describe("computeCartPricing — compatibilidad N_PLUS_ONE existente", () => {
  it("las configs N_PLUS_ONE guardadas antes de la ampliación siguen funcionando igual", () => {
    const rules = [rule({ scope: "SET", scopeId: "set-1", config: { kind: "N_PLUS_ONE", buy: 13, free: 1 } })];
    const cart: CorporateCart = { items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 26 }] }] };
    const result = computeCartPricing(cart, { "set-1": PRICE_10 }, rules, { "set-1": {} });
    expect(result.promoDiscountAmount).toBe(20);
  });
});

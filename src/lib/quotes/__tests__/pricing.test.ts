import { describe, it, expect } from "vitest";
import { resolveSuggestedPrice, type QuoteLineContext } from "../pricing";
import type { BusinessRule } from "@/lib/rules-engine";

function rule(overrides: Partial<BusinessRule>): BusinessRule {
  return {
    id: "rule-1",
    name: "Regla de prueba",
    ruleType: "PROMO",
    scope: "GLOBAL",
    scopeId: null,
    config: {},
    isActive: true,
    priority: 0,
    ...overrides,
  };
}

describe("resolveSuggestedPrice", () => {
  it("sin reglas activas, el sugerido es igual al precio base", () => {
    const line: QuoteLineContext = { channel: "CORPORATE", quantity: 5, basePrice: 100, setId: "set-1" };
    const result = resolveSuggestedPrice(line, []);
    expect(result.suggestedUnitPrice).toBe(100);
    expect(result.breakdown).toHaveLength(0);
  });

  it("aplica PERCENT_OFF de ámbito SET a la línea correspondiente", () => {
    const rules = [
      rule({
        ruleType: "PROMO",
        scope: "SET",
        scopeId: "set-1",
        config: { kind: "PERCENT_OFF", pct: 10 },
      }),
    ];
    const line: QuoteLineContext = { channel: "CORPORATE", quantity: 2, basePrice: 100, setId: "set-1" };
    const result = resolveSuggestedPrice(line, rules);
    // subtotal 200, 10% off = 20 -> 180 / 2 = 90
    expect(result.suggestedUnitPrice).toBe(90);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].kind).toBe("PERCENT_OFF");
  });

  it("no aplica una PROMO de un set distinto", () => {
    const rules = [
      rule({ scope: "SET", scopeId: "set-OTRO", config: { kind: "PERCENT_OFF", pct: 50 } }),
    ];
    const line: QuoteLineContext = { channel: "CORPORATE", quantity: 1, basePrice: 100, setId: "set-1" };
    const result = resolveSuggestedPrice(line, rules);
    expect(result.suggestedUnitPrice).toBe(100);
  });

  it("aplica VOLUME_SCALE en canal corporativo según la cantidad", () => {
    const rules = [
      rule({
        ruleType: "VOLUME_SCALE",
        scope: "GLOBAL",
        config: { tiers: [{ minQty: 10, discountPct: 20 }, { minQty: 5, discountPct: 10 }] },
      }),
    ];
    const line: QuoteLineContext = { channel: "CORPORATE", quantity: 12, basePrice: 10 };
    const result = resolveSuggestedPrice(line, rules);
    // subtotal 120, tramo de 10+ unidades gana (20%) -> descuento 24 -> 96/12 = 8
    expect(result.suggestedUnitPrice).toBe(8);
    expect(result.breakdown[0].kind).toBe("VOLUME_SCALE");
  });

  it("aplica VOLUME_DISCOUNT_RETAIL en canal individual, no VOLUME_SCALE", () => {
    const rules = [
      rule({ ruleType: "VOLUME_SCALE", scope: "GLOBAL", config: { tiers: [{ minQty: 1, discountPct: 90 }] } }),
      rule({
        ruleType: "VOLUME_DISCOUNT_RETAIL",
        scope: "GLOBAL",
        config: { tiers: [{ minItems: 3, pct: 10 }] },
      }),
    ];
    const line: QuoteLineContext = { channel: "RETAIL", quantity: 3, basePrice: 100 };
    const result = resolveSuggestedPrice(line, rules);
    // 300 subtotal, 10% off = 30 -> 270/3 = 90 (no el 90% de VOLUME_SCALE, que es solo corporativo)
    expect(result.suggestedUnitPrice).toBe(90);
    expect(result.breakdown[0].kind).toBe("VOLUME_DISCOUNT_RETAIL");
  });

  it("N_PLUS_ONE acumula por ciclos completos de compra", () => {
    const rules = [
      rule({ config: { kind: "N_PLUS_ONE", buy: 3, free: 1 } }),
    ];
    // 6 unidades = 2 ciclos completos de "compra 3 lleva 1 gratis" -> 2 unidades gratis
    const line: QuoteLineContext = { channel: "CORPORATE", quantity: 6, basePrice: 10, setId: "set-1" };
    const result = resolveSuggestedPrice(line, rules);
    // subtotal 60, descuento 2*10=20 -> 40/6 = 6.67
    expect(result.suggestedUnitPrice).toBe(6.67);
  });

  it("el descuento nunca deja el sugerido en negativo", () => {
    const rules = [
      rule({ config: { kind: "FIXED_AMOUNT_OFF", amountPerUnit: 9999 } }),
    ];
    const line: QuoteLineContext = { channel: "CORPORATE", quantity: 1, basePrice: 10, setId: "set-1" };
    const result = resolveSuggestedPrice(line, rules);
    expect(result.suggestedUnitPrice).toBe(0);
  });

  it("no importa nada de @/db — el módulo es puro", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../pricing.ts", import.meta.url), "utf-8")
    );
    expect(source).not.toMatch(/from ["']@\/db/);
  });
});

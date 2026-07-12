import { describe, it, expect } from "vitest";
import { computeCartPricing } from "../pricing";
import type { BusinessRule, CorporateCart } from "../types";

// El precio manual (override) de un set corporativo se resuelve en la capa de datos
// (`getSetPricesByIds`, `corporate-data-service.ts`) — el motor puro (`computeCartPricing`)
// nunca sabe si un `pricePerSet` viene de la suma automática o de un override manual, solo
// recibe el valor ya resuelto. Estos tests simulan ambos casos construyendo `setPrices` a mano,
// exactamente como lo haría `getSetPricesByIds` en cada escenario — confirman que VOLUME_SCALE
// y el subtotal aplican sobre el "precio efectivo" sin ningún cambio de lógica en el motor.

function rule(overrides: Partial<BusinessRule>): BusinessRule {
  return {
    id: overrides.id ?? "r1",
    name: overrides.name ?? "Escala",
    ruleType: overrides.ruleType ?? "VOLUME_SCALE",
    scope: overrides.scope ?? "GLOBAL",
    scopeId: overrides.scopeId ?? null,
    config: overrides.config ?? {},
    isActive: overrides.isActive ?? true,
    priority: overrides.priority ?? 0,
    validFrom: overrides.validFrom ?? null,
    validTo: overrides.validTo ?? null,
  };
}

const cart: CorporateCart = {
  items: [{ setId: "set-1", sizeMode: "NO_SIZES", lines: [{ quantity: 10, pieceSelections: [{ productId: "prod-1" }] }] }],
};

describe("computeCartPricing — precio del set con override manual", () => {
  it("sin override: usa la suma automática de piezas tal cual llega en setPrices", () => {
    const result = computeCartPricing(cart, { "set-1": { pricePerSet: 10, hasMissingPrices: false } }, []);
    expect(result.subtotalBeforeDiscount).toBe(100);
  });

  it("con override activo: el subtotal se calcula sobre el precio manual, no sobre la suma", () => {
    // Suma automática de piezas sería 10 (irrelevante aquí) — el override manual es 25.
    const result = computeCartPricing(cart, { "set-1": { pricePerSet: 25, hasMissingPrices: false } }, []);
    expect(result.subtotalBeforeDiscount).toBe(250);
  });

  it("VOLUME_SCALE aplica sobre el precio efectivo (override), no sobre la suma automática", () => {
    const rules = [
      rule({ ruleType: "VOLUME_SCALE", scope: "GLOBAL", config: { tiers: [{ minQty: 10, discountPct: 10 }] } }),
    ];
    // Override manual de $25/set (la suma automática real de piezas sería otra cifra, pero no
    // participa en absoluto — el motor solo ve el valor ya resuelto).
    const result = computeCartPricing(cart, { "set-1": { pricePerSet: 25, hasMissingPrices: false } }, rules);
    expect(result.subtotalBeforeDiscount).toBe(250);
    expect(result.volumeDiscountPct).toBe(10);
    expect(result.volumeDiscountAmount).toBe(25); // 10% de 250
    expect(result.total).toBe(225);
  });

  it("override marca hasMissingPrices en false aunque alguna pieza real no tenga precio al mayor", () => {
    // Simula getSetPricesByIds cuando hay override: siempre hasMissingPrices: false.
    const result = computeCartPricing(cart, { "set-1": { pricePerSet: 25, hasMissingPrices: false } }, []);
    expect(result.hasMissingPrices).toBe(false);
  });
});

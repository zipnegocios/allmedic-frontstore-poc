import { describe, it, expect } from "vitest";
import { RULE_CONFIG_SCHEMAS } from "../../rule-config-schemas";

const PromoSchema = RULE_CONFIG_SCHEMAS.PROMO;

describe("RULE_CONFIG_SCHEMAS.PROMO — validación por kind", () => {
  it("acepta N_PLUS_ONE válido (compatibilidad con reglas ya guardadas)", () => {
    expect(() => PromoSchema.parse({ kind: "N_PLUS_ONE", buy: 13, free: 1 })).not.toThrow();
  });

  it("rechaza N_PLUS_ONE con buy no positivo", () => {
    expect(() => PromoSchema.parse({ kind: "N_PLUS_ONE", buy: 0, free: 1 })).toThrow();
  });

  it("acepta PERCENT_OFF válido y rechaza pct fuera de rango", () => {
    expect(() => PromoSchema.parse({ kind: "PERCENT_OFF", pct: 25 })).not.toThrow();
    expect(() => PromoSchema.parse({ kind: "PERCENT_OFF", pct: 150 })).toThrow();
  });

  it("acepta FIXED_AMOUNT_OFF válido y rechaza amountPerUnit no positivo", () => {
    expect(() => PromoSchema.parse({ kind: "FIXED_AMOUNT_OFF", amountPerUnit: 5 })).not.toThrow();
    expect(() => PromoSchema.parse({ kind: "FIXED_AMOUNT_OFF", amountPerUnit: 0 })).toThrow();
  });

  it("acepta FIXED_PRICE válido y rechaza price no positivo", () => {
    expect(() => PromoSchema.parse({ kind: "FIXED_PRICE", price: 7 })).not.toThrow();
    expect(() => PromoSchema.parse({ kind: "FIXED_PRICE", price: -1 })).toThrow();
  });

  it("acepta NTH_UNIT_PCT válido y rechaza n menor a 2", () => {
    expect(() => PromoSchema.parse({ kind: "NTH_UNIT_PCT", n: 2, pct: 50 })).not.toThrow();
    expect(() => PromoSchema.parse({ kind: "NTH_UNIT_PCT", n: 1, pct: 50 })).toThrow();
  });

  it("THRESHOLD_DISCOUNT: acepta exactamente uno de pct/amount, rechaza ambos o ninguno", () => {
    expect(() => PromoSchema.parse({ kind: "THRESHOLD_DISCOUNT", minSubtotal: 100, pct: 10 })).not.toThrow();
    expect(() => PromoSchema.parse({ kind: "THRESHOLD_DISCOUNT", minSubtotal: 100, amount: 10 })).not.toThrow();
    expect(() => PromoSchema.parse({ kind: "THRESHOLD_DISCOUNT", minSubtotal: 100, pct: 10, amount: 10 })).toThrow();
    expect(() => PromoSchema.parse({ kind: "THRESHOLD_DISCOUNT", minSubtotal: 100 })).toThrow();
  });

  it("GIFT: acepta al menos una condición, rechaza si no hay ninguna", () => {
    expect(() => PromoSchema.parse({ kind: "GIFT", minQty: 10, description: "Regalo" })).not.toThrow();
    expect(() => PromoSchema.parse({ kind: "GIFT", minSubtotal: 100, description: "Regalo" })).not.toThrow();
    expect(() => PromoSchema.parse({ kind: "GIFT", description: "Regalo" })).toThrow();
  });

  it("GIFT: rechaza description vacía", () => {
    expect(() => PromoSchema.parse({ kind: "GIFT", minQty: 1, description: "" })).toThrow();
  });

  it("COMBO: acepta config completa y rechaza si falta algún set o pct fuera de rango", () => {
    expect(() =>
      PromoSchema.parse({ kind: "COMBO", triggerSetId: "set-a", triggerMinQty: 5, targetSetId: "set-b", pct: 10 })
    ).not.toThrow();
    expect(() =>
      PromoSchema.parse({ kind: "COMBO", triggerSetId: "", triggerMinQty: 5, targetSetId: "set-b", pct: 10 })
    ).toThrow();
    expect(() =>
      PromoSchema.parse({ kind: "COMBO", triggerSetId: "set-a", triggerMinQty: 5, targetSetId: "set-b", pct: 200 })
    ).toThrow();
  });

  it("rechaza un kind desconocido", () => {
    expect(() => PromoSchema.parse({ kind: "NOT_A_KIND", foo: 1 })).toThrow();
  });
});

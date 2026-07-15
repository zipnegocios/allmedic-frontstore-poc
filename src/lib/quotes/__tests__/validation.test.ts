import { describe, it, expect } from "vitest";
import { PatchQuoteSchema, QuoteItemSchema } from "../validation";

// Item real (ver docs/reports/REPORTE-cotizacion-patch-400-2026-07-15.md) de una cotización
// creada desde el carrito corporativo público: su pricingBreakdown es `{ composition }`, no un
// array de ajustes del motor de reglas. Antes del fix, reenviar este item sin modificar en el
// PATCH del editor admin producía 400 (Invalid input: expected array, received object).
const compositionItem = {
  id: "f7d8f15b-aafc-46d0-9ccc-b7c8a211c82e",
  kind: "CATALOG" as const,
  productId: null,
  variantId: null,
  setId: "04b89f97-6a6b-42c2-a68c-01dbe6391dc4",
  size: "XS",
  color: null,
  description: "Uniforme FIGS Premium — Talla XS",
  quantity: 12,
  suggestedUnitPrice: 84,
  unitPrice: 84,
  discountType: null,
  discountValue: 0,
  taxRateOverride: null,
  pricingBreakdown: {
    composition: [
      { size: "XS", productId: "3798e015-e348-5957-9598-d9760340e127" },
      { size: "XS", productId: "53541a55-5dac-5e6f-89f3-5f1a5e5e16d7" },
    ],
  },
  sortOrder: 0,
};

describe("QuoteItemSchema — pricingBreakdown", () => {
  it("acepta la forma { composition } de una línea creada desde el carrito corporativo público", () => {
    const result = QuoteItemSchema.safeParse(compositionItem);
    expect(result.success).toBe(true);
  });

  it("acepta la forma de array de ajustes del motor de reglas (recalcular sugeridos en el admin)", () => {
    const result = QuoteItemSchema.safeParse({
      ...compositionItem,
      pricingBreakdown: [{ ruleId: "rule-1", ruleName: "Volumen", kind: "VOLUME_SCALE", amount: -5 }],
    });
    expect(result.success).toBe(true);
  });

  it("acepta pricingBreakdown null", () => {
    const result = QuoteItemSchema.safeParse({ ...compositionItem, pricingBreakdown: null });
    expect(result.success).toBe(true);
  });

  it("rechaza una forma de pricingBreakdown que no coincide con ninguno de los dos contratos", () => {
    const result = QuoteItemSchema.safeParse({ ...compositionItem, pricingBreakdown: { foo: "bar" } });
    expect(result.success).toBe(false);
  });
});

describe("PatchQuoteSchema — round-trip del payload real de QuoteEditor.buildPatch()", () => {
  it("valida el payload completo tal como lo construye el editor para una cotización con línea de set", () => {
    const patchPayload = {
      customerName: "Hospital",
      customerIdNumber: "2135146541651",
      customerContactName: "Gustavo",
      customerEmail: "zipnegocios@gmail.com",
      customerPhone: "+13164695701",
      customerAddress: null,
      customerCity: "Quito",
      taxPresetId: null,
      taxRate: 0,
      pricesIncludeTax: false,
      discountType: null,
      discountValue: 0,
      validityPresetId: null,
      validityDays: null,
      expiresAt: null,
      notes: null,
      items: [compositionItem],
      propagateToProfile: false,
    };
    const result = PatchQuoteSchema.safeParse(patchPayload);
    expect(result.success).toBe(true);
  });

  it("acepta expiresAt como string ISO (así lo envía el editor tras aplicar un preset de vigencia)", () => {
    const result = PatchQuoteSchema.safeParse({
      customerName: "Hospital",
      expiresAt: "2026-08-14T12:00:00.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.expiresAt).toBeInstanceOf(Date);
  });
});

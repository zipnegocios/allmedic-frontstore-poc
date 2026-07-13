import { describe, it, expect } from "vitest";
import { computeQuoteTotals } from "../totals";

describe("computeQuoteTotals", () => {
  it("calcula subtotal y total sin descuentos ni impuestos", () => {
    const result = computeQuoteTotals(
      [{ quantity: 2, unitPrice: 50 }],
      { taxRate: 0, pricesIncludeTax: false }
    );
    expect(result.subtotal).toBe(100);
    expect(result.total).toBe(100);
    expect(result.totalTax).toBe(0);
  });

  it("modo 'se suma': agrega el impuesto al final sobre la base neta", () => {
    const result = computeQuoteTotals(
      [{ quantity: 1, unitPrice: 100 }],
      { taxRate: 15, pricesIncludeTax: false }
    );
    expect(result.netSubtotal).toBe(100);
    expect(result.totalTax).toBe(15);
    expect(result.total).toBe(115);
  });

  it("modo 'incluye impuesto': desglosa hacia atrás, el total no cambia", () => {
    const result = computeQuoteTotals(
      [{ quantity: 1, unitPrice: 115 }],
      { taxRate: 15, pricesIncludeTax: true }
    );
    expect(result.netSubtotal).toBe(115);
    expect(result.taxBreakdown[0].taxableBase).toBe(100);
    expect(result.totalTax).toBe(15);
    expect(result.total).toBe(115);
  });

  it("aplica descuento de línea porcentual", () => {
    const result = computeQuoteTotals(
      [{ quantity: 1, unitPrice: 100, discountType: "PERCENTAGE", discountValue: 10 }],
      { taxRate: 0, pricesIncludeTax: false }
    );
    expect(result.lineDiscountTotal).toBe(10);
    expect(result.netSubtotal).toBe(90);
    expect(result.total).toBe(90);
  });

  it("aplica descuento de línea fijo, topado al subtotal de la línea", () => {
    const result = computeQuoteTotals(
      [{ quantity: 1, unitPrice: 50, discountType: "FIXED", discountValue: 999 }],
      { taxRate: 0, pricesIncludeTax: false }
    );
    expect(result.lineDiscountTotal).toBe(50);
    expect(result.netSubtotal).toBe(0);
  });

  it("aplica descuento global porcentual sobre el subtotal neto de línea", () => {
    const result = computeQuoteTotals(
      [{ quantity: 1, unitPrice: 200 }],
      { taxRate: 0, pricesIncludeTax: false, discountType: "PERCENTAGE", discountValue: 10 }
    );
    expect(result.globalDiscount).toBe(20);
    expect(result.netSubtotal).toBe(180);
  });

  it("aplica descuento global fijo", () => {
    const result = computeQuoteTotals(
      [{ quantity: 1, unitPrice: 200 }],
      { taxRate: 0, pricesIncludeTax: false, discountType: "FIXED", discountValue: 50 }
    );
    expect(result.globalDiscount).toBe(50);
    expect(result.netSubtotal).toBe(150);
    expect(result.totalDiscount).toBe(50);
  });

  it("combina descuento de línea + descuento global + impuesto sumado", () => {
    const result = computeQuoteTotals(
      [
        { quantity: 2, unitPrice: 100, discountType: "PERCENTAGE", discountValue: 10 }, // 200 -> 180
      ],
      { taxRate: 15, pricesIncludeTax: false, discountType: "PERCENTAGE", discountValue: 10 } // 180 -> 162
    );
    expect(result.subtotal).toBe(200);
    expect(result.lineDiscountTotal).toBe(20);
    expect(result.globalDiscount).toBe(18);
    expect(result.netSubtotal).toBe(162);
    expect(result.totalTax).toBe(24.3);
    expect(result.total).toBe(186.3);
  });

  it("respeta override de tarifa por línea distinto de la tasa de cabecera", () => {
    const result = computeQuoteTotals(
      [
        { quantity: 1, unitPrice: 100, taxRateOverride: 0 },
        { quantity: 1, unitPrice: 100 },
      ],
      { taxRate: 15, pricesIncludeTax: false }
    );
    expect(result.taxBreakdown).toHaveLength(2);
    const rate0 = result.taxBreakdown.find((t) => t.rate === 0);
    const rate15 = result.taxBreakdown.find((t) => t.rate === 15);
    expect(rate0?.taxAmount).toBe(0);
    expect(rate15?.taxAmount).toBe(15);
    expect(result.totalTax).toBe(15);
    expect(result.total).toBe(215);
  });

  it("agrupa base imponible por tarifa cuando hay overrides de línea mixtos", () => {
    const result = computeQuoteTotals(
      [
        { quantity: 1, unitPrice: 100, taxRateOverride: 15 },
        { quantity: 1, unitPrice: 100, taxRateOverride: 8 },
        { quantity: 1, unitPrice: 100 },
      ],
      { taxRate: 0, pricesIncludeTax: false }
    );
    const rates = result.taxBreakdown.map((t) => t.rate).sort((a, b) => a - b);
    expect(rates).toEqual([0, 8, 15]);
  });

  it("maneja carritos vacíos sin dividir por cero", () => {
    const result = computeQuoteTotals([], { taxRate: 15, pricesIncludeTax: false });
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
    expect(result.taxBreakdown).toHaveLength(0);
  });

  it("no arrastra error de punto flotante en cantidades con decimales repetidos", () => {
    const result = computeQuoteTotals(
      [{ quantity: 3, unitPrice: 0.1 }],
      { taxRate: 0, pricesIncludeTax: false }
    );
    expect(result.subtotal).toBe(0.3);
  });
});

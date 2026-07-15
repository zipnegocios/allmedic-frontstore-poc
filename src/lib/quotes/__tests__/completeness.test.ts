import { describe, it, expect } from "vitest";
import { checkQuoteCompleteness } from "../completeness";

describe("checkQuoteCompleteness", () => {
  it("devuelve null cuando la cotización está completa", () => {
    expect(checkQuoteCompleteness({ status: "DRAFT", items: [{}], customerName: "Hospital" })).toBeNull();
  });

  it("reporta cuando ya es definitiva", () => {
    expect(checkQuoteCompleteness({ status: "FINAL", items: [{}], customerName: "Hospital" })).toBe(
      "La cotización ya es definitiva"
    );
  });

  it("reporta cuando no tiene líneas", () => {
    expect(checkQuoteCompleteness({ status: "DRAFT", items: [], customerName: "Hospital" })).toBe(
      "La cotización no tiene líneas"
    );
  });

  it("reporta cuando falta el nombre del cliente", () => {
    expect(checkQuoteCompleteness({ status: "DRAFT", items: [{}], customerName: "" })).toBe(
      "Falta el nombre del cliente"
    );
    expect(checkQuoteCompleteness({ status: "DRAFT", items: [{}], customerName: null })).toBe(
      "Falta el nombre del cliente"
    );
  });
});

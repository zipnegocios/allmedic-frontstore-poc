import { describe, it, expect } from "vitest";
import { effectiveManualPrice } from "../set-pricing";

describe("effectiveManualPrice", () => {
  it("devuelve null cuando el set no tiene precio manual (automático)", () => {
    expect(effectiveManualPrice(null, null, null)).toBeNull();
  });

  it("devuelve el precio manual base cuando no hay rebaja", () => {
    expect(effectiveManualPrice("100.00", null, null)).toBe(100);
  });

  it("devuelve el precio manual rebajado cuando está vigente (sin fecha de fin)", () => {
    expect(effectiveManualPrice("100.00", "80.00", null)).toBe(80);
  });

  it("devuelve el precio manual rebajado cuando la fecha de fin aún no llega", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-06-01T00:00:00Z");
    expect(effectiveManualPrice("100.00", "80.00", end, now)).toBe(80);
  });

  it("cae al precio manual base cuando la rebaja ya venció", () => {
    const now = new Date("2026-06-02T00:00:00Z");
    const end = new Date("2026-06-01T00:00:00Z");
    expect(effectiveManualPrice("100.00", "80.00", end, now)).toBe(100);
  });
});

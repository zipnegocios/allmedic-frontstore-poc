import { describe, it, expect } from "vitest";
import { formatQuoteNumber, nextQuoteSequence } from "../numbering";

describe("formatQuoteNumber", () => {
  it("formatea con 5 dígitos de padding", () => {
    expect(formatQuoteNumber(2026, 1)).toBe("COT-2026-00001");
    expect(formatQuoteNumber(2026, 42)).toBe("COT-2026-00042");
    expect(formatQuoteNumber(2026, 100000)).toBe("COT-2026-100000");
  });
});

/** Simula `quote_number_counters` en memoria: el mock incrementa el contador del año que se
 * le indica justo antes de cada llamada (evita tener que parsear el sql`` interpolado). */
function makeFakeCounterTx() {
  const counters = new Map<number, number>();
  let requestedYear = 0;
  const tx = {
    execute: async () => {
      const next = (counters.get(requestedYear) ?? 0) + 1;
      counters.set(requestedYear, next);
      return { rows: [{ last_number: next }] };
    },
  };
  return {
    tx,
    async next(year: number) {
      requestedYear = year;
      return nextQuoteSequence(tx, year);
    },
  };
}

describe("nextQuoteSequence", () => {
  it("asigna 1 la primera vez para un año, y se incrementa en llamadas sucesivas", async () => {
    const counter = makeFakeCounterTx();
    const first = await counter.next(2026);
    const second = await counter.next(2026);
    const third = await counter.next(2026);
    expect([first, second, third]).toEqual([1, 2, 3]);
  });

  it("mantiene contadores independientes por año", async () => {
    const counter = makeFakeCounterTx();
    const seq2026a = await counter.next(2026);
    const seq2027a = await counter.next(2027);
    const seq2026b = await counter.next(2026);

    expect(seq2026a).toBe(1);
    expect(seq2027a).toBe(1);
    expect(seq2026b).toBe(2);
  });
});

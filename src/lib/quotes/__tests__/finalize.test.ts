import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks de infraestructura (BD, PDF, R2) ───
// Estos tests verifican el ENCADENAMIENTO de la transición a definitiva y de la regeneración
// de PDF (misma pdfKey, subida a R2), no el contenido del PDF ni el SQL real.

const uploadQuotePdf = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
const generateQuotePdf = vi.fn(async () => Buffer.from("pdf-simulado"));
const nextQuoteNumber = vi.fn(async () => "COT-2026-00099");
const getQuoteById = vi.fn();

vi.mock("../pdf-storage", () => ({
  uploadQuotePdf: (...args: unknown[]) => uploadQuotePdf(...(args as [])),
  resolveQuotePdfUrl: (key: string) => `https://cotizaciones.allmedicuniforms.com/${key}`,
}));
vi.mock("../pdf", () => ({
  generateQuotePdf: (...args: unknown[]) => generateQuotePdf(...(args as [])),
}));
vi.mock("../numbering", () => ({
  nextQuoteNumber: (...args: unknown[]) => nextQuoteNumber(...(args as [])),
}));
vi.mock("../service", () => ({
  getQuoteById: (...args: unknown[]) => getQuoteById(...(args as [])),
}));

// Stub encadenable de Drizzle: cualquier método devuelve el mismo objeto; los puntos donde el
// código hace `await` (limit/orderBy/returning o el propio chain como thenable) resuelven a un
// resultado configurable por llamada.
function makeChain(result: unknown = []) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "from", "leftJoin", "innerJoin", "where", "set", "values", "update", "insert", "delete"]) {
    c[m] = () => c;
  }
  c.limit = () => Promise.resolve(result);
  c.orderBy = () => Promise.resolve(result);
  c.returning = () => Promise.resolve(result);
  c.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(result).then(onFulfilled);
  return c;
}

const txUpdated = { id: "q1", quoteNumber: "COT-2026-00099", status: "FINAL" };

vi.mock("@/db", () => ({
  db: {
    select: () => makeChain([]),
    update: () => makeChain([]),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ update: () => makeChain([txUpdated]) }),
  },
}));

import { finalizeQuote, regenerateQuotePdf, QuoteFinalizeError } from "../finalize";

const baseQuote = {
  id: "q1",
  status: "DRAFT",
  customerName: "Hospital",
  items: [{ id: "i1" }],
  pdfKey: null as string | null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("finalizeQuote — transición a definitiva", () => {
  it("asigna número, genera el PDF y lo sube a R2 con una clave derivada del número", async () => {
    getQuoteById.mockResolvedValue(baseQuote);
    await finalizeQuote("q1");

    expect(nextQuoteNumber).toHaveBeenCalledTimes(1);
    expect(generateQuotePdf).toHaveBeenCalledTimes(1);
    expect(uploadQuotePdf).toHaveBeenCalledTimes(1);
    const [uploadedKey] = uploadQuotePdf.mock.calls[0] as unknown as [string];
    expect(uploadedKey).toMatch(/^\d{4}\/COT-2026-00099-[2-9A-HJ-NP-Za-km-z]+\.pdf$/);
  });

  it("rechaza con mensaje claro una cotización sin líneas (incompletitud legítima)", async () => {
    getQuoteById.mockResolvedValue({ ...baseQuote, items: [] });
    await expect(finalizeQuote("q1")).rejects.toThrow("La cotización no tiene líneas");
    await expect(finalizeQuote("q1")).rejects.toBeInstanceOf(QuoteFinalizeError);
    expect(uploadQuotePdf).not.toHaveBeenCalled();
    expect(nextQuoteNumber).not.toHaveBeenCalled();
  });

  it("rechaza una cotización que ya es definitiva", async () => {
    getQuoteById.mockResolvedValue({ ...baseQuote, status: "FINAL" });
    await expect(finalizeQuote("q1")).rejects.toThrow("La cotización ya es definitiva");
  });
});

describe("regenerateQuotePdf — edición de una definitiva", () => {
  it("regenera y sube el PDF sobre la MISMA pdfKey existente (el enlace compartido no cambia)", async () => {
    const existingKey = "2026/COT-2026-00003-r68VrVtcNy7mpq2VBJaYA.pdf";
    getQuoteById.mockResolvedValue({ ...baseQuote, status: "FINAL", pdfKey: existingKey });

    await regenerateQuotePdf("q1");

    expect(generateQuotePdf).toHaveBeenCalledTimes(1);
    expect(uploadQuotePdf).toHaveBeenCalledTimes(1);
    expect(uploadQuotePdf.mock.calls[0][0]).toBe(existingKey);
  });

  it("rechaza regenerar el PDF de un borrador o de una definitiva sin pdfKey", async () => {
    getQuoteById.mockResolvedValue({ ...baseQuote, status: "DRAFT" });
    await expect(regenerateQuotePdf("q1")).rejects.toThrow(
      "Solo se puede regenerar el PDF de una cotización definitiva"
    );

    getQuoteById.mockResolvedValue({ ...baseQuote, status: "FINAL", pdfKey: null });
    await expect(regenerateQuotePdf("q1")).rejects.toBeInstanceOf(QuoteFinalizeError);
    expect(uploadQuotePdf).not.toHaveBeenCalled();
  });

  it("propaga el error si la subida a R2 falla (el caller decide la estrategia de aviso)", async () => {
    getQuoteById.mockResolvedValue({ ...baseQuote, status: "FINAL", pdfKey: "2026/COT-X.pdf" });
    uploadQuotePdf.mockRejectedValueOnce(new Error("R2 no disponible"));
    await expect(regenerateQuotePdf("q1")).rejects.toThrow("R2 no disponible");
  });
});

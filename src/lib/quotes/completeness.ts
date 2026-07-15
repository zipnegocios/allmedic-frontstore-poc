// ─── Validación de completitud para la transición a DEFINITIVA ───
// Módulo puro (sin BD) — usado por `finalizeQuote` antes de asignar `quoteNumber` y generar el
// PDF. Separado para poder testear cada condición sin mockear Drizzle/transacciones.

export interface QuoteCompletenessInput {
  status: string;
  items: unknown[];
  customerName: string | null;
}

/** Devuelve el primer motivo por el que la cotización no puede pasar a DEFINITIVA, o `null` si está completa. */
export function checkQuoteCompleteness(quote: QuoteCompletenessInput): string | null {
  if (quote.status !== "DRAFT") return "La cotización ya es definitiva";
  if (quote.items.length === 0) return "La cotización no tiene líneas";
  if (!quote.customerName) return "Falta el nombre del cliente";
  return null;
}

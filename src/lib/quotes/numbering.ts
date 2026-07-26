// ─── Numeración atómica de cotizaciones (COT-YYYY-NNNNN) ───
// Se asigna solo al pasar una cotización a DEFINITIVA. Usa una tabla contador dedicada
// (`quote_number_counters`) con `UPDATE ... RETURNING` dentro de una transacción — evita
// condiciones de carrera sin depender de secuencias de Postgres creadas dinámicamente por año.

import { sql } from "drizzle-orm";

export function formatQuoteNumber(year: number, sequence: number): string {
  return `COT-${year}-${String(sequence).padStart(5, "0")}`;
}

/** Subconjunto mínimo de la API de Drizzle que necesita este módulo — permite testear con un
 * mock en memoria sin depender del tipo completo de `db`/`db.transaction`. */
export interface QuoteCounterExecutor {
  execute(query: unknown): Promise<unknown>;
}

/**
 * Incrementa y devuelve el siguiente número de secuencia para el año dado. Debe llamarse dentro
 * de una transacción (`db.transaction`) junto con el resto de la finalización de la cotización,
 * para que la asignación del número y el resto de cambios sean atómicos.
 */
export async function nextQuoteSequence(tx: QuoteCounterExecutor, year: number): Promise<number> {
  const result = await tx.execute(sql`
    INSERT INTO quote_number_counters (year, last_number)
    VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE SET last_number = quote_number_counters.last_number + 1
    RETURNING last_number
  `);
  const rows = (result as unknown as { rows: Array<{ last_number: number }> }).rows;
  return rows[0].last_number;
}

export async function nextQuoteNumber(tx: QuoteCounterExecutor, now: Date = new Date()): Promise<string> {
  const year = now.getFullYear();
  const sequence = await nextQuoteSequence(tx, year);
  return formatQuoteNumber(year, sequence);
}

// ─── Numeración atómica de solicitudes (SOL-YYYY-NNNNN) ───
// Secuencia independiente de la de cotización formal (panel de correos, 2026-07-25) — se
// asigna al crear la solicitud, antes de que exista `quoteNumber` (que solo se asigna al
// finalizar). Mismo patrón atómico, tabla contador dedicada (`request_number_counters`).

export function formatRequestNumber(year: number, sequence: number): string {
  return `SOL-${year}-${String(sequence).padStart(5, "0")}`;
}

export async function nextRequestSequence(tx: QuoteCounterExecutor, year: number): Promise<number> {
  const result = await tx.execute(sql`
    INSERT INTO request_number_counters (year, last_number)
    VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE SET last_number = request_number_counters.last_number + 1
    RETURNING last_number
  `);
  const rows = (result as unknown as { rows: Array<{ last_number: number }> }).rows;
  return rows[0].last_number;
}

export async function nextRequestNumber(tx: QuoteCounterExecutor, now: Date = new Date()): Promise<string> {
  const year = now.getFullYear();
  const sequence = await nextRequestSequence(tx, year);
  return formatRequestNumber(year, sequence);
}

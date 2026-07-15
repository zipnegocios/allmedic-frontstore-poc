// ─── Transición de cotización a DEFINITIVA ───
// Asigna número atómico, genera el PDF y lo sube al bucket dedicado, todo transaccional.
// Editar una DEFINITIVA existente regenera el PDF sobre la MISMA `pdfKey` (mismo enlace ya
// compartido con el cliente sigue mostrando la versión vigente) — ver `regenerateQuotePdf`.

import { customAlphabet } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteItems, companySettings, mediaAssets } from "@/db/schema";
import { nextQuoteNumber } from "./numbering";
import { generateQuotePdf, type CompanySettingsForPdf } from "./pdf";
import { uploadQuotePdf } from "./pdf-storage";
import { getQuoteById } from "./service";
import { checkQuoteCompleteness } from "./completeness";
import { resolveMediaUrl } from "@/lib/media";

// Alfabeto sin caracteres ambiguos (0/O, 1/l/I) — el token va en una URL pública.
const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz", 21);

export class QuoteFinalizeError extends Error {}

async function loadCompanySettings(): Promise<CompanySettingsForPdf | null> {
  const [row] = await db
    .select({
      razonSocial: companySettings.razonSocial,
      ruc: companySettings.ruc,
      address: companySettings.address,
      phones: companySettings.phones,
      email: companySettings.email,
      website: companySettings.website,
      footerNote: companySettings.footerNote,
      logoStorageKey: mediaAssets.storageKey,
    })
    .from(companySettings)
    .leftJoin(mediaAssets, eq(companySettings.logoMediaId, mediaAssets.id))
    .limit(1);
  if (!row) return null;
  const { logoStorageKey, ...rest } = row;
  return { ...rest, logoUrl: logoStorageKey ? resolveMediaUrl(logoStorageKey) : null };
}

function buildPdfKey(quoteNumber: string): string {
  const year = quoteNumber.split("-")[1] ?? String(new Date().getFullYear());
  return `${year}/${quoteNumber}-${nanoid()}.pdf`;
}

/**
 * Pasa una cotización BORRADOR a DEFINITIVA: valida completitud, asigna `quoteNumber` de forma
 * atómica y genera+sube el PDF. Todo dentro de una transacción — si la generación del PDF
 * falla, la asignación del número se revierte (no quedan números "quemados" por errores).
 */
export async function finalizeQuote(id: string) {
  const quote = await getQuoteById(id);
  if (!quote) throw new QuoteFinalizeError("Cotización no encontrada");
  const completenessError = checkQuoteCompleteness(quote);
  if (completenessError) throw new QuoteFinalizeError(completenessError);

  const settings = await loadCompanySettings();

  const result = await db.transaction(async (tx) => {
    const quoteNumber = await nextQuoteNumber(tx);
    const pdfKey = buildPdfKey(quoteNumber);

    const [updated] = await tx
      .update(quotes)
      .set({ quoteNumber, status: "FINAL", pdfKey, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();

    return { updated, pdfKey };
  });

  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, id)).orderBy(quoteItems.sortOrder);
  const buffer = await generateQuotePdf(result.updated, items, settings);
  await uploadQuotePdf(result.pdfKey, buffer);

  await db.update(quotes).set({ pdfGeneratedAt: new Date() }).where(eq(quotes.id, id));

  return getQuoteById(id);
}

/**
 * Regenera el PDF de una cotización DEFINITIVA ya existente, sobre la MISMA `pdfKey` — se
 * invoca explícitamente al guardar una edición sobre una cotización FINAL (la UI muestra el
 * aviso "al guardar se regenerará el PDF" antes de confirmar; no ocurre automágicamente).
 */
export async function regenerateQuotePdf(id: string) {
  const quote = await getQuoteById(id);
  if (!quote) throw new QuoteFinalizeError("Cotización no encontrada");
  if (quote.status !== "FINAL" || !quote.pdfKey) {
    throw new QuoteFinalizeError("Solo se puede regenerar el PDF de una cotización definitiva");
  }

  const settings = await loadCompanySettings();
  const buffer = await generateQuotePdf(quote, quote.items, settings);
  await uploadQuotePdf(quote.pdfKey, buffer);
  await db.update(quotes).set({ pdfGeneratedAt: new Date() }).where(eq(quotes.id, id));

  return getQuoteById(id);
}

// ─── Acciones de entrega de una cotización: correo y publicación en portal ───

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quotes, corporateAccounts } from "@/db/schema";
import { sendEmail, quoteSentEmail } from "@/lib/email";
import { getQuoteById } from "./service";
import { resolveQuotePdfUrl } from "./pdf-storage";

export class QuoteDeliveryError extends Error {}

/** Descarga el PDF ya generado desde R2 vía su URL pública — reutilizado para adjuntarlo al
 * correo (no se regenera: se envía exactamente el documento vigente). */
async function fetchQuotePdfBuffer(pdfKey: string): Promise<Buffer> {
  const url = resolveQuotePdfUrl(pdfKey);
  const res = await fetch(url);
  if (!res.ok) throw new QuoteDeliveryError(`No se pudo descargar el PDF de la cotización (${res.status})`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Envía la cotización por correo con el PDF adjunto y registra `sentByEmailAt`. Requiere que la
 * cotización esté DEFINITIVA (con PDF generado) y tenga un correo de cliente.
 */
export async function sendQuoteByEmail(id: string) {
  const quote = await getQuoteById(id);
  if (!quote) throw new QuoteDeliveryError("Cotización no encontrada");
  if (quote.status !== "FINAL" || !quote.pdfKey) {
    throw new QuoteDeliveryError("Solo se puede enviar por correo una cotización definitiva con PDF generado");
  }
  if (!quote.customerEmail) {
    throw new QuoteDeliveryError("La cotización no tiene un correo de cliente configurado");
  }

  const buffer = await fetchQuotePdfBuffer(quote.pdfKey);
  const { subject, html } = quoteSentEmail({
    customerName: quote.customerName,
    quoteNumber: quote.quoteNumber!,
    total: Number(quote.total),
  });

  await sendEmail({
    to: quote.customerEmail,
    subject,
    html,
    attachments: [{ filename: `${quote.quoteNumber}.pdf`, content: buffer }],
  });

  await db.update(quotes).set({ sentByEmailAt: new Date() }).where(eq(quotes.id, id));
  return getQuoteById(id);
}

/**
 * Publica la cotización en el portal del cliente corporativo — solo disponible si el canal es
 * CORPORATE y la cuenta vinculada está APROBADA (si no, la UI debe deshabilitar la acción con
 * explicación — "sin opción muerta", no se llega a lanzar este error en el flujo normal).
 */
export async function publishQuoteToPortal(id: string) {
  const quote = await getQuoteById(id);
  if (!quote) throw new QuoteDeliveryError("Cotización no encontrada");
  if (quote.status !== "FINAL") {
    throw new QuoteDeliveryError("Solo se puede publicar una cotización definitiva");
  }
  if (quote.channel !== "CORPORATE" || !quote.accountId) {
    throw new QuoteDeliveryError("Solo las cotizaciones corporativas con cuenta vinculada se pueden publicar en el portal");
  }

  const [account] = await db.select().from(corporateAccounts).where(eq(corporateAccounts.id, quote.accountId)).limit(1);
  if (!account || account.status !== "APPROVED") {
    throw new QuoteDeliveryError("La cuenta corporativa vinculada no está aprobada");
  }

  await db.update(quotes).set({ publishedToPortalAt: new Date() }).where(eq(quotes.id, id));
  return getQuoteById(id);
}

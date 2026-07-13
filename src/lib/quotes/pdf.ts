// ─── Generación del PDF de una cotización ───
// Librería elegida: @react-pdf/renderer (validado en Fase 0 — compatible con React 19.2/
// Next 16.2, usa @react-pdf/reconciler internamente, sin conflicto de peer deps). Genera un
// Buffer en memoria; la subida a R2 vive en `pdf-storage.ts`, separada para poder testear esta
// función sin red.

import { renderToBuffer } from "@react-pdf/renderer";
import { QuotePdfDocument, type QuotePdfQuote, type QuotePdfItem } from "./pdf-template";

export interface CompanySettingsForPdf {
  razonSocial: string;
  ruc: string;
  address: string | null;
  phones: string | null;
  email: string | null;
  website: string | null;
  footerNote: string | null;
  logoUrl: string | null;
}

export async function generateQuotePdf(
  quote: QuotePdfQuote,
  items: QuotePdfItem[],
  companySettings: CompanySettingsForPdf | null
): Promise<Buffer> {
  const doc = QuotePdfDocument({ quote, items, companySettings });
  return renderToBuffer(doc);
}

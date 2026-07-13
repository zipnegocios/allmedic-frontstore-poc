// ─── Subida de PDFs de cotización al bucket R2 dedicado ───
import { putObject } from "@/lib/r2";

export async function uploadQuotePdf(key: string, buffer: Buffer): Promise<void> {
  await putObject(key, buffer, "application/pdf", "public, max-age=0, must-revalidate", "QUOTES");
}

export function resolveQuotePdfUrl(pdfKey: string): string {
  const base = process.env.R2_QUOTES_PUBLIC_URL;
  if (!base) throw new Error("Falta la variable de entorno R2_QUOTES_PUBLIC_URL");
  return `${base}/${pdfKey}`;
}

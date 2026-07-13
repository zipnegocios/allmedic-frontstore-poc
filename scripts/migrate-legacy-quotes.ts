/**
 * One-off: migra datos de las tablas legacy `quote_requests`/`quote_attachments`
 * (modelo JSONB de solicitudes corporativas) al modelo nuevo `quotes`/`quote_items`/
 * `quote_documents` del módulo de Cotizaciones Pro.
 *
 * Idempotente: reutiliza el mismo `id` de `quote_requests`/`quote_attachments` como
 * `id` de `quotes`/`quote_documents` e inserta con `ON CONFLICT (id) DO NOTHING`, así
 * que correr el script más de una vez no duplica filas.
 *
 * `quote_status_history` se descarta deliberadamente (decisión de producto: el nuevo
 * modelo no versiona historial de estados).
 *
 * Uso: npx tsx --env-file=.env.local scripts/migrate-legacy-quotes.ts [--dry-run]
 * Después de verificar el resultado, correr con --drop-legacy para eliminar
 * quote_requests / quote_attachments / quote_status_history.
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteItems, quoteDocuments } from "@/db/schema";

const DRY_RUN = process.argv.includes("--dry-run");
const DROP_LEGACY = process.argv.includes("--drop-legacy");

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function mapStatus(oldStatus: string): { status: "FINAL"; outcome: "ACCEPTED" | "REJECTED" | null } {
  if (oldStatus === "APPROVED") return { status: "FINAL", outcome: "ACCEPTED" };
  if (oldStatus === "REJECTED") return { status: "FINAL", outcome: "REJECTED" };
  return { status: "FINAL", outcome: null };
}

interface LegacyQuoteRequest {
  id: string;
  code: string;
  account_id: string | null;
  customer_data: { ruc?: string; razonSocial?: string; contactName?: string; email?: string; phone?: string; city?: string };
  items: Array<{ setId?: string; setName?: string; lines?: Array<{ size?: string; color?: string; quantity: number }> }>;
  reference_subtotal: string;
  quoted_total: string | null;
  status: string;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface LegacyAttachment {
  id: string;
  quote_id: string;
  type: string;
  file_name: string | null;
  file_url: string;
  uploaded_by: string | null;
  created_at: string;
}

async function main() {
  console.log(DRY_RUN ? "🔍 Dry-run: no se escribirá nada" : "🔧 Migrando cotizaciones legacy...");

  const legacyExists = await db.execute(sql`
    SELECT to_regclass('public.quote_requests') as reg
  `);
  if (!(legacyExists as unknown as { rows: Array<{ reg: string | null }> }).rows[0].reg) {
    console.log("  quote_requests no existe — nada que migrar.");
    return;
  }

  const legacyQuotesResult = await db.execute(sql`SELECT * FROM quote_requests ORDER BY created_at`);
  const legacyQuotes = (legacyQuotesResult as unknown as { rows: LegacyQuoteRequest[] }).rows;
  console.log(`  Encontradas ${legacyQuotes.length} filas en quote_requests`);

  const legacyAttachmentsResult = await db.execute(sql`SELECT * FROM quote_attachments`);
  const legacyAttachments = (legacyAttachmentsResult as unknown as { rows: LegacyAttachment[] }).rows;

  let migratedQuotes = 0;
  let migratedItems = 0;
  let migratedDocs = 0;
  let skipped = 0;

  for (const legacy of legacyQuotes) {
    const { status, outcome } = mapStatus(legacy.status);
    const customerData = legacy.customer_data ?? {};
    const items = Array.isArray(legacy.items) ? legacy.items : [];

    const totalQty = items.reduce(
      (sum, entry) => sum + (entry.lines ?? []).reduce((s, l) => s + (l.quantity ?? 0), 0),
      0
    );
    const referenceSubtotal = Number(legacy.reference_subtotal ?? 0);
    const unitPrice = totalQty > 0 ? referenceSubtotal / totalQty : 0;
    const total = legacy.quoted_total ? Number(legacy.quoted_total) : referenceSubtotal;

    if (DRY_RUN) {
      console.log(`  [dry-run] ${legacy.code} → status=${status}/${outcome} items=${totalQty} total=${total}`);
      continue;
    }

    const inserted = await db
      .insert(quotes)
      .values({
        id: legacy.id,
        quoteNumber: legacy.code,
        status,
        outcome,
        channel: "CORPORATE",
        accountId: legacy.account_id,
        leadId: null,
        customerName: customerData.razonSocial ?? "Cliente sin nombre",
        customerIdNumber: customerData.ruc ?? null,
        customerContactName: customerData.contactName ?? null,
        customerEmail: customerData.email ?? null,
        customerPhone: customerData.phone ?? null,
        customerAddress: null,
        customerCity: customerData.city ?? null,
        taxPresetId: null,
        taxRate: "0",
        pricesIncludeTax: false,
        discountType: null,
        discountValue: "0",
        validityPresetId: null,
        validityDays: null,
        expiresAt: null,
        subtotal: round2(referenceSubtotal),
        totalDiscount: "0",
        totalTax: "0",
        total: round2(total),
        notes: legacy.internal_notes,
        pdfKey: null,
        pdfGeneratedAt: null,
        sentByEmailAt: null,
        publishedToPortalAt: null,
        createdBy: null,
        createdAt: new Date(legacy.created_at),
        updatedAt: new Date(legacy.updated_at),
      })
      .onConflictDoNothing({ target: quotes.id })
      .returning({ id: quotes.id });

    if (inserted.length === 0) {
      skipped++;
      continue;
    }
    migratedQuotes++;

    let sortOrder = 0;
    for (const entry of items) {
      for (const line of entry.lines ?? []) {
        const descriptionParts = [entry.setName ?? "Set"];
        if (line.size) descriptionParts.push(`Talla ${line.size}`);
        if (line.color) descriptionParts.push(line.color);

        await db.insert(quoteItems).values({
          quoteId: legacy.id,
          kind: "CATALOG",
          setId: entry.setId ?? null,
          size: line.size ?? null,
          color: line.color ?? null,
          description: descriptionParts.join(" — "),
          quantity: line.quantity ?? 1,
          suggestedUnitPrice: round2(unitPrice),
          unitPrice: round2(unitPrice),
          discountType: null,
          discountValue: "0",
          taxRateOverride: null,
          pricingBreakdown: null,
          sortOrder: sortOrder++,
        });
        migratedItems++;
      }
    }

    const attachmentsForQuote = legacyAttachments.filter((a) => a.quote_id === legacy.id);
    for (const att of attachmentsForQuote) {
      const insertedDoc = await db
        .insert(quoteDocuments)
        .values({
          id: att.id,
          quoteId: legacy.id,
          type: att.type,
          fileName: att.file_name,
          fileUrl: att.file_url,
          uploadedBy: att.uploaded_by,
          createdAt: new Date(att.created_at),
        })
        .onConflictDoNothing({ target: quoteDocuments.id })
        .returning({ id: quoteDocuments.id });
      if (insertedDoc.length > 0) migratedDocs++;
    }
  }

  console.log(`✅ Migradas ${migratedQuotes} cotizaciones (${skipped} ya existían), ${migratedItems} líneas, ${migratedDocs} documentos.`);

  if (DROP_LEGACY && !DRY_RUN) {
    console.log("🗑️  Eliminando tablas legacy (quote_status_history, quote_attachments, quote_requests)...");
    await db.execute(sql`DROP TABLE IF EXISTS quote_status_history`);
    await db.execute(sql`DROP TABLE IF EXISTS quote_attachments`);
    await db.execute(sql`DROP TABLE IF EXISTS quote_requests`);
    console.log("✅ Tablas legacy eliminadas.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Migración falló:", err);
    process.exit(1);
  });

// ─── Plantilla PDF de cotización ───
// Componente puro de @react-pdf/renderer — no se renderiza en el navegador, solo server-side
// vía `renderToBuffer` (ver `pdf.ts`). Recibe todos los datos ya resueltos (nada de fetch aquí).

import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { CompanySettingsForPdf } from "./pdf";

export interface QuotePdfQuote {
  quoteNumber: string | null;
  channel: string;
  customerName: string;
  customerIdNumber: string | null;
  customerContactName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  customerCity: string | null;
  taxRate: string | number;
  pricesIncludeTax: boolean;
  discountType: string | null;
  discountValue: string | number;
  subtotal: string | number;
  totalDiscount: string | number;
  totalTax: string | number;
  total: string | number;
  notes: string | null;
  createdAt: Date | string | null;
  expiresAt: Date | string | null;
}

export interface QuotePdfItem {
  description: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unitPrice: string | number;
  discountType: string | null;
  discountValue: string | number;
  taxRateOverride: string | number | null;
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#111111" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20, alignItems: "flex-start" },
  logo: { width: 90, height: 45, objectFit: "contain" },
  companyBlock: { textAlign: "right", fontSize: 8, color: "#444444" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  quoteMeta: { fontSize: 9, color: "#444444", marginBottom: 16 },
  sectionTitle: { fontSize: 10, fontWeight: 700, marginBottom: 4, marginTop: 12 },
  customerBox: { border: "1pt solid #E5E5E5", borderRadius: 4, padding: 8, marginBottom: 12 },
  table: { marginTop: 4 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#111111", color: "#FFFFFF", padding: 5 },
  tableRow: { flexDirection: "row", borderBottom: "0.5pt solid #E5E5E5", padding: 5 },
  colDesc: { flex: 3 },
  colSize: { flex: 1 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1, textAlign: "right" },
  colDiscount: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1, textAlign: "right" },
  totalsBox: { marginTop: 16, alignSelf: "flex-end", width: 220 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalsRowFinal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTop: "1pt solid #111111", marginTop: 4, fontWeight: 700, fontSize: 11 },
  notes: { marginTop: 16, fontSize: 8, color: "#444444" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#888888", textAlign: "center", borderTop: "0.5pt solid #E5E5E5", paddingTop: 6 },
});

function money(value: string | number): string {
  return `$${Number(value).toFixed(2)}`;
}

function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" });
}

function lineTotal(item: QuotePdfItem): number {
  const gross = item.quantity * Number(item.unitPrice);
  if (!item.discountType || !item.discountValue) return gross;
  const raw = item.discountType === "PERCENTAGE" ? gross * (Number(item.discountValue) / 100) : Number(item.discountValue);
  return Math.max(0, gross - Math.min(raw, gross));
}

export function QuotePdfDocument({
  quote,
  items,
  companySettings,
}: {
  quote: QuotePdfQuote;
  items: QuotePdfItem[];
  companySettings: CompanySettingsForPdf | null;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Cotización</Text>
            <Text style={styles.quoteMeta}>
              {quote.quoteNumber ?? "Borrador"} · Emitida {formatDate(quote.createdAt)}
              {quote.expiresAt ? ` · Vence ${formatDate(quote.expiresAt)}` : ""}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {companySettings?.logoUrl && <Image src={companySettings.logoUrl} style={styles.logo} />}
            <View style={styles.companyBlock}>
              <Text>{companySettings?.razonSocial || "Allmedic Uniforms"}</Text>
              {companySettings?.ruc && <Text>RUC: {companySettings.ruc}</Text>}
              {companySettings?.address && <Text>{companySettings.address}</Text>}
              {companySettings?.phones && <Text>{companySettings.phones}</Text>}
              {companySettings?.email && <Text>{companySettings.email}</Text>}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Datos del cliente</Text>
        <View style={styles.customerBox}>
          <Text>{quote.customerName}</Text>
          {quote.customerIdNumber && <Text>RUC/Cédula: {quote.customerIdNumber}</Text>}
          {quote.customerContactName && <Text>Contacto: {quote.customerContactName}</Text>}
          {quote.customerEmail && <Text>{quote.customerEmail}</Text>}
          {quote.customerPhone && <Text>{quote.customerPhone}</Text>}
          {(quote.customerAddress || quote.customerCity) && (
            <Text>{[quote.customerAddress, quote.customerCity].filter(Boolean).join(", ")}</Text>
          )}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colDesc}>Descripción</Text>
            <Text style={styles.colSize}>Talla/Color</Text>
            <Text style={styles.colQty}>Cant.</Text>
            <Text style={styles.colPrice}>P. Unit.</Text>
            <Text style={styles.colDiscount}>Desc.</Text>
            <Text style={styles.colTotal}>Importe</Text>
          </View>
          {items.map((item, i) => (
            <View style={styles.tableRow} key={i} wrap={false}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colSize}>{[item.size, item.color].filter(Boolean).join(" / ") || "—"}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{money(item.unitPrice)}</Text>
              <Text style={styles.colDiscount}>
                {item.discountType && Number(item.discountValue) > 0
                  ? item.discountType === "PERCENTAGE"
                    ? `${Number(item.discountValue)}%`
                    : money(item.discountValue)
                  : "—"}
              </Text>
              <Text style={styles.colTotal}>{money(lineTotal(item))}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text>Subtotal</Text>
            <Text>{money(quote.subtotal)}</Text>
          </View>
          {Number(quote.totalDiscount) > 0 && (
            <View style={styles.totalsRow}>
              <Text>Descuento</Text>
              <Text>-{money(quote.totalDiscount)}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text>
              Impuesto ({Number(quote.taxRate)}% {quote.pricesIncludeTax ? "incluido" : "adicional"})
            </Text>
            <Text>{money(quote.totalTax)}</Text>
          </View>
          <View style={styles.totalsRowFinal}>
            <Text>Total</Text>
            <Text>{money(quote.total)}</Text>
          </View>
        </View>

        {quote.notes && (
          <View style={styles.notes}>
            <Text style={styles.sectionTitle}>Notas</Text>
            <Text>{quote.notes}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>
            {[companySettings?.razonSocial, companySettings?.website, companySettings?.footerNote]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

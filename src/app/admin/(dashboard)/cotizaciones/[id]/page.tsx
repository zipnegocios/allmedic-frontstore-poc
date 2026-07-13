import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getQuoteById } from '@/lib/quotes/service';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { QuoteEditor, type QuoteEditorData } from '@/components/admin/quotes/QuoteEditor';
import { QuoteAttachmentUpload } from '@/components/admin/QuoteAttachmentUpload';
import { ArrowLeft, Download } from 'lucide-react';
import { db } from '@/db';
import { quoteDocuments } from '@/db/schema';
import { eq } from 'drizzle-orm';

const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  COTIZACION: 'Cotización',
  FACTURA: 'Factura',
  NOTA_ENTREGA: 'Nota de Entrega',
  OTRO: 'Otro',
};

interface QuoteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuoteDetailPage({ params }: QuoteDetailPageProps) {
  const { id } = await params;
  const quote = await getQuoteById(id);

  if (!quote) {
    notFound();
  }

  const documents = await db.select().from(quoteDocuments).where(eq(quoteDocuments.quoteId, id));

  const editorData: QuoteEditorData = {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status as 'DRAFT' | 'FINAL',
    outcome: quote.outcome as 'ACCEPTED' | 'REJECTED' | null,
    channel: quote.channel as 'CORPORATE' | 'RETAIL',
    accountId: quote.accountId,
    leadId: quote.leadId,
    customerName: quote.customerName,
    customerIdNumber: quote.customerIdNumber,
    customerContactName: quote.customerContactName,
    customerEmail: quote.customerEmail,
    customerPhone: quote.customerPhone,
    customerAddress: quote.customerAddress,
    customerCity: quote.customerCity,
    taxPresetId: quote.taxPresetId,
    taxRate: quote.taxRate,
    pricesIncludeTax: quote.pricesIncludeTax,
    discountType: quote.discountType as 'PERCENTAGE' | 'FIXED' | null,
    discountValue: quote.discountValue,
    validityPresetId: quote.validityPresetId,
    validityDays: quote.validityDays,
    expiresAt: quote.expiresAt ? quote.expiresAt.toISOString() : null,
    notes: quote.notes,
    pdfKey: quote.pdfKey,
    sentByEmailAt: quote.sentByEmailAt ? quote.sentByEmailAt.toISOString() : null,
    publishedToPortalAt: quote.publishedToPortalAt ? quote.publishedToPortalAt.toISOString() : null,
    items: quote.items.map((i) => ({
      id: i.id,
      kind: i.kind as 'CATALOG' | 'FREE',
      productId: i.productId,
      variantId: i.variantId,
      setId: i.setId,
      size: i.size,
      color: i.color,
      description: i.description,
      quantity: i.quantity,
      suggestedUnitPrice: i.suggestedUnitPrice != null ? Number(i.suggestedUnitPrice) : null,
      unitPrice: Number(i.unitPrice),
      discountType: i.discountType as 'PERCENTAGE' | 'FIXED' | null,
      discountValue: Number(i.discountValue),
      taxRateOverride: i.taxRateOverride != null ? Number(i.taxRateOverride) : null,
      pricingBreakdown: i.pricingBreakdown as never,
      sortOrder: i.sortOrder,
    })),
  };

  return (
    <div>
      <div className="px-8 pt-8">
        <Link href="/admin/cotizaciones">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al listado
          </Button>
        </Link>
      </div>

      <QuoteEditor initialQuote={editorData} />

      <div className="px-8 pb-8 max-w-5xl">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Adjuntos manuales</h3>
            <QuoteAttachmentUpload quoteId={quote.id} />
            {documents.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {documents.map((att) => (
                  <a
                    key={att.id}
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-[#E5E5E5] rounded-full hover:bg-[#F5F5F7] transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    {ATTACHMENT_TYPE_LABELS[att.type] || att.type}
                    {att.fileName && ` — ${att.fileName}`}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mt-4">Sin adjuntos manuales todavía.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAdminQuoteById } from '@/lib/admin-data-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QuoteEditPanel } from '@/components/admin/QuoteEditPanel';
import { QuoteAttachmentUpload } from '@/components/admin/QuoteAttachmentUpload';
import { ArrowLeft, Download } from 'lucide-react';

const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  COTIZACION: 'Cotización',
  FACTURA: 'Factura',
  NOTA_ENTREGA: 'Nota de Entrega',
  OTRO: 'Otro',
};

interface QuoteDetailPageProps {
  params: Promise<{ id: string }>;
}

interface QuoteLine {
  pieceSelections: Array<{ productId: string; size?: string; color?: string }>;
  quantity: number;
}

interface QuoteItem {
  setId: string;
  setName?: string;
  sizeMode: string;
  lines: QuoteLine[];
}

interface CustomerData {
  ruc: string;
  razonSocial: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  sector?: string;
}

export default async function QuoteDetailPage({ params }: QuoteDetailPageProps) {
  const { id } = await params;
  const quote = await getAdminQuoteById(id);

  if (!quote) {
    notFound();
  }

  const customerData = quote.customerData as unknown as CustomerData;
  const items = quote.items as unknown as QuoteItem[];

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/cotizaciones">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">{quote.code}</h1>
          <p className="text-sm text-gray-500">
            {new Date(quote.createdAt!).toLocaleString('es-EC')}
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">{quote.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardContent className="p-6 space-y-2">
            <h3 className="font-semibold mb-3">Datos del Cliente</h3>
            <p className="text-sm"><span className="text-gray-500">RUC:</span> {customerData.ruc}</p>
            <p className="text-sm"><span className="text-gray-500">Razón Social:</span> {customerData.razonSocial}</p>
            <p className="text-sm"><span className="text-gray-500">Contacto:</span> {customerData.contactName}</p>
            <p className="text-sm"><span className="text-gray-500">Correo:</span> {customerData.email}</p>
            <p className="text-sm"><span className="text-gray-500">Teléfono:</span> {customerData.phone}</p>
            <p className="text-sm"><span className="text-gray-500">Ciudad:</span> {customerData.city}</p>
            {customerData.sector && <p className="text-sm"><span className="text-gray-500">Sector:</span> {customerData.sector}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-2">
            <h3 className="font-semibold mb-3">Totales</h3>
            <p className="text-sm">
              <span className="text-gray-500">Subtotal referencial:</span>{' '}
              <span className="font-medium">${Number(quote.referenceSubtotal).toFixed(2)}</span>
            </p>
            {quote.quotedTotal && (
              <p className="text-sm">
                <span className="text-gray-500">Total cotizado:</span>{' '}
                <span className="font-medium">${Number(quote.quotedTotal).toFixed(2)}</span>
              </p>
            )}
            {quote.account && (
              <p className="text-sm text-gray-500 pt-2">
                Cuenta corporativa vinculada: {quote.account.razonSocial}
              </p>
            )}
            {quote.internalNotes && (
              <p className="text-sm text-gray-500 pt-2">Notas: {quote.internalNotes}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">Sets Solicitados</h3>
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={idx} className="border border-[#E5E5E5] rounded-lg p-4">
                <p className="font-medium mb-2">{item.setName || item.setId}</p>
                <div className="space-y-1">
                  {item.lines.map((line, lIdx) => (
                    <div key={lIdx} className="flex justify-between text-sm text-gray-600 bg-[#F5F5F7] rounded px-3 py-1.5">
                      <span>
                        {line.pieceSelections && line.pieceSelections.length > 0
                          ? line.pieceSelections
                              .map((p) => [p.size, p.color].filter(Boolean).join('/'))
                              .filter(Boolean)
                              .join(', ') || 'Set completo'
                          : 'Set completo'}
                      </span>
                      <span className="font-medium">{line.quantity} sets</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">Adjuntos</h3>
          <QuoteAttachmentUpload quoteId={quote.id} />
          {quote.attachments.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {quote.attachments.map((att) => (
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
            <p className="text-sm text-gray-500 mt-4">Sin adjuntos todavía.</p>
          )}
        </CardContent>
      </Card>

      <QuoteEditPanel
        quoteId={quote.id}
        currentStatus={quote.status}
        currentQuotedTotal={quote.quotedTotal}
        currentInternalNotes={quote.internalNotes}
        history={quote.history}
      />
    </div>
  );
}

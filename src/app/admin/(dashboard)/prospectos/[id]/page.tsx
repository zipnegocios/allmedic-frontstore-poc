import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAdminLeadById } from '@/lib/admin-data-service';
import { listQuotesByLeadId } from '@/lib/quotes/service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '@/lib/lead-status';
import { QUOTE_STATUS_LABELS, QUOTE_OUTCOME_LABELS } from '@/lib/quote-status';
import { CreateQuoteFromLeadButton } from '@/components/admin/quotes/CreateQuoteFromLeadButton';

interface LeadItem {
  name: string;
  size?: string;
  color?: unknown;
  quantity: number;
  price: number;
}

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getAdminLeadById(id);
  if (!lead) notFound();

  const quotes = await listQuotesByLeadId(id);
  const items = (lead.items as unknown as LeadItem[]) ?? [];

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/admin/prospectos">
        <Button variant="outline" size="sm" className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Pedidos
        </Button>
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">{lead.customerName}</h1>
          <p className="text-sm text-gray-500">{lead.customerCity} · {lead.customerPhone}</p>
        </div>
        <Badge className={LEAD_STATUS_COLORS[lead.status ?? ''] ?? ''}>
          {LEAD_STATUS_LABELS[lead.status ?? ''] ?? lead.status}
        </Badge>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="font-semibold mb-3">Pedido original</h2>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm bg-[#F5F5F7] rounded px-3 py-2">
                <span>{item.name} {item.size ? `— Talla ${item.size}` : ''}</span>
                <span>{item.quantity} × ${item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-3">Subtotal: ${Number(lead.subtotal).toFixed(2)} · Total: ${Number(lead.total).toFixed(2)}</p>
        </CardContent>
      </Card>

      <div className="mb-6">
        <CreateQuoteFromLeadButton leadId={id} disabled={lead.status === 'COTIZADO'} />
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold mb-3">Cotizaciones de este prospecto</h2>
          {quotes.length === 0 ? (
            <p className="text-sm text-gray-500">Aún no se ha creado ninguna cotización.</p>
          ) : (
            <div className="space-y-2">
              {quotes.map((q) => {
                const statusInfo = QUOTE_STATUS_LABELS[q.status] ?? { label: q.status, variant: 'secondary' as const };
                const outcomeInfo = q.outcome ? QUOTE_OUTCOME_LABELS[q.outcome] : null;
                return (
                  <Link
                    key={q.id}
                    href={`/admin/cotizaciones/${q.id}`}
                    className="flex justify-between items-center text-sm border rounded px-3 py-2 hover:bg-gray-50"
                  >
                    <span className="font-medium">{q.quoteNumber ?? 'Borrador'}</span>
                    <span>${Number(q.total).toFixed(2)}</span>
                    <Badge variant={outcomeInfo?.variant ?? statusInfo.variant}>{outcomeInfo?.label ?? statusInfo.label}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAdminCorporateAccountById } from '@/lib/admin-data-service';
import { listQuotesByAccountId } from '@/lib/quotes/service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { QUOTE_STATUS_LABELS, QUOTE_OUTCOME_LABELS } from '@/lib/quote-status';
import { CreateQuoteFromAccountButton } from '@/components/admin/quotes/CreateQuoteFromAccountButton';

const STATUS_LABELS: Record<string, { label: string; variant: 'outline' | 'secondary' | 'destructive' }> = {
  PENDING: { label: 'Pendiente', variant: 'secondary' },
  APPROVED: { label: 'Aprobada', variant: 'outline' },
  REJECTED: { label: 'Rechazada', variant: 'destructive' },
  SUSPENDED: { label: 'Suspendida', variant: 'destructive' },
};

export default async function CorporateAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getAdminCorporateAccountById(id);
  if (!account) notFound();

  const quotes = await listQuotesByAccountId(id);
  const statusInfo = STATUS_LABELS[account.status] ?? { label: account.status, variant: 'secondary' as const };

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <Link href="/admin/cuentas-corporativas">
        <Button variant="outline" size="sm" className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Cuentas Corporativas
        </Button>
      </Link>

      <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-[#111111] break-words">{account.razonSocial}</h1>
          <p className="text-sm text-gray-500">RUC {account.ruc} · {account.city}</p>
        </div>
        <Badge className="self-start" variant={statusInfo.variant}>{statusInfo.label}</Badge>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <p className="break-words"><span className="text-gray-500">Contacto:</span> {account.contactName}</p>
          <p className="break-words"><span className="text-gray-500">Correo:</span> {account.email}</p>
          <p className="break-words"><span className="text-gray-500">Teléfono:</span> {account.phone}</p>
          {account.sector && <p className="break-words"><span className="text-gray-500">Sector:</span> {account.sector}</p>}
        </CardContent>
      </Card>

      <div className="mb-6">
        {account.status === 'APPROVED' ? (
          <CreateQuoteFromAccountButton accountId={id} />
        ) : (
          <p className="text-sm text-gray-500">
            Solo se pueden crear cotizaciones para cuentas corporativas aprobadas.
          </p>
        )}
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold mb-3">Cotizaciones de esta cuenta</h2>
          {quotes.length === 0 ? (
            <p className="text-sm text-gray-500">Aún no se ha creado ninguna cotización.</p>
          ) : (
            <div className="space-y-2">
              {quotes.map((q) => {
                const info = QUOTE_STATUS_LABELS[q.status] ?? { label: q.status, variant: 'secondary' as const };
                const outcomeInfo = q.outcome ? QUOTE_OUTCOME_LABELS[q.outcome] : null;
                return (
                  <Link
                    key={q.id}
                    href={`/admin/cotizaciones/${q.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm border rounded px-3 py-2 hover:bg-gray-50"
                  >
                    <span className="font-medium">{q.quoteNumber ?? 'Borrador'}</span>
                    <span>${Number(q.total).toFixed(2)}</span>
                    <Badge variant={outcomeInfo?.variant ?? info.variant}>{outcomeInfo?.label ?? info.label}</Badge>
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

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getCorporateAccountByUserId, getQuotesByAccountId } from '@/lib/corporate-data-service';
import { Clock, XCircle, Ban, FileText, Download } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  FINAL: 'Definitiva',
};

const OUTCOME_LABELS: Record<string, string> = {
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
};

const ATTACHMENT_LABELS: Record<string, string> = {
  COTIZACION: 'Cotización',
  FACTURA: 'Factura',
  NOTA_ENTREGA: 'Nota de Entrega',
  OTRO: 'Documento',
};

export default async function MiCuentaPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/corporativo/login');
  }

  const userId = (session.user as { id?: string }).id;
  const account = userId ? await getCorporateAccountByUserId(userId) : null;

  if (!account) {
    return (
      <main className="pt-14 sm:pt-16 min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center py-16">
          <XCircle className="w-16 h-16 text-gray-300 mx-auto mb-6" strokeWidth={1.5} />
          <h1 className="text-2xl font-bold text-[#111111] mb-3">No encontramos una cuenta corporativa</h1>
          <p className="text-gray-500 mb-8">
            Esta cuenta no tiene un registro corporativo asociado.
          </p>
          <Link href="/corporativo/registro" className="px-6 py-3 bg-[#111111] text-white rounded-full font-medium">
            Registrar cuenta corporativa
          </Link>
        </div>
      </main>
    );
  }

  if (account.status === 'PENDING') {
    return (
      <main className="pt-14 sm:pt-16 min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center py-16">
          <Clock className="w-16 h-16 text-amber-500 mx-auto mb-6" strokeWidth={1.5} />
          <h1 className="text-2xl font-bold text-[#111111] mb-3">Cuenta en revisión</h1>
          <p className="text-gray-500">
            Tu cuenta corporativa está siendo revisada por nuestro equipo. Te notificaremos por correo cuando sea
            aprobada.
          </p>
        </div>
      </main>
    );
  }

  if (account.status === 'REJECTED' || account.status === 'SUSPENDED') {
    const isRejected = account.status === 'REJECTED';
    return (
      <main className="pt-14 sm:pt-16 min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center py-16">
          <Ban className="w-16 h-16 text-red-400 mx-auto mb-6" strokeWidth={1.5} />
          <h1 className="text-2xl font-bold text-[#111111] mb-3">
            {isRejected ? 'Cuenta no aprobada' : 'Cuenta suspendida'}
          </h1>
          <p className="text-gray-500">
            {isRejected
              ? 'Tu registro corporativo no fue aprobado. Contáctanos si crees que se trata de un error.'
              : 'Tu cuenta corporativa está temporalmente suspendida. Contáctanos para más información.'}
          </p>
        </div>
      </main>
    );
  }

  const quotes = await getQuotesByAccountId(account.id);

  return (
    <main className="pt-14 sm:pt-16 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] mb-2">Mi Cuenta Corporativa</h1>
        <p className="text-gray-500 mb-8">Bienvenido, {account.contactName}.</p>

        {/* Datos de la empresa */}
        <div className="border border-[#E5E5E5] rounded-lg p-6 mb-8">
          <h2 className="font-semibold mb-3">Datos de la Empresa</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <p><span className="text-gray-500">RUC:</span> {account.ruc}</p>
            <p><span className="text-gray-500">Razón Social:</span> {account.razonSocial}</p>
            <p><span className="text-gray-500">Correo:</span> {account.email}</p>
            <p><span className="text-gray-500">Teléfono:</span> {account.phone}</p>
            <p><span className="text-gray-500">Ciudad:</span> {account.city}</p>
            {account.sector && <p><span className="text-gray-500">Sector:</span> {account.sector}</p>}
          </div>
        </div>

        {/* Mis solicitudes */}
        <h2 className="font-semibold mb-4">Mis Solicitudes de Cotización</h2>
        {quotes.length === 0 ? (
          <div className="text-center py-16 text-gray-500 border border-[#E5E5E5] rounded-lg">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            Aún no tienes solicitudes de cotización.
            <div className="mt-4">
              <Link href="/corporativo" className="text-[#111111] font-medium hover:underline">
                Explorar catálogo corporativo
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {quotes.map((quote) => {
              const isExpired = !quote.outcome && !!quote.expiresAt && new Date(quote.expiresAt) < new Date();
              return (
              <div key={quote.id} className="border border-[#E5E5E5] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <code className="text-sm font-bold bg-gray-100 px-2 py-1 rounded">{quote.quoteNumber ?? 'Borrador'}</code>
                  <div className="flex gap-2">
                    {isExpired && (
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">Vencida</span>
                    )}
                    <span className="text-xs px-2 py-1 bg-[#F5F5F7] rounded-full font-medium">
                      {quote.outcome ? OUTCOME_LABELS[quote.outcome] : STATUS_LABELS[quote.status] || quote.status}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  {new Date(quote.createdAt!).toLocaleDateString('es-EC')} — Total: $
                  {Number(quote.total).toFixed(2)}
                </p>
                {quote.pdfKey && (
                  <a
                    href={`${process.env.R2_QUOTES_PUBLIC_URL ?? ''}/${quote.pdfKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-[#E5E5E5] rounded-full hover:bg-[#F5F5F7] transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Descargar cotización (PDF)
                  </a>
                )}
                {quote.attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {quote.attachments.map((att) => (
                      <a
                        key={att.id}
                        href={att.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-[#E5E5E5] rounded-full hover:bg-[#F5F5F7] transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        {ATTACHMENT_LABELS[att.type] || att.type}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

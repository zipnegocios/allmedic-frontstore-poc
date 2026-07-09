import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

interface ConfirmacionPageProps {
  searchParams: Promise<{ code?: string }>;
}

export default async function ConfirmacionPage({ searchParams }: ConfirmacionPageProps) {
  const { code } = await searchParams;

  return (
    <main className="pt-14 sm:pt-16 min-h-screen flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 text-center py-16">
        <CheckCircle2 className="w-16 h-16 text-[#34C759] mx-auto mb-6" strokeWidth={1.5} />
        <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] mb-3">¡Solicitud recibida!</h1>
        <p className="text-gray-500 mb-6">
          Tu código de solicitud es:
        </p>
        {code && (
          <div className="inline-block px-6 py-3 bg-[#F5F5F7] rounded-lg font-mono text-lg font-bold text-[#111111] mb-6">
            {code}
          </div>
        )}
        <p className="text-sm text-gray-500 mb-8">
          Nuestro equipo de ventas revisará tu solicitud y te contactará con la cotización formal a la brevedad.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/corporativo" className="px-6 py-3 bg-[#111111] text-white rounded-full font-medium hover:opacity-90 transition-opacity">
            Volver al catálogo corporativo
          </Link>
          <Link href="/" className="px-6 py-3 border border-[#E5E5E5] rounded-full font-medium hover:bg-[#F5F5F7] transition-colors">
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}

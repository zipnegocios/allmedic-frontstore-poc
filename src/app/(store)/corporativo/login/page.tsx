'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(urlError ? 'Credenciales inválidas' : null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Correo o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    router.push('/corporativo/mi-cuenta');
    router.refresh();
  }

  return (
    <main className="pt-14 sm:pt-16 min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-4 py-16">
        <Link href="/corporativo" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#111111] mb-6">
          <ChevronLeft className="w-4 h-4" /> Volver al catálogo
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] mb-2">Portal Corporativo</h1>
        <p className="text-gray-500 mb-8">Inicia sesión para ver tus solicitudes de cotización.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#111111] mb-1">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#111111] mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full px-6 py-3 text-white font-medium rounded-full transition-opacity',
              loading ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#111111] hover:opacity-90'
            )}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-sm text-gray-500 mt-6 text-center">
          ¿No tienes cuenta?{' '}
          <Link href="/corporativo/registro" className="text-[#111111] font-medium hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function CorporateLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

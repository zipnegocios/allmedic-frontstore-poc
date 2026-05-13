'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email: identifier,
      password,
      redirect: false,
      callbackUrl: '/admin',
    });

    setLoading(false);

    if (result?.error) {
      setError('Credenciales inválidas');
    } else if (result?.ok) {
      router.push('/admin');
      router.refresh();
    }
  }

  const displayError = error || (urlError === 'forbidden' ? 'Acceso denegado: permisos insuficientes' : '');

  return (
    <Card className="w-full max-w-md border-0 shadow-2xl">
      <CardHeader className="space-y-4 pb-6">
        <div className="flex justify-center">
          <Link href="/" className="block bg-[#111111] rounded-xl p-4 hover:opacity-90 transition-opacity">
            <Image
              src="/images/allmedic_logo_white.png"
              alt="AllMedic"
              width={160}
              height={48}
              className="h-12 w-auto"
              priority
            />
          </Link>
        </div>
        <div className="text-center space-y-1">
          <CardTitle className="text-2xl font-bold text-[#111111]">AllMedic Admin</CardTitle>
          <CardDescription>
            Ingresa tus credenciales para acceder al panel de administración
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {displayError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{displayError}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Usuario o Email</Label>
            <Input
              id="identifier"
              type="text"
              placeholder="Usuario o correo"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full bg-[#111111] hover:bg-[#333333]" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111111] px-4">
      <Suspense fallback={
        <Card className="w-full max-w-md border-0 shadow-2xl">
          <CardContent className="p-8">
            <div className="flex justify-center mb-4">
              <div className="bg-[#111111] rounded-xl p-4">
                <Image
                  src="/images/allmedic_logo_white.png"
                  alt="AllMedic"
                  width={160}
                  height={48}
                  className="h-12 w-auto"
                  priority
                />
              </div>
            </div>
            <p className="text-center text-gray-500">Cargando...</p>
          </CardContent>
        </Card>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}

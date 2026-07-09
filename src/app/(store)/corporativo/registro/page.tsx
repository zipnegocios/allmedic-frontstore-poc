'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SECTORS = ['Hospital', 'Clínica', 'Consultorio', 'Universidad', 'Farmacia', 'Otro'];

export default function RegistroPage() {
  const [form, setForm] = useState({
    ruc: '', razonSocial: '', contactName: '', email: '', phone: '', city: '', sector: '', password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const formValid =
    /^\d{13}$/.test(form.ruc) &&
    form.razonSocial.trim() &&
    form.contactName.trim() &&
    /\S+@\S+\.\S+/.test(form.email) &&
    form.phone.trim().length >= 7 &&
    form.city.trim() &&
    form.password.length >= 8;

  async function handleSubmit() {
    if (!formValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/corporate/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No pudimos procesar tu registro');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos procesar tu registro. Inténtalo nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="pt-14 sm:pt-16 min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center py-16">
          <CheckCircle2 className="w-16 h-16 text-[#34C759] mx-auto mb-6" strokeWidth={1.5} />
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] mb-3">Cuenta en revisión</h1>
          <p className="text-gray-500 mb-8">
            Recibimos tu solicitud de registro corporativo. Nuestro equipo revisará tus datos y te notificaremos
            por correo cuando tu cuenta sea aprobada.
          </p>
          <Link href="/corporativo" className="px-6 py-3 bg-[#111111] text-white rounded-full font-medium hover:opacity-90 transition-opacity">
            Volver al catálogo corporativo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-14 sm:pt-16 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/corporativo" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#111111] mb-6">
          <ChevronLeft className="w-4 h-4" /> Volver al catálogo
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] mb-2">Registro Corporativo</h1>
        <p className="text-gray-500 mb-8">
          Crea tu cuenta para acceder al portal de cliente y hacer seguimiento a tus cotizaciones. Tu cuenta
          quedará en revisión hasta que sea aprobada por nuestro equipo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[#111111] mb-1">RUC * (13 dígitos)</label>
            <input
              type="text"
              value={form.ruc}
              onChange={(e) => update('ruc', e.target.value.replace(/\D/g, ''))}
              maxLength={13}
              placeholder="1790012345001"
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111]"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[#111111] mb-1">Razón Social *</label>
            <input
              type="text"
              value={form.razonSocial}
              onChange={(e) => update('razonSocial', e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#111111] mb-1">Nombre de contacto *</label>
            <input
              type="text"
              value={form.contactName}
              onChange={(e) => update('contactName', e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#111111] mb-1">Correo *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#111111] mb-1">Teléfono *</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="+593 99 999 9999"
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#111111] mb-1">Ciudad *</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111]"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[#111111] mb-1">Sector / Institución</label>
            <select
              value={form.sector}
              onChange={(e) => update('sector', e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111]"
            >
              <option value="">Selecciona...</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[#111111] mb-1">Contraseña * (mínimo 8 caracteres)</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111]"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!formValid || submitting}
          className={cn(
            'w-full px-6 py-3 text-white font-medium rounded-full transition-opacity',
            !formValid || submitting ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#111111] hover:opacity-90'
          )}
        >
          {submitting ? 'Enviando...' : 'Registrar cuenta corporativa'}
        </button>

        <p className="text-sm text-gray-500 mt-4 text-center">
          ¿Ya tienes cuenta?{' '}
          <Link href="/corporativo/login" className="text-[#111111] font-medium hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}

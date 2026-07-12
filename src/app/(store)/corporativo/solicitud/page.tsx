'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { useCorporateCart } from '@/context/CorporateCartContext';
import { cn } from '@/lib/utils';

const SECTORS = ['Hospital', 'Clínica', 'Consultorio', 'Universidad', 'Farmacia', 'Otro'];

export default function SolicitudPage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const { items, validation, pricing, clearCart } = useCorporateCart();
  const [form, setForm] = useState({
    ruc: '', razonSocial: '', contactName: '', email: '', phone: '', city: '', sector: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prellena los datos si el cliente corporativo ya tiene sesión iniciada y cuenta aprobada.
  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    fetch('/api/corporate/account/me')
      .then((res) => res.json())
      .then((data: { account?: typeof form | null }) => {
        if (data.account) {
          setForm((prev) => ({ ...prev, ...data.account }));
        }
      })
      .catch(() => {});
  }, [sessionStatus]);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const formValid =
    form.ruc.trim().length >= 10 &&
    form.razonSocial.trim() &&
    form.contactName.trim() &&
    /\S+@\S+\.\S+/.test(form.email) &&
    form.phone.trim().length >= 7 &&
    form.city.trim();

  async function handleSubmit() {
    if (!formValid || !validation.canSubmit || items.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/corporate/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerData: form,
          cart: {
            items: items.map((i) => ({
              setId: i.setId,
              setName: i.setName,
              sizeMode: i.sizeMode,
              lines: i.lines.map((l) => ({
                size: l.size,
                color: l.color,
                pieceSelections: l.pieceSelections,
                quantity: l.quantity,
              })),
            })),
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No pudimos procesar tu solicitud');
      }

      const data = await res.json();
      clearCart();
      router.push(`/corporativo/confirmacion?code=${encodeURIComponent(data.code)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos procesar tu solicitud. Inténtalo nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <main className="pt-14 sm:pt-16 min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-gray-500 mb-4">Tu carrito corporativo está vacío.</p>
          <Link href="/corporativo" className="px-6 py-3 bg-[#111111] text-white rounded-full font-medium">
            Explorar catálogo corporativo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-14 sm:pt-16 min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/corporativo" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#111111] mb-6">
          <ChevronLeft className="w-4 h-4" /> Volver al catálogo
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] mb-2">Solicitar Cotización</h1>
        <p className="text-gray-500 mb-8">
          Completa tus datos y nuestro equipo de ventas te enviará una cotización formal.
        </p>

        {!validation.canSubmit && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 mb-6">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              {validation.violations.map((v, idx) => (
                <p key={idx}>{v.message}</p>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[#111111] mb-1">RUC *</label>
            <input
              type="text"
              value={form.ruc}
              onChange={(e) => update('ruc', e.target.value)}
              placeholder="1234567890001"
              maxLength={13}
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111]"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[#111111] mb-1">Razón Social *</label>
            <input
              type="text"
              value={form.razonSocial}
              onChange={(e) => update('razonSocial', e.target.value)}
              placeholder="Ej: Hospital Metropolitano S.A."
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
        </div>

        {/* Resumen */}
        <div className="rounded-lg bg-[#F5F5F7] p-4 mb-6 space-y-2">
          <h3 className="font-semibold text-sm mb-2">Resumen de tu solicitud</h3>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{validation.countUnit === 'PIECES' ? 'Piezas totales' : 'Sets totales'}</span>
            <span className="font-medium">{validation.totalSets}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal referencial</span>
            <span className="font-medium">${pricing.subtotalBeforeDiscount.toFixed(2)}</span>
          </div>
          {pricing.volumeDiscountPct > 0 && (
            <div className="flex justify-between text-sm text-[#34C759]">
              <span>Escala de volumen ({pricing.volumeDiscountPct}%)</span>
              <span>-${pricing.volumeDiscountAmount.toFixed(2)}</span>
            </div>
          )}
          {pricing.promoDiscountAmount > 0 && (
            <div className="flex justify-between text-sm text-[#34C759]">
              <span>Descuento por promoción</span>
              <span>-${pricing.promoDiscountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold pt-2 border-t border-[#E5E5E5]">
            <span>Total referencial</span>
            <span>${pricing.total.toFixed(2)}</span>
          </div>
          <p className="text-xs text-gray-400 pt-1">
            Precio referencial — sujeto a cotización formal por nuestro equipo de ventas.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!formValid || !validation.canSubmit || submitting}
          className={cn(
            'w-full px-6 py-3 text-white font-medium rounded-full transition-opacity',
            !formValid || !validation.canSubmit || submitting
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-[#111111] hover:opacity-90'
          )}
        >
          {submitting ? 'Enviando...' : 'Enviar solicitud de cotización'}
        </button>
      </div>
    </main>
  );
}

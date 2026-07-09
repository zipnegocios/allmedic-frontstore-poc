'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, ShoppingBag } from 'lucide-react';

const ALTERNATING_TEXTS = ['Ventas al Mayor', 'Compras Corporativas'];
const INTERVAL_MS = 7000; // entre 5–10s per el plan

export function CorporateCTA() {
  const [textIndex, setTextIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Con prefers-reduced-motion, alternamos el texto sin animación de fade,
    // en un intervalo más largo para minimizar el movimiento en pantalla.
    if (prefersReducedMotion) {
      const timer = setInterval(() => {
        setTextIndex((prev) => (prev + 1) % ALTERNATING_TEXTS.length);
      }, INTERVAL_MS);
      return () => clearInterval(timer);
    }

    const timer = setInterval(() => {
      setFade(false);
      const switchTimeout = setTimeout(() => {
        setTextIndex((prev) => (prev + 1) % ALTERNATING_TEXTS.length);
        setFade(true);
      }, 300);
      return () => clearTimeout(switchTimeout);
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-16 bg-[#F5F5F7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Catálogo Individual */}
          <Link
            href="/catalogo"
            className="group relative overflow-hidden rounded-2xl bg-white border border-[#E5E5E5] p-8 sm:p-10 flex flex-col justify-between min-h-[220px] hover:shadow-lg transition-shadow"
          >
            <div>
              <ShoppingBag className="w-8 h-8 text-[#111111] mb-4" strokeWidth={1.5} />
              <h3 className="text-2xl font-bold text-[#111111] mb-2">Compra Individual</h3>
              <p className="text-[#666666]">
                Explora nuestro catálogo completo de uniformes médicos premium.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-[#111111] group-hover:gap-3 transition-all">
              Ver catálogo
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </span>
          </Link>

          {/* Catálogo Corporativo — CTA con texto alternante */}
          <Link
            href="/corporativo"
            className="group relative overflow-hidden rounded-2xl bg-[#111111] p-8 sm:p-10 flex flex-col justify-between min-h-[220px] hover:shadow-lg transition-shadow"
          >
            <div>
              <Building2 className="w-8 h-8 text-white mb-4" strokeWidth={1.5} />
              <h3
                aria-live="polite"
                className={`text-2xl font-bold text-white mb-2 transition-opacity duration-300 motion-reduce:transition-none ${
                  fade ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {ALTERNATING_TEXTS[textIndex]}
                <span className="sr-only"> — Ventas al Mayor y Compras Corporativas</span>
              </h3>
              <p className="text-white/70">
                Cotizaciones especiales, sets de uniformes y precios preferenciales para instituciones.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-white group-hover:gap-3 transition-all">
              Ir al catálogo corporativo
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

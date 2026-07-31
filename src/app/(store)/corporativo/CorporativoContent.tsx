'use client';

import { Building2 } from 'lucide-react';
import type { CorporateSetSummary } from '@/lib/corporate-types';
import type { BusinessRule } from '@/lib/rules-engine';
import { SetCatalogGrid } from '@/components/catalog/SetCatalogGrid';

interface CorporativoContentProps {
  sets: CorporateSetSummary[];
  /** Solo las reglas PRICE_VISIBILITY — se resuelven por set en el cliente (loop en memoria). */
  priceVisibilityRules: BusinessRule[];
  minQuantity: number;
}

export function CorporativoContent({ sets, priceVisibilityRules, minQuantity }: CorporativoContentProps) {
  return (
    <main className="pt-14 sm:pt-16 min-h-screen">
      {/* Header */}
      <section className="bg-[#111111] py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-3">
            <Building2 className="w-4 h-4" strokeWidth={1.5} />
            <span>Ventas al Mayor / Compras Corporativas</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Catálogo Corporativo</h1>
          <p className="text-white/70 max-w-2xl">
            Sets de uniformes para instituciones, hospitales y clínicas. Precios referenciales sujetos a
            cotización formal. Compra mínima: <strong>{minQuantity} sets</strong>.
          </p>
        </div>
      </section>

      <SetCatalogGrid sets={sets} priceVisibilityRules={priceVisibilityRules} minQuantity={minQuantity} />
    </main>
  );
}

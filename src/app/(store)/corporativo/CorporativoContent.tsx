'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Building2, Star, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CorporateSetSummary, SetGroupSummary } from '@/lib/corporate-types';
import { resolveRules, type BusinessRule } from '@/lib/rules-engine';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import type { MediaItem } from '@/lib/media';

function coverImageItem(imageUrl: string | null): MediaItem | undefined {
  if (!imageUrl) return undefined;
  return { url: imageUrl, type: 'image', mimeType: 'image/jpeg', width: null, height: null };
}

interface CorporativoContentProps {
  sets: CorporateSetSummary[];
  groups: SetGroupSummary[];
  /** Solo las reglas PRICE_VISIBILITY — se resuelven por set en el cliente (loop en memoria). */
  priceVisibilityRules: BusinessRule[];
  minQuantity: number;
}

export function CorporativoContent({ sets, groups, priceVisibilityRules, minQuantity }: CorporativoContentProps) {
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<string | null>(null);

  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const s of sets) if (s.brandName) set.add(s.brandName);
    return Array.from(set).sort();
  }, [sets]);

  const filteredSets = useMemo(() => {
    return sets.filter((s) => {
      if (groupFilter && s.groupSlug !== groupFilter) return false;
      if (brandFilter && s.brandName !== brandFilter) return false;
      return true;
    });
  }, [sets, groupFilter, brandFilter]);

  const showPricesFor = useCallback(
    (set: CorporateSetSummary): boolean => {
      const resolved = resolveRules(priceVisibilityRules, {
        setId: set.id,
        setGroupId: set.setGroupId,
        brandId: set.brandId,
        productIds: set.productIds,
      });
      return (
        resolved.priceVisibility.showPrices &&
        (resolved.priceVisibility.catalog === 'CORPORATE' || resolved.priceVisibility.catalog === 'BOTH')
      );
    },
    [priceVisibilityRules]
  );

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

      {/* Filtros */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setGroupFilter(null)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-colors',
              !groupFilter ? 'bg-[#111111] text-white' : 'bg-[#F5F5F7] text-[#333333] hover:bg-gray-200'
            )}
          >
            Todos los grupos
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setGroupFilter(g.slug === groupFilter ? null : g.slug)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                groupFilter === g.slug ? 'bg-[#111111] text-white' : 'bg-[#F5F5F7] text-[#333333] hover:bg-gray-200'
              )}
            >
              {g.name}
            </button>
          ))}
        </div>

        {brands.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => setBrandFilter(null)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                !brandFilter ? 'border-[#111111] text-[#111111]' : 'border-gray-300 text-gray-500 hover:border-gray-400'
              )}
            >
              Todas las marcas
            </button>
            {brands.map((b) => (
              <button
                key={b}
                onClick={() => setBrandFilter(b === brandFilter ? null : b)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  brandFilter === b ? 'border-[#111111] text-[#111111]' : 'border-gray-300 text-gray-500 hover:border-gray-400'
                )}
              >
                {b}
              </button>
            ))}
          </div>
        )}

        {/* Grid de sets */}
        {filteredSets.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            No hay sets corporativos disponibles con estos filtros.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSets.map((set) => (
              <Link
                key={set.id}
                href={`/corporativo/s/${set.slug}`}
                className="group border border-[#E5E5E5] rounded-xl overflow-hidden hover:shadow-lg transition-shadow bg-white"
              >
                <div className="relative aspect-[4/5] bg-[#F5F5F7] overflow-hidden">
                  {set.imageUrl ? (
                    <MediaGridThumb
                      item={coverImageItem(set.imageUrl)}
                      fallback="/images/placeholder-product.jpg"
                      alt={set.name}
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="400px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Building2 className="w-12 h-12" strokeWidth={1} />
                    </div>
                  )}
                  {set.isFeatured && (
                    <span className="absolute top-3 left-3 flex items-center gap-1 bg-white/90 text-xs font-medium px-2 py-1 rounded-full">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      Destacado
                    </span>
                  )}
                </div>
                <div className="p-4">
                  {set.brandName && <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{set.brandName}</p>}
                  <h3 className="font-semibold text-[#111111] mb-1">{set.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    {set.pieceCount} {set.pieceCount === 1 ? 'pieza' : 'piezas'}
                    {set.groupName && ` · ${set.groupName}`}
                  </p>
                  {showPricesFor(set) && (
                    set.referencePrice !== null ? (
                      <div>
                        <span className="text-lg font-bold text-[#111111]">${set.referencePrice.toFixed(2)}</span>
                        <span className="text-xs text-gray-400 ml-1">/ set referencial</span>
                        {set.hasMissingPrices && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                            <AlertTriangle className="w-3 h-3" /> Precio parcial
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Precio bajo cotización</span>
                    )
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Star, AlertTriangle } from 'lucide-react';
import type { CorporateSetSummary } from '@/lib/corporate-types';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import { ColorFallbackBadge } from '@/components/catalog/ColorFallbackBadge';
import { ColorSwatch } from '@/components/catalog/ColorSwatch';
import { LiquidFillLoader } from '@/components/ui/LiquidFillLoader';
import { resolveCardCover } from '@/lib/resolve-card-cover';

interface SetGridCardProps {
  set: CorporateSetSummary;
  activeColorId: string | null;
  showPrices: boolean;
}

/** Card del grid — extraída para poder trackear `isImageLoading` (barra líquida) por set
 * individual mientras se descarga la portada del color recién filtrado, sin violar las reglas
 * de hooks (no se puede usar `useState` dentro del `.map()` del padre). */
export function SetGridCard({ set, activeColorId, showPrices }: SetGridCardProps) {
  // Color elegido al clickear un swatch dentro de esta card. Si el filtro lateral
  // (prop activeColorId) cambia, debe primar sobre la selección local — mismo patrón
  // "durante el render" que ProductCard.tsx (sin useEffect, evita el render en cascada
  // de un setState síncrono dentro de un efecto).
  const [localColorId, setLocalColorId] = useState<string | null>(activeColorId);
  const [trackedFilterColor, setTrackedFilterColor] = useState(activeColorId);
  if (activeColorId !== trackedFilterColor) {
    setTrackedFilterColor(activeColorId);
    setLocalColorId(activeColorId);
  }

  const effectiveColorId = localColorId;
  const { cover, secondaryCover, isFallback } = resolveCardCover(set, effectiveColorId);
  const fallbackColor = isFallback ? set.pairedColors.find((c) => c.id === effectiveColorId) : undefined;

  // Reinicio "durante el render" (sin useEffect) al cambiar la URL de portada — mismo patrón
  // que SetListItem.tsx, evita el render en cascada de un setState síncrono dentro de un efecto.
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [trackedCoverUrl, setTrackedCoverUrl] = useState(cover?.url);
  if (cover?.url !== trackedCoverUrl) {
    setTrackedCoverUrl(cover?.url);
    setIsImageLoading(true);
  }

  return (
    <Link
      href={`/corporativo/s/${set.slug}`}
      className="group border border-[#E5E5E5] rounded-xl overflow-hidden hover:shadow-lg transition-shadow bg-white"
    >
      <div className="relative aspect-product bg-[#F5F5F7] overflow-hidden">
        {cover ? (
          <>
            {isImageLoading && cover.type !== 'video' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#F5F5F7] z-[2] px-8">
                <LiquidFillLoader />
              </div>
            )}
            <MediaGridThumb
              item={cover}
              fallback="/images/placeholder-product.jpg"
              alt={set.name}
              fit="cover"
              className={`object-cover transition-opacity duration-300 ${secondaryCover ? 'group-hover:opacity-0' : 'group-hover:scale-105 transition-transform duration-500'} ${isImageLoading ? 'opacity-0' : ''}`}
              sizes="400px"
              onLoad={() => setIsImageLoading(false)}
              onError={() => setIsImageLoading(false)}
            />
            {secondaryCover && (
              <MediaGridThumb
                item={secondaryCover}
                fallback="/images/placeholder-product.jpg"
                alt={set.name}
                fit="cover"
                className="absolute inset-0 object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                sizes="400px"
              />
            )}
          </>
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
        {fallbackColor && (
          <ColorFallbackBadge colorHex={fallbackColor.hex} colorName={fallbackColor.name} />
        )}
      </div>
      <div className="p-4">
        {set.brandName && (
          <p className="font-sans text-body-sm uppercase tracking-badge text-gray-400 mb-1">{set.brandName}</p>
        )}
        <h3 className="font-sans text-body-md font-normal text-[#111111] mb-1">{set.name}</h3>
        <p className="font-sans text-body-sm text-gray-500 mb-3">
          {set.pieceCount} {set.pieceCount === 1 ? 'pieza' : 'piezas'}
        </p>
        {showPrices &&
          (set.referencePrice !== null ? (
            <div>
              <span className="font-sans text-body-md font-medium text-[#111111]">${set.referencePrice.toFixed(2)}</span>
              <span className="font-sans text-body-xs text-gray-400 ml-1">/ set referencial</span>
              {set.hasMissingPrices && (
                <span className="flex items-center gap-1 font-sans text-body-xs text-amber-600 mt-1">
                  <AlertTriangle className="w-3 h-3" /> Precio parcial
                </span>
              )}
            </div>
          ) : (
            <span className="font-sans text-body-sm text-gray-400">Precio bajo cotización</span>
          ))}
        {set.pairedColors.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {set.pairedColors.slice(0, 5).map(color => (
              <div
                key={color.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLocalColorId(color.id);
                }}
              >
                <ColorSwatch color={color} size="sm" isSelected={effectiveColorId === color.id} />
              </div>
            ))}
            {set.pairedColors.length > 5 && (
              <span className="font-sans text-body-xs text-gray-400 flex items-center">
                +{set.pairedColors.length - 5}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, AlertTriangle } from 'lucide-react';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import { ColorFallbackBadge } from '@/components/catalog/ColorFallbackBadge';
import { ColorSwatch } from '@/components/catalog/ColorSwatch';
import { LiquidFillLoader } from '@/components/ui/LiquidFillLoader';
import type { CorporateSetSummary } from '@/lib/corporate-types';
import { resolveCardCover } from '@/lib/resolve-card-cover';

interface SetListItemProps {
  set: CorporateSetSummary;
  showPrices: boolean;
  /** Color actualmente filtrado (selección única) — determina qué portada mostrar, ver
   * `resolveCardCover`. `null`/ausente = sin filtro, se usa el color por defecto del set. */
  activeColorId?: string | null;
}

export function SetListItem({ set, showPrices, activeColorId = null }: SetListItemProps) {
  // Color elegido al clickear un swatch dentro de esta card. Si el filtro lateral
  // (prop activeColorId) cambia, debe primar sobre la selección local — mismo patrón
  // "durante el render" que ProductCard.tsx (sin useEffect).
  const [localColorId, setLocalColorId] = useState<string | null>(activeColorId);
  const [trackedFilterColor, setTrackedFilterColor] = useState(activeColorId);
  if (activeColorId !== trackedFilterColor) {
    setTrackedFilterColor(activeColorId);
    setLocalColorId(activeColorId);
  }

  const effectiveColorId = localColorId;
  const { cover, secondaryCover, isFallback } = resolveCardCover(set, effectiveColorId);
  const fallbackColor = isFallback ? set.colors.find((c) => c.id === effectiveColorId) : undefined;

  // Barra líquida mientras se descarga la portada del color recién filtrado — reinicio "durante
  // el render" (patrón oficial de React para resetear estado en respuesta a un cambio de prop,
  // sin useEffect: https://react.dev/learn/you-might-not-need-an-effect), no dispara el render
  // en cascada extra que sí dispara un setState síncrono dentro de un efecto.
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [trackedCoverUrl, setTrackedCoverUrl] = useState(cover?.url);
  if (cover?.url !== trackedCoverUrl) {
    setTrackedCoverUrl(cover?.url);
    setIsImageLoading(true);
  }

  return (
    <Link
      href={`/corporativo/s/${set.slug}`}
      className="group flex gap-4 p-4 bg-white border border-[#E5E5E5] rounded-xl hover:border-[#111111] hover:shadow-md transition-all duration-300"
    >
      <div className="relative flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 bg-[#F5F5F7] rounded-lg overflow-hidden">
        {cover ? (
          <>
            {isImageLoading && cover.type !== 'video' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#F5F5F7] z-[2] px-3">
                <LiquidFillLoader />
              </div>
            )}
            <MediaGridThumb
              item={cover}
              fallback="/images/placeholder-product.jpg"
              alt={set.name}
              sizes="128px"
              className={`object-cover transition-opacity duration-300 ${secondaryCover ? 'group-hover:opacity-0' : 'group-hover:scale-105 transition-transform duration-500'} ${isImageLoading ? 'opacity-0' : ''}`}
              onLoad={() => setIsImageLoading(false)}
              onError={() => setIsImageLoading(false)}
            />
            {secondaryCover && (
              <MediaGridThumb
                item={secondaryCover}
                fallback="/images/placeholder-product.jpg"
                alt={set.name}
                sizes="128px"
                className="absolute inset-0 object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Building2 className="w-8 h-8" strokeWidth={1} />
          </div>
        )}
        {fallbackColor && <ColorFallbackBadge colorHex={fallbackColor.hex} colorName={fallbackColor.name} />}
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1">
          {set.brandName && (
            <p className="font-sans text-body-sm uppercase tracking-badge text-gray-400 mb-1">{set.brandName}</p>
          )}
          <h3 className="font-sans text-body-md font-normal text-[#111111] mb-1 group-hover:underline line-clamp-2">
            {set.name}
          </h3>
          <p className="font-sans text-body-sm text-gray-500">
            {set.pieceCount} {set.pieceCount === 1 ? 'pieza' : 'piezas'}
          </p>
          {set.colors.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {set.colors.slice(0, 5).map(color => (
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
              {set.colors.length > 5 && (
                <span className="font-sans text-body-xs text-gray-400 flex items-center">
                  +{set.colors.length - 5}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3">
          {showPrices ? (
            set.referencePrice !== null ? (
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
            )
          ) : (
            <span />
          )}

          <span className="px-4 py-2 bg-[#111111] text-white text-sm font-medium rounded-full group-hover:opacity-80 transition-opacity">
            Ver set
          </span>
        </div>
      </div>
    </Link>
  );
}

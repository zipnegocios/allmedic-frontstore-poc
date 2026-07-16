import Link from 'next/link';
import { Building2, AlertTriangle } from 'lucide-react';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import type { CorporateSetSummary } from '@/lib/corporate-types';
import type { MediaItem } from '@/lib/media';

export function coverImageItem(imageUrl: string | null): MediaItem | undefined {
  if (!imageUrl) return undefined;
  return { url: imageUrl, type: 'image', mimeType: 'image/jpeg', width: null, height: null };
}

interface SetListItemProps {
  set: CorporateSetSummary;
  showPrices: boolean;
}

export function SetListItem({ set, showPrices }: SetListItemProps) {
  return (
    <Link
      href={`/corporativo/s/${set.slug}`}
      className="group flex gap-4 p-4 bg-white border border-[#E5E5E5] rounded-xl hover:border-[#111111] hover:shadow-md transition-all duration-300"
    >
      <div className="relative flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 bg-[#F5F5F7] rounded-lg overflow-hidden">
        {set.imageUrl ? (
          <MediaGridThumb
            item={coverImageItem(set.imageUrl)}
            fallback="/images/placeholder-product.jpg"
            alt={set.name}
            sizes="128px"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Building2 className="w-8 h-8" strokeWidth={1} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1">
          {set.brandName && <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{set.brandName}</p>}
          <h3 className="text-base sm:text-lg font-semibold text-[#111111] mb-1 group-hover:underline line-clamp-2">
            {set.name}
          </h3>
          <p className="text-sm text-gray-500">
            {set.pieceCount} {set.pieceCount === 1 ? 'pieza' : 'piezas'}
            {set.groupName && ` · ${set.groupName}`}
          </p>
        </div>

        <div className="flex items-center justify-between mt-3">
          {showPrices ? (
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

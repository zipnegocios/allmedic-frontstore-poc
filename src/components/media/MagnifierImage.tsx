'use client';

import { useRef, useState } from 'react';
import { Minus, Plus, X, ZoomIn } from 'lucide-react';
import { MediaGridThumb } from './MediaGridThumb';
import { useMagnifier, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '@/hooks/useMagnifier';
import cloudflareImageLoader from '@/lib/cloudflare-image-loader';
import type { MediaItem } from '@/lib/media';

const LENS_SOURCE_WIDTH = 1600;

export interface MagnifierImageProps {
  item: MediaItem | undefined;
  fallback: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/** Envuelve MediaGridThumb agregando una lupa de magnificación activable por click/tap.
 * Sin cambios de comportamiento cuando el item es video, no cargó aún, o no hay imagen real —
 * en esos casos se comporta exactamente igual que MediaGridThumb solo. */
export function MagnifierImage({ item, fallback, alt, className, onLoad, onError }: MagnifierImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const magnifier = useMagnifier(containerRef);

  const isImage = item?.type === 'image';
  const isRealImage = isImage && item.url !== fallback;
  const canMagnify = isRealImage && isLoaded;

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoaded(false);
    onError?.();
  };

  const lensUrl = canMagnify ? cloudflareImageLoader({ src: item.url, width: LENS_SOURCE_WIDTH }) : undefined;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      {...(canMagnify ? magnifier.containerHandlers : {})}
    >
      <MediaGridThumb
        item={item}
        fallback={fallback}
        alt={alt}
        fit="contain"
        className={className}
        onLoad={handleLoad}
        onError={handleError}
      />

      {canMagnify && !magnifier.isActive && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            magnifier.toggle();
          }}
          className="absolute top-3 right-3 z-10 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
          aria-label="Activar lupa"
        >
          <ZoomIn className="w-4 h-4 text-[#111111]" strokeWidth={1.5} />
        </button>
      )}

      {canMagnify && magnifier.isActive && lensUrl && (
        <>
          <div
            className="absolute inset-0 z-20 cursor-zoom-out"
            style={{
              backgroundImage: `url(${lensUrl})`,
              backgroundSize: `${magnifier.zoomLevel * 100}%`,
              backgroundPosition: `${magnifier.origin.x * 100}% ${magnifier.origin.y * 100}%`,
              backgroundRepeat: 'no-repeat',
            }}
          />

          <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
            <button
              type="button"
              onClick={() => magnifier.setZoom(magnifier.zoomLevel - ZOOM_STEP)}
              disabled={magnifier.zoomLevel <= ZOOM_MIN}
              className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors disabled:opacity-30"
              aria-label="Disminuir zoom"
            >
              <Minus className="w-4 h-4 text-[#111111]" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => magnifier.setZoom(magnifier.zoomLevel + ZOOM_STEP)}
              disabled={magnifier.zoomLevel >= ZOOM_MAX}
              className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors disabled:opacity-30"
              aria-label="Aumentar zoom"
            >
              <Plus className="w-4 h-4 text-[#111111]" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={magnifier.deactivate}
              className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
              aria-label="Cerrar lupa"
            >
              <X className="w-4 h-4 text-[#111111]" strokeWidth={1.5} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

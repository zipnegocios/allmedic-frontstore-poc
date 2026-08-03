'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { GalleryRail } from './GalleryRail';
import { MagnifierLens, LENS_DIAMETER_PX } from '@/components/media/MagnifierLens';
import { useMagnifierLens, LENS_ZOOM_MIN, LENS_ZOOM_MAX, LENS_ZOOM_STEP } from '@/hooks/useMagnifierLens';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import { LiquidFillLoader } from '@/components/ui/LiquidFillLoader';
import cloudflareImageLoader from '@/lib/cloudflare-image-loader';
import { cn } from '@/lib/utils';
import type { SetPiece } from '@/lib/corporate-types';
import type { MediaItem } from '@/lib/media';

const LENS_SOURCE_WIDTH = 1600;
const FALLBACK_IMAGE = '/images/placeholder-product.jpg';

/** Rect (en px CSS) que ocupa la imagen dentro de un contenedor `object-contain` — mismo cálculo
 * que hace el navegador para el `<img>` real, necesario para que el `backgroundSize` de la lente
 * use la proporción natural de la foto en vez de estirarla al cuadrado de la lente. */
function containRect(containerW: number, containerH: number, naturalW: number, naturalH: number) {
  const containerAspect = containerW / containerH;
  const naturalAspect = naturalW / naturalH;
  if (naturalAspect > containerAspect) {
    const w = containerW;
    return { w, h: w / naturalAspect };
  }
  const h = containerH;
  return { w: h * naturalAspect, h };
}

export interface LightboxProps {
  pieceA: SetPiece;
  pieceB: SetPiece;
  imagesA: MediaItem[];
  imagesB: MediaItem[];
  focusedImage: MediaItem | undefined;
  focus: { side: 'A' | 'B'; index: number };
  setFocus: (f: { side: 'A' | 'B'; index: number }) => void;
  offsetA: number;
  setOffsetA: (updater: (o: number) => number) => void;
  offsetB: number;
  setOffsetB: (updater: (o: number) => number) => void;
  isOpen: boolean;
  onClose: () => void;
}

/** Lightbox modal del Gallery de sets: réplica a pantalla completa de los dos carriles + imagen
 * central, con lente circular de magnificación (hover en desktop, press-and-hold en touch) sobre
 * la imagen central. Comparte el mismo estado de foco/offset que el Gallery inline — cambiar de
 * imagen aquí adentro deja esa misma imagen enfocada al cerrar. */
export function Lightbox({
  pieceA,
  pieceB,
  imagesA,
  imagesB,
  focusedImage,
  focus,
  setFocus,
  offsetA,
  setOffsetA,
  offsetB,
  setOffsetB,
  isOpen,
  onClose,
}: LightboxProps) {
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [trackedFocusedUrl, setTrackedFocusedUrl] = useState(focusedImage?.url);
  const lens = useMagnifierLens(imageContainerRef);

  if (focusedImage?.url !== trackedFocusedUrl) {
    setTrackedFocusedUrl(focusedImage?.url);
    setIsImageLoading(true);
  }

  const currentImages = focus.side === 'A' ? imagesA : imagesB;

  // Escape cierra, flechas navegan el carril del lado enfocado, bloquea el scroll del body y
  // mueve el foco al botón de cerrar — no hay forma de hacer esto durante el render (a
  // diferencia del resto del archivo, que deriva todo sin useEffect), por eso es el único
  // useEffect de este módulo.
  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft') {
        setFocus({ side: focus.side, index: Math.max(0, focus.index - 1) });
        return;
      }
      if (e.key === 'ArrowRight') {
        const max = currentImages.length - 1;
        setFocus({ side: focus.side, index: Math.min(max, focus.index + 1) });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, focus.side, focus.index, currentImages.length]);

  // Precarga la imagen de la lupa (1600px) apenas se enfoca — en paralelo con la miniatura
  // visible, no recién al pasar el mouse. Antes, el fetch de este recurso (aparte del que ya
  // se ve en pantalla) solo arrancaba al activar la lente, así que cada hover — y cada cambio
  // de imagen — esperaba una descarga completa antes de poder mostrar el aumento.
  useEffect(() => {
    if (!isOpen || !focusedImage) return;
    const isReal = focusedImage.type === 'image' && focusedImage.url !== FALLBACK_IMAGE;
    if (!isReal) return;
    const preloadUrl = cloudflareImageLoader({ src: focusedImage.url, width: LENS_SOURCE_WIDTH });
    const img = new window.Image();
    img.src = preloadUrl;
  }, [isOpen, focusedImage]);

  if (!isOpen) return null;

  const isRealImage = focusedImage?.type === 'image' && focusedImage.url !== FALLBACK_IMAGE;
  const canMagnify = isRealImage && !isImageLoading;
  const lensUrl = canMagnify ? cloudflareImageLoader({ src: focusedImage.url, width: LENS_SOURCE_WIDTH }) : undefined;

  const rect = imageContainerRef.current?.getBoundingClientRect();
  const effectiveDiameter = rect ? Math.min(LENS_DIAMETER_PX, rect.width, rect.height) : LENS_DIAMETER_PX;
  const radius = effectiveDiameter / 2;
  const centerX = rect ? Math.min(Math.max(lens.origin.x * rect.width, radius), rect.width - radius) : 0;
  const centerY = rect ? Math.min(Math.max(lens.origin.y * rect.height, radius), rect.height - radius) : 0;

  // Tamaño "1x" (proporción natural) sobre el que se aplica el zoom — ver doc en
  // `MagnifierLens.sourceWidth/Height`. Sin `width`/`height` naturales (dato legacy), cae al
  // tamaño del contenedor completo (comportamiento previo, sin distorsión si el contenedor
  // fuera cuadrado, pero es la única base disponible).
  const renderedSize =
    rect && isRealImage && focusedImage.width && focusedImage.height
      ? containRect(rect.width, rect.height, focusedImage.width, focusedImage.height)
      : { w: rect?.width ?? 0, h: rect?.height ?? 0 };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Vista ampliada de imagen"
      onClick={onClose}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Cerrar vista ampliada"
        className="absolute top-4 right-4 z-10 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
      >
        <X className="w-4 h-4 text-[#111111]" strokeWidth={1.5} />
      </button>

      <div
        className="h-full flex flex-col sm:flex-row items-center justify-center gap-3 p-3 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <GalleryRail images={imagesA} side="A" focusSide={focus.side} focusIndex={focus.index} onFocus={setFocus} offset={offsetA} setOffset={setOffsetA} />

        {/* En mobile ocupa el ancho completo del viewport (sin los rieles laterales achicándola)
            y se estira en alto vía `flex-1` dentro de la columna; en `sm:`+ vuelve al layout
            original (rieles a los costados, ancho acotado a `max-w-3xl`). */}
        <div className="relative w-full flex-1 sm:max-w-3xl h-full sm:max-h-[80vh]">
          <div
            ref={imageContainerRef}
            className="relative w-full h-full bg-[#F5F5F7] rounded-xl overflow-hidden"
            {...(canMagnify ? lens.imageHandlers : {})}
          >
            {isImageLoading && focusedImage?.type !== 'video' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#F5F5F7] z-[2] px-10">
                <LiquidFillLoader />
              </div>
            )}
            <MediaGridThumb
              item={focusedImage}
              fallback={FALLBACK_IMAGE}
              alt={focus.side === 'A' ? pieceA.productName : pieceB.productName}
              fit="contain"
              className={cn('object-contain transition-opacity duration-200', isImageLoading && 'opacity-0')}
              onLoad={() => setIsImageLoading(false)}
              onError={() => setIsImageLoading(false)}
            />

            {canMagnify && lens.isActive && lensUrl && (
              <MagnifierLens
                centerX={centerX}
                centerY={centerY}
                originX={lens.origin.x}
                originY={lens.origin.y}
                zoomLevel={lens.zoomLevel}
                lensUrl={lensUrl}
                diameter={effectiveDiameter}
                sourceWidth={renderedSize.w}
                sourceHeight={renderedSize.h}
              />
            )}
          </div>

          {canMagnify && (
            <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
              <button
                type="button"
                onClick={() => lens.setZoom(lens.zoomLevel - LENS_ZOOM_STEP)}
                disabled={lens.zoomLevel <= LENS_ZOOM_MIN}
                aria-label="Disminuir zoom"
                className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors disabled:opacity-30"
              >
                <Minus className="w-4 h-4 text-[#111111]" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => lens.setZoom(lens.zoomLevel + LENS_ZOOM_STEP)}
                disabled={lens.zoomLevel >= LENS_ZOOM_MAX}
                aria-label="Aumentar zoom"
                className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors disabled:opacity-30"
              >
                <Plus className="w-4 h-4 text-[#111111]" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>

        <GalleryRail images={imagesB} side="B" focusSide={focus.side} focusIndex={focus.index} onFocus={setFocus} offset={offsetB} setOffset={setOffsetB} />
      </div>
    </div>
  );
}

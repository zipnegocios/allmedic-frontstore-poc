'use client';

import Image from 'next/image';
import { VideoPreviewThumb } from './VideoPreviewThumb';
import type { MediaItem } from '@/lib/media';

interface MediaGridThumbProps {
  item: MediaItem | undefined;
  fallback: string;
  alt: string;
  className?: string;
  sizes?: string;
  /** Fit del elemento: aplica a video vía VideoPreviewThumb; para imágenes el fit va en `className`. */
  fit?: 'cover' | 'contain';
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Miniatura para tarjetas/grillas (catálogo, búsqueda, mega-menú, cross-sell): siempre una
 * representación estática — si el item es video, se reproduce mudo en loop dentro de su
 * ventana de vista previa; nunca el video completo (eso es solo en la vista expandida).
 */
export function MediaGridThumb({ item, fallback, alt, className, sizes = '400px', fit = 'cover', onLoad, onError }: MediaGridThumbProps) {
  if (!item) {
    return <Image src={fallback} alt={alt} fill sizes={sizes} className={className} onLoad={onLoad} onError={onError} />;
  }

  if (item.type === 'video') {
    return (
      <VideoPreviewThumb
        url={item.url}
        start={item.previewStartSeconds ?? 0}
        duration={item.previewDurationSeconds ?? 3}
        fit={fit}
        className={className}
      />
    );
  }

  return (
    <Image src={item.url} alt={alt} fill sizes={sizes} className={className} onLoad={onLoad} onError={onError} />
  );
}

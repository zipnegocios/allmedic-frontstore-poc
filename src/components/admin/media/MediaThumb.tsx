'use client';

import Image from 'next/image';
import { resolveMediaUrl, isVideoMime } from '@/lib/media';
import { VideoPreviewThumb } from '@/components/media/VideoPreviewThumb';
import { cn } from '@/lib/utils';

interface MediaThumbProps {
  storageKey?: string;
  url?: string; // alternativa a storageKey cuando ya se tiene la URL resuelta
  mimeType: string;
  altText?: string | null;
  previewStart?: number | null;
  previewDuration?: number | null;
  className?: string;
  sizes?: string;
  /** `cover` (default, recorta para llenar el contenedor) o `contain` (encoge la
   * imagen/video completo dentro del contenedor sin recortar — usado en la galería
   * de edición por color, donde se necesita ver la prenda completa). */
  fit?: 'cover' | 'contain';
}

/** Miniatura consciente de tipo de medio: video (loop mudo en su ventana de preview) o imagen. */
export function MediaThumb({ storageKey, url: urlProp, mimeType, altText, previewStart, previewDuration, className, sizes = '200px', fit = 'cover' }: MediaThumbProps) {
  const url = urlProp ?? resolveMediaUrl(storageKey ?? '');

  if (isVideoMime(mimeType)) {
    return (
      <VideoPreviewThumb
        url={url}
        start={previewStart ?? 0}
        duration={previewDuration ?? 3}
        fit={fit}
        className={className}
      />
    );
  }

  return (
    <Image
      src={url}
      alt={altText ?? ''}
      fill
      sizes={sizes}
      className={cn(fit === 'contain' ? 'object-contain' : 'object-cover', className)}
    />
  );
}

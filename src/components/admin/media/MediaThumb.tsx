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
}

/** Miniatura consciente de tipo de medio: video (loop mudo en su ventana de preview) o imagen. */
export function MediaThumb({ storageKey, url: urlProp, mimeType, altText, previewStart, previewDuration, className, sizes = '200px' }: MediaThumbProps) {
  const url = urlProp ?? resolveMediaUrl(storageKey ?? '');

  if (isVideoMime(mimeType)) {
    return (
      <VideoPreviewThumb
        url={url}
        start={previewStart ?? 0}
        duration={previewDuration ?? 3}
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
      className={cn('object-cover', className)}
    />
  );
}

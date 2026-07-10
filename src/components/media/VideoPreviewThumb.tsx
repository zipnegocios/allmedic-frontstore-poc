'use client';

import { useRef } from 'react';
import { useInViewAutoplay } from '@/hooks/useInViewAutoplay';
import { cn } from '@/lib/utils';

interface VideoPreviewThumbProps {
  url: string;
  start?: number;
  duration?: number;
  className?: string;
}

/**
 * Miniatura de video para tarjetas/grillas: muted, en loop, dentro de una ventana
 * [start, start+duration] del archivo original (no recorta el archivo, solo la reproducción).
 * Solo reproduce mientras está visible en el viewport (useInViewAutoplay).
 */
export function VideoPreviewThumb({ url, start = 0, duration = 3, className }: VideoPreviewThumbProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useInViewAutoplay(videoRef);

  return (
    <video
      ref={videoRef}
      src={url}
      muted
      loop={false}
      playsInline
      preload="metadata"
      className={cn('absolute inset-0 w-full h-full object-cover', className)}
      onLoadedMetadata={(e) => {
        e.currentTarget.currentTime = start;
      }}
      onTimeUpdate={(e) => {
        const video = e.currentTarget;
        if (video.currentTime >= start + duration) {
          video.currentTime = start;
        }
      }}
    />
  );
}

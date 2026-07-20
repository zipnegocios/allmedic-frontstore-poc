'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import type { MediaItem } from '@/lib/media';

const PLACEHOLDER = '/images/placeholder-product.jpg';
const PLACEHOLDER_ITEM: MediaItem = { url: PLACEHOLDER, type: 'image', mimeType: 'image/jpeg', width: null, height: null };

interface ImageGalleryProps {
  images: MediaItem[];
  productName: string;
  brandLogo?: string;
}

export function ImageGallery({ images, productName, brandLogo }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [mainSrcError, setMainSrcError] = useState(false);
  const [brandLogoError, setBrandLogoError] = useState(false);

  const displayImages = images.length > 0 ? images : [PLACEHOLDER_ITEM];
  const activeItem = displayImages[selectedIndex];
  const isActiveVideo = activeItem.type === 'video';

  const handleImageChange = (index: number) => {
    if (index === selectedIndex) return;
    setIsImageLoading(true);
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedIndex(index);
      setMainSrcError(false);
      setIsTransitioning(false);
    }, 150);
  };

  const handlePrev = () => {
    const newIndex = selectedIndex === 0 ? displayImages.length - 1 : selectedIndex - 1;
    handleImageChange(newIndex);
  };

  const handleNext = () => {
    const newIndex = selectedIndex === displayImages.length - 1 ? 0 : selectedIndex + 1;
    handleImageChange(newIndex);
  };

  return (
    <div className="space-y-4">
      {/* Main viewer */}
      <div className="relative aspect-product bg-[#F5F5F7] overflow-hidden rounded-lg">
        {/* Loading Spinner */}
        {isImageLoading && !isActiveVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#F5F5F7] z-10">
            <Loader2 className="w-10 h-10 text-gray-400 animate-spin" strokeWidth={1.5} />
          </div>
        )}

        {isActiveVideo ? (
          // Vista expandida: reproducción completa con sonido disponible (controles nativos), pausado por defecto.
          <video
            key={activeItem.url}
            src={activeItem.url}
            controls
            playsInline
            className="absolute inset-0 w-full h-full object-contain bg-black"
          />
        ) : (
          <Image
            src={mainSrcError ? PLACEHOLDER : activeItem.url}
            alt={`${productName} - Imagen ${selectedIndex + 1}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            priority={selectedIndex === 0}
            className={cn(
              'object-contain transition-opacity duration-300',
              isTransitioning ? 'opacity-0' : 'opacity-100',
              isImageLoading && 'opacity-0'
            )}
            onLoad={() => setIsImageLoading(false)}
            onError={() => {
              setIsImageLoading(false);
              setMainSrcError(true);
            }}
          />
        )}

        {/* Navigation Arrows (Mobile) */}
        {displayImages.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors md:hidden"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors md:hidden"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </>
        )}

        {/* Image Counter (Mobile) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/70 text-white text-xs rounded-full md:hidden">
          {selectedIndex + 1} / {displayImages.length}
        </div>
      </div>

      {/* Thumbnails — siempre estáticas (video en loop mudo dentro de su ventana de preview) */}
      {displayImages.length > 1 && (
        <div className="hidden md:flex gap-2 overflow-x-auto pb-2">
          {displayImages.slice(0, 4).map((item, index) => (
            <button
              key={index}
              onClick={() => handleImageChange(index)}
              className={cn(
                'relative flex-shrink-0 w-20 h-20 bg-[#F5F5F7] rounded-lg overflow-hidden border-2 transition-all duration-200',
                selectedIndex === index
                  ? 'border-[#111111]'
                  : 'border-transparent hover:border-gray-300'
              )}
            >
              <MediaGridThumb
                item={item}
                fallback={PLACEHOLDER}
                alt={`${productName} - Miniatura ${index + 1}`}
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Dots Indicator (Mobile) */}
      <div className="flex justify-center gap-2 md:hidden">
        {displayImages.map((_, index) => (
          <button
            key={index}
            onClick={() => handleImageChange(index)}
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-200',
              selectedIndex === index ? 'bg-[#111111] w-4' : 'bg-gray-300'
            )}
          />
        ))}
      </div>

      {/* Brand Logo - Desktop Only */}
      {brandLogo && !brandLogoError && (
        <div className="hidden md:flex justify-center pt-4 border-t border-[#E5E5E5]">
          <div className="relative h-8 w-32 opacity-60 hover:opacity-100 transition-opacity">
            <Image
              src={brandLogo}
              alt="Brand Logo"
              fill
              sizes="128px"
              className="object-contain"
              onError={() => setBrandLogoError(true)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageGalleryProps {
  images: string[];
  productName: string;
}

export function ImageGallery({ images, productName }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const displayImages = images.length > 0 ? images : ['/images/placeholder-product.jpg'];

  const handleImageChange = (index: number) => {
    if (index === selectedIndex) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedIndex(index);
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
      {/* Main Image */}
      <div className="relative aspect-[4/5] bg-[#F5F5F7] overflow-hidden rounded-lg">
        <img
          src={displayImages[selectedIndex]}
          alt={`${productName} - Imagen ${selectedIndex + 1}`}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isTransitioning ? 'opacity-0' : 'opacity-100'
          )}
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/images/placeholder-product.jpg';
          }}
        />

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

      {/* Thumbnails */}
      {displayImages.length > 1 && (
        <div className="hidden md:flex gap-2 overflow-x-auto pb-2">
          {displayImages.slice(0, 4).map((image, index) => (
            <button
              key={index}
              onClick={() => handleImageChange(index)}
              className={cn(
                'flex-shrink-0 w-20 h-20 bg-[#F5F5F7] rounded-lg overflow-hidden border-2 transition-all duration-200',
                selectedIndex === index
                  ? 'border-[#111111]'
                  : 'border-transparent hover:border-gray-300'
              )}
            >
              <img
                src={image}
                alt={`${productName} - Miniatura ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/placeholder-product.jpg';
                }}
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
    </div>
  );
}

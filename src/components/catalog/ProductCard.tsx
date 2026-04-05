import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import type { Product } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { CountdownBadge } from '@/components/ui/CountdownBadge';
import { QuickViewModal } from './QuickViewModal';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [selectedColorId, setSelectedColorId] = useState(product.colors[0]?.id);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  
  const variantWithColor = product.variants.find(v => v.colorId === selectedColorId);
  const displayImage = variantWithColor?.images[0] || '/images/placeholder-product.jpg';
  
  const hasDiscount = product.priceSale && product.priceSale < product.priceNormal;
  const discountPercentage = hasDiscount
    ? Math.round(((product.priceNormal - product.priceSale!) / product.priceNormal) * 100)
    : 0;
  
  // Check if product has an active countdown offer
  const hasActiveCountdown = product.discountEnd && new Date(product.discountEnd) > new Date();

  return (
    <>
      <div className="group bg-white">
        {/* Image Container */}
        <div className="relative aspect-[4/5] bg-[#F5F5F7] overflow-hidden">
          <Link to={`/p/${product.slug}`} className="block w-full h-full">
            {/* Badges */}
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
              {product.isNew && <Badge>Nuevo</Badge>}
              {product.isBestSeller && <Badge variant="secondary">Best Seller</Badge>}
              {hasDiscount && !hasActiveCountdown && <Badge variant="destructive">-{discountPercentage}%</Badge>}
            </div>

            {/* Countdown Timer - Bottom of image */}
            {hasActiveCountdown && product.discountEnd && (
              <div className="absolute bottom-3 left-3 right-3 z-10 flex justify-center">
                <CountdownBadge 
                  endDate={product.discountEnd} 
                  size="sm" 
                  variant="urgent"
                />
              </div>
            )}

            {/* Image */}
            <img
              src={displayImage}
              alt={product.name}
              className={cn(
                "w-full h-full object-cover transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                hasActiveCountdown && "group-hover:scale-105 group-hover:brightness-95"
              )}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/placeholder-product.jpg';
              }}
            />
            
            {/* Urgency overlay gradient */}
            {hasActiveCountdown && (
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
            )}
          </Link>

          {/* Quick View Button - Appears on hover */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsQuickViewOpen(true);
            }}
            className={cn(
              "absolute bottom-3 right-3 z-20",
              "flex items-center gap-2 px-3 py-2",
              "bg-white/95 backdrop-blur-sm text-[#111111]",
              "rounded-full text-sm font-medium",
              "shadow-lg hover:bg-white",
              "transition-all duration-300",
              "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0",
              "focus:opacity-100 focus:translate-y-0"
            )}
          >
            <Eye className="w-4 h-4" strokeWidth={1.5} />
            <span className="hidden sm:inline">Vista rápida</span>
          </button>
        </div>

        {/* Info */}
        <div className="pt-4">
          {/* Brand */}
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">
            {product.brand}
          </p>

          {/* Name */}
          <Link to={`/p/${product.slug}`}>
            <h3 className="text-sm font-medium text-[#111111] mb-2 line-clamp-2 group-hover:underline">
              {product.name}
            </h3>
          </Link>

          {/* Price */}
          <div className="flex items-center gap-2 mb-3">
            {hasDiscount ? (
              <>
                <span className="text-sm font-bold text-[#111111]">
                  ${product.priceSale?.toFixed(2)}
                </span>
                <span className="text-sm text-gray-400 line-through">
                  ${product.priceNormal.toFixed(2)}
                </span>
              </>
            ) : (
              <span className="text-sm font-bold text-[#111111]">
                ${product.priceNormal.toFixed(2)}
              </span>
            )}
          </div>

          {/* Color Swatches */}
          {product.colors.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {product.colors.slice(0, 5).map(color => (
                <button
                  key={color.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedColorId(color.id);
                  }}
                  className={cn(
                    'w-4 h-4 rounded-full border transition-all duration-200',
                    selectedColorId === color.id
                      ? 'ring-1 ring-offset-1 ring-[#111111] border-transparent'
                      : 'border-gray-200 hover:border-[#111111]',
                    color.hex === '#FFFFFF' && 'border-gray-300'
                  )}
                  style={{ backgroundColor: color.hex }}
                  aria-label={`Color ${color.name}`}
                />
              ))}
              {product.colors.length > 5 && (
                <span className="text-xs text-gray-400 flex items-center">
                  +{product.colors.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick View Modal */}
      <QuickViewModal
        product={product}
        isOpen={isQuickViewOpen}
        onClose={() => setIsQuickViewOpen(false)}
      />
    </>
  );
}

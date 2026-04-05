import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { Product, Size } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CrossSellCardProps {
  product: Product;
  selectedColorId: string;
  onColorChange: (colorId: string) => void;
  onAdd: (size: Size) => void;
}

export function CrossSellCard({
  product,
  selectedColorId,
  onColorChange,
  onAdd,
}: CrossSellCardProps) {
  const [selectedSize, setSelectedSize] = useState<Size | undefined>();
  const [showSizeSelector, setShowSizeSelector] = useState(false);

  const variantWithColor = product.variants.find(v => v.colorId === selectedColorId);
  const displayImage = variantWithColor?.images[0] || '/images/placeholder-product.jpg';

  const handleAddClick = () => {
    if (!showSizeSelector) {
      setShowSizeSelector(true);
      return;
    }
    if (selectedSize) {
      onAdd(selectedSize);
      setShowSizeSelector(false);
      setSelectedSize(undefined);
    }
  };

  return (
    <div className="border border-[#E5E5E5] rounded-lg p-4">
      <div className="flex gap-4">
        {/* Image */}
        <Link
          to={`/p/${product.slug}`}
          className="w-20 h-24 bg-[#F5F5F7] rounded-md overflow-hidden flex-shrink-0"
        >
          <img
            src={displayImage}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/placeholder-product.jpg';
            }}
          />
        </Link>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-widest text-gray-400">{product.brand}</p>
          <Link to={`/p/${product.slug}`}>
            <h4 className="text-sm font-medium text-[#111111] truncate hover:underline">
              {product.name}
            </h4>
          </Link>
          <p className="text-sm font-bold text-[#111111] mt-1">
            ${(product.priceSale || product.priceNormal).toFixed(2)}
          </p>

          {/* Color Swatches */}
          <div className="flex flex-wrap gap-1 mt-2">
            {product.colors.slice(0, 4).map(color => (
              <button
                key={color.id}
                onClick={() => onColorChange(color.id)}
                className={cn(
                  'w-5 h-5 rounded-full border transition-all duration-200',
                  selectedColorId === color.id
                    ? 'ring-1 ring-offset-1 ring-[#111111]'
                    : 'border-gray-200 hover:border-[#111111]',
                  color.hex === '#FFFFFF' && 'border-gray-300'
                )}
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Size Selector (when showing) */}
      {showSizeSelector && (
        <div className="mt-3 pt-3 border-t border-[#E5E5E5]">
          <p className="text-xs text-gray-500 mb-2">Selecciona tu talla:</p>
          <div className="flex flex-wrap gap-2">
            {product.availableSizes.map(size => {
              const variant = product.variants.find(
                v => v.colorId === selectedColorId && v.size === size
              );
              const isAvailable = variant?.status !== 'OUT_OF_STOCK';
              
              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  disabled={!isAvailable}
                  className={cn(
                    'min-w-[36px] h-8 px-2 text-xs font-medium rounded transition-all duration-200',
                    selectedSize === size
                      ? 'bg-[#111111] text-white'
                      : isAvailable
                      ? 'border border-gray-200 text-[#333333] hover:border-[#111111]'
                      : 'border border-gray-100 text-gray-300 cursor-not-allowed line-through'
                  )}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Button */}
      <button
        onClick={handleAddClick}
        disabled={showSizeSelector && !selectedSize}
        className={cn(
          'w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-all duration-200',
          showSizeSelector && !selectedSize
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white'
        )}
      >
        <Plus className="w-4 h-4" strokeWidth={1.5} />
        {showSizeSelector ? 'Confirmar' : 'Agregar también'}
      </button>
    </div>
  );
}

import type { Product, ProductColor, Size, Fit, VariantStatus } from '@/lib/types';
import { ColorSwatchGroup } from '@/components/catalog/ColorSwatch';
import { SizeSelector, FitSelector } from '@/components/catalog/SizeSelector';
import { cn } from '@/lib/utils';

interface VariantSelectorProps {
  product: Product;
  selectedColor: ProductColor;
  selectedSize?: Size;
  selectedFit?: Fit;
  onColorSelect: (color: ProductColor) => void;
  onSizeSelect: (size: Size) => void;
  onFitSelect?: (fit: Fit) => void;
}

export function VariantSelector({
  product,
  selectedColor,
  selectedSize,
  selectedFit,
  onColorSelect,
  onSizeSelect,
  onFitSelect,
}: VariantSelectorProps) {
  // Get variants for selected color
  const colorVariants = product.variants.filter(v => v.colorId === selectedColor.id);
  
  // Get available sizes for selected color
  const availableSizesForColor = [...new Set(colorVariants.map(v => v.size))];
  
  // Get size statuses
  const sizeStatuses: Record<Size, VariantStatus> = {} as Record<Size, VariantStatus>;
  availableSizesForColor.forEach(size => {
    const variant = colorVariants.find(v => v.size === size);
    if (variant) {
      sizeStatuses[size] = variant.status;
    }
  });



  // Get availability status
  const getAvailabilityStatus = () => {
    if (!selectedSize) return null;
    const variant = colorVariants.find(v => v.size === selectedSize && (!selectedFit || v.fit === selectedFit));
    return variant?.status;
  };

  const availabilityStatus = getAvailabilityStatus();

  const statusConfig = {
    AVAILABLE: {
      dot: 'bg-[#34C759]',
      text: 'Disponible',
      textColor: 'text-[#34C759]',
    },
    BACKORDER: {
      dot: 'bg-[#FF9500]',
      text: 'Bajo Pedido: llega en 7-10 días',
      textColor: 'text-[#FF9500]',
    },
    OUT_OF_STOCK: {
      dot: 'bg-[#FF3B30]',
      text: 'Agotado',
      textColor: 'text-[#FF3B30]',
    },
  };

  return (
    <div className="space-y-6">
      {/* Color Selector */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[#111111]">
            Color: <span className="text-gray-500">{selectedColor.name}</span>
          </h3>
        </div>
        <ColorSwatchGroup
          colors={product.colors}
          selectedColorId={selectedColor.id}
          onColorSelect={onColorSelect}
          size="lg"
        />
      </div>

      {/* Fit Selector (if applicable) */}
      {product.availableFits && product.availableFits.length > 0 && onFitSelect && (
        <div>
          <h3 className="text-sm font-medium text-[#111111] mb-3">
            Corte: <span className="text-gray-500">{selectedFit || 'Seleccionar'}</span>
          </h3>
          <FitSelector
            fits={product.availableFits}
            selectedFit={selectedFit}
            onFitSelect={(fit) => onFitSelect?.(fit as Fit)}
          />
        </div>
      )}

      {/* Size Selector */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[#111111]">
            Talla: <span className="text-gray-500">{selectedSize || 'Seleccionar'}</span>
          </h3>
          <button className="text-sm text-gray-500 underline hover:text-[#111111] transition-colors">
            Guía de tallas
          </button>
        </div>
        <SizeSelector
          sizes={product.availableSizes}
          selectedSize={selectedSize}
          sizeStatuses={sizeStatuses}
          onSizeSelect={onSizeSelect}
        />
      </div>

      {/* Availability Status */}
      {availabilityStatus && (
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', statusConfig[availabilityStatus].dot)} />
          <span className={cn('text-sm', statusConfig[availabilityStatus].textColor)}>
            {statusConfig[availabilityStatus].text}
          </span>
        </div>
      )}
    </div>
  );
}

import type { Size, VariantStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SizeSelectorProps {
  sizes: Size[];
  selectedSize?: Size;
  sizeStatuses?: Record<Size, VariantStatus>;
  onSizeSelect: (size: Size) => void;
}

const statusLabels: Record<VariantStatus, string> = {
  AVAILABLE: 'Disponible',
  BACKORDER: 'Bajo Pedido: llega en 7-10 días',
  OUT_OF_STOCK: 'Agotado',
};

const statusColors: Record<VariantStatus, string> = {
  AVAILABLE: 'bg-[#34C759]',
  BACKORDER: 'bg-[#FF9500]',
  OUT_OF_STOCK: 'bg-[#FF3B30]',
};

export function SizeSelector({
  sizes,
  selectedSize,
  sizeStatuses,
  onSizeSelect,
}: SizeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {sizes.map(size => {
        const status = sizeStatuses?.[size];
        const isAvailable = status !== 'OUT_OF_STOCK';
        const isSelected = selectedSize === size;
        const isBackorder = status === 'BACKORDER';

        return (
          <div key={size} className="relative group">
            <button
              onClick={() => isAvailable && onSizeSelect(size)}
              disabled={!isAvailable}
              className={cn(
                'min-w-[48px] h-10 px-3 text-sm font-medium rounded transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                isSelected
                  ? 'bg-[#111111] text-white'
                  : isAvailable
                  ? 'border border-[#E5E5E5] text-[#111111] hover:border-[#111111] bg-white'
                  : 'border border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed',
                isBackorder && !isSelected && 'border-[#FF9500]'
              )}
            >
              <span className={cn(!isAvailable && 'line-through')}>{size}</span>
            </button>

            {/* Tooltip */}
            {status && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#111111] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 flex items-center gap-1">
                <span className={cn('w-1.5 h-1.5 rounded-full', statusColors[status])} />
                {statusLabels[status]}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface FitSelectorProps {
  fits: string[];
  selectedFit?: string;
  onFitSelect: (fit: string) => void;
}

export function FitSelector({ fits, selectedFit, onFitSelect }: FitSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {fits.map(fit => (
        <button
          key={fit}
          onClick={() => onFitSelect(fit)}
          className={cn(
            'px-4 h-9 text-sm font-medium rounded-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
            selectedFit === fit
              ? 'bg-[#111111] text-white'
              : 'border border-[#E5E5E5] text-[#111111] hover:border-[#111111] bg-white'
          )}
        >
          {fit}
        </button>
      ))}
    </div>
  );
}

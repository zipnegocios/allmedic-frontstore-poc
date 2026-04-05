import type { ProductColor } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ColorSwatchProps {
  color: ProductColor;
  isSelected?: boolean;
  isAvailable?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export function ColorSwatch({
  color,
  isSelected = false,
  isAvailable = true,
  onClick,
  size = 'md',
  showTooltip = true,
}: ColorSwatchProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-11 h-11',
  };

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        disabled={!isAvailable}
        className={cn(
          'rounded-full border transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          sizeClasses[size],
          isSelected
            ? 'ring-2 ring-offset-2 ring-[#111111] border-transparent'
            : 'border-[#E5E5E5] hover:border-[#111111]',
          !isAvailable && 'opacity-50 cursor-not-allowed',
          color.hex === '#FFFFFF' && 'border-gray-300'
        )}
        style={{ backgroundColor: color.hex }}
        aria-label={`Color ${color.name}`}
      />
      
      {/* Out of stock diagonal line */}
      {!isAvailable && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-full h-0.5 bg-gray-400 rotate-45" />
        </div>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#111111] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
          {color.name}
        </div>
      )}
    </div>
  );
}

interface ColorSwatchGroupProps {
  colors: ProductColor[];
  selectedColorId?: string;
  availableColorIds?: string[];
  onColorSelect: (color: ProductColor) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function ColorSwatchGroup({
  colors,
  selectedColorId,
  availableColorIds,
  onColorSelect,
  size = 'md',
}: ColorSwatchGroupProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map(color => (
        <ColorSwatch
          key={color.id}
          color={color}
          isSelected={selectedColorId === color.id}
          isAvailable={availableColorIds ? availableColorIds.includes(color.id) : true}
          onClick={() => onColorSelect(color)}
          size={size}
        />
      ))}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { LayoutGrid, Grid2X2, List, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'grid-1' | 'grid-2' | 'list';

interface LayoutSwitcherProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (count: number) => void;
  totalItems: number;
}

const viewOptions: { mode: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { mode: 'grid-2', icon: Grid2X2, label: '2 columnas' },
  { mode: 'grid-1', icon: LayoutGrid, label: '1 columna' },
  { mode: 'list', icon: List, label: 'Lista' },
];

const itemsPerPageOptions = [5, 10, 20, 50];

export function LayoutSwitcher({
  viewMode,
  onViewModeChange,
  itemsPerPage,
  onItemsPerPageChange,
  totalItems,
}: LayoutSwitcherProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
      {/* Results count */}
      <span className="text-sm text-gray-500 hidden sm:inline">
        {totalItems} producto{totalItems !== 1 ? 's' : ''}
      </span>

      {/* View Mode Buttons */}
      <div className="flex items-center border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
        {viewOptions.map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            className={cn(
              'flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-all duration-200',
              viewMode === mode
                ? 'bg-[#111111] text-white'
                : 'text-gray-500 hover:text-[#111111] hover:bg-[#F5F5F7]'
            )}
            title={label}
            aria-label={label}
          >
            <Icon className="w-4 h-4" strokeWidth={1.5} />
            <span className="hidden sm:inline text-xs">{label}</span>
          </button>
        ))}
      </div>

      {/* Items Per Page Dropdown */}
      <div className="relative">
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="appearance-none bg-white border border-[#E5E5E5] rounded-lg px-3 py-2 pr-8 text-sm font-medium text-[#333333] focus:outline-none focus:border-[#111111] cursor-pointer"
        >
          {itemsPerPageOptions.map((count) => (
            <option key={count} value={count}>
              {count} por página
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
      </div>
    </div>
  );
}

// Product Card List View Component
interface ProductListItemProps {
  product: import('@/lib/types').Product;
  onQuickView?: () => void;
}

export function ProductListItem({ product, onQuickView }: ProductListItemProps) {
  const displayImage = product.variants[0]?.images[0] || '/images/placeholder-product.jpg';
  const hasDiscount = product.priceSale && product.priceSale < product.priceNormal;
  
  return (
    <div className="group flex gap-4 p-4 bg-white border border-[#E5E5E5] rounded-xl hover:border-[#111111] hover:shadow-md transition-all duration-300">
      {/* Image */}
      <Link to={`/p/${product.slug}`} className="flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 bg-[#F5F5F7] rounded-lg overflow-hidden">
        <img
          src={displayImage}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/images/placeholder-product.jpg';
          }}
        />
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">
            {product.brand}
          </p>
          <Link to={`/p/${product.slug}`}>
            <h3 className="text-base sm:text-lg font-semibold text-[#111111] mb-1 group-hover:underline line-clamp-2">
              {product.name}
            </h3>
          </Link>
          
          {/* Colors */}
          <div className="flex items-center gap-1.5 mt-2">
            {product.colors.slice(0, 4).map((color) => (
              <span
                key={color.id}
                className="w-4 h-4 rounded-full border border-gray-200"
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
            {product.colors.length > 4 && (
              <span className="text-xs text-gray-400">+{product.colors.length - 4}</span>
            )}
          </div>
        </div>

        {/* Price & Actions */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-baseline gap-2">
            {hasDiscount ? (
              <>
                <span className="text-lg font-bold text-[#111111]">
                  ${product.priceSale?.toFixed(2)}
                </span>
                <span className="text-sm text-gray-400 line-through">
                  ${product.priceNormal.toFixed(2)}
                </span>
              </>
            ) : (
              <span className="text-lg font-bold text-[#111111]">
                ${product.priceNormal.toFixed(2)}
              </span>
            )}
          </div>

          <button
            onClick={onQuickView}
            className="px-4 py-2 bg-[#111111] text-white text-sm font-medium rounded-full hover:opacity-80 transition-opacity"
          >
            Ver producto
          </button>
        </div>
      </div>
    </div>
  );
}

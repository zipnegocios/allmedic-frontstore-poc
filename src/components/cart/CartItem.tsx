import { Minus, Plus, X } from 'lucide-react';
import type { CartItem as CartItemType } from '@/lib/types';

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

export function CartItemComponent({ item, onUpdateQuantity, onRemove }: CartItemProps) {
  return (
    <div className="flex gap-4 py-4 border-b border-[#E5E5E5]">
      {/* Image */}
      <div className="w-16 h-20 bg-[#F5F5F7] rounded-md overflow-hidden flex-shrink-0">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/images/placeholder-product.jpg';
          }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400">{item.brand}</p>
            <h4 className="text-sm font-medium text-[#111111] truncate">{item.name}</h4>
          </div>
          <button
            onClick={onRemove}
            className="p-1 hover:bg-[#F5F5F7] rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
          </button>
        </div>

        {/* Color & Size */}
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-full border border-gray-200"
              style={{ backgroundColor: item.color.hex }}
            />
            <span>{item.color.name}</span>
          </div>
          <span>|</span>
          <span>Talla: {item.size}{item.fit ? ` (${item.fit})` : ''}</span>
        </div>

        {/* SKU */}
        <p className="text-xs text-gray-400 mt-0.5">{item.sku}</p>

        {/* Quantity & Price */}
        <div className="flex items-center justify-between mt-3">
          {/* Quantity Controls */}
          <div className="flex items-center border border-[#E5E5E5] rounded">
            <button
              onClick={() => onUpdateQuantity(item.quantity - 1)}
              className="w-8 h-8 flex items-center justify-center hover:bg-[#F5F5F7] transition-colors"
            >
              <Minus className="w-3 h-3" strokeWidth={1.5} />
            </button>
            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
            <button
              onClick={() => onUpdateQuantity(item.quantity + 1)}
              className="w-8 h-8 flex items-center justify-center hover:bg-[#F5F5F7] transition-colors"
            >
              <Plus className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </div>

          {/* Price */}
          <div className="text-right">
            <p className="text-sm font-bold text-[#111111]">
              ${(item.price * item.quantity).toFixed(2)}
            </p>
            <p className="text-xs text-gray-400">
              ${item.price.toFixed(2)} c/u
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

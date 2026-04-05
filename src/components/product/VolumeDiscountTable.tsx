import { Check, TrendingDown } from 'lucide-react';
import type { VolumeDiscount } from '@/lib/types';
import { cn } from '@/lib/utils';

interface VolumeDiscountTableProps {
  discounts: VolumeDiscount[];
  basePrice: number;
  currentQuantity?: number;
}

export function VolumeDiscountTable({
  discounts,
  basePrice,
  currentQuantity = 1,
}: VolumeDiscountTableProps) {
  // Ordenar por minQty ascendente
  const sortedDiscounts = [...discounts].sort((a, b) => a.minQty - b.minQty);

  const calculatePrice = (discountPct: number) => {
    return basePrice * (1 - discountPct / 100);
  };

  return (
    <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
      <div className="bg-[#F5F5F7] px-4 py-3 flex items-center gap-2">
        <TrendingDown className="w-4 h-4 text-[#111111]" strokeWidth={1.5} />
        <h4 className="text-sm font-semibold text-[#111111]">Descuentos por volumen</h4>
      </div>
      
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cantidad
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Precio c/u
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ahorro
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E5E5]">
          {sortedDiscounts.map((discount, index) => {
            const isActive = currentQuantity >= discount.minQty;
            const nextTier = sortedDiscounts[index + 1];
            const isInRange = nextTier
              ? currentQuantity >= discount.minQty && currentQuantity < nextTier.minQty
              : currentQuantity >= discount.minQty;

            return (
              <tr
                key={discount.minQty}
                className={cn(
                  'transition-colors',
                  isInRange && 'bg-[#34C759]/5'
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <Check className="w-4 h-4 text-[#34C759]" strokeWidth={1.5} />
                    )}
                    <span
                      className={cn(
                        'text-sm',
                        isActive ? 'text-[#111111] font-medium' : 'text-gray-600'
                      )}
                    >
                      {discount.label}
                    </span>
                    {isInRange && (
                      <span className="text-xs text-[#34C759] font-medium">
                        (Aplicado)
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isActive ? 'text-[#111111]' : 'text-gray-600'
                    )}
                  >
                    ${calculatePrice(discount.discountPct).toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {discount.discountPct > 0 ? (
                    <span className="text-sm text-[#34C759] font-medium">
                      -{discount.discountPct}%
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

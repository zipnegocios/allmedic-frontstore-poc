import { Badge } from '@/components/ui/badge';

interface PriceDisplayProps {
  priceNormal: number;
  priceSale?: number;
  discountPct?: number;
}

export function PriceDisplay({ priceNormal, priceSale, discountPct }: PriceDisplayProps) {
  const hasDiscount = priceSale && priceSale < priceNormal;
  const displayDiscount = discountPct || (hasDiscount 
    ? Math.round(((priceNormal - priceSale!) / priceNormal) * 100)
    : 0);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-3 flex-wrap">
        {hasDiscount ? (
          <>
            <span className="text-3xl font-bold text-[#111111]">
              ${priceSale!.toFixed(2)}
            </span>
            <span className="text-lg text-gray-400 line-through">
              ${priceNormal.toFixed(2)}
            </span>
            <Badge variant="destructive">AHORRA {displayDiscount}%</Badge>
          </>
        ) : (
          <span className="text-3xl font-bold text-[#111111]">
            ${priceNormal.toFixed(2)}
          </span>
        )}
      </div>
      
      {hasDiscount && (
        <p className="text-sm text-gray-500">
          Precio normal: <span className="line-through">${priceNormal.toFixed(2)}</span>
        </p>
      )}
    </div>
  );
}

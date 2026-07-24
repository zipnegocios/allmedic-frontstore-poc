'use client';

import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function MinQuantityInfoPopover({ minQuantity }: { minQuantity: number }) {
  return (
    <Popover>
      <PopoverTrigger
        className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors"
        aria-label="Información sobre el pedido mínimo"
      >
        <Info className="w-3.5 h-3.5" />
      </PopoverTrigger>
      <PopoverContent className="font-sans text-body-sm text-gray-700">
        El mínimo de {minQuantity} sets es por carrito, no por cada set que veas. Combina distintos sets, colores y
        tallas del catálogo corporativo hasta completarlo.
      </PopoverContent>
    </Popover>
  );
}

'use client';

import { useState, useSyncExternalStore } from 'react';
import { Building2 } from 'lucide-react';
import { useCorporateCart } from '@/context/CorporateCartContext';
import { CorporateCartDrawer } from './CorporateCartDrawer';

function useMounted() {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}

export function CorporateCartButton() {
  const { items } = useCorporateCart();
  const [isOpen, setIsOpen] = useState(false);
  const mounted = useMounted();

  const totalSets = items.reduce(
    (sum, item) => sum + item.lines.reduce((lineSum, l) => lineSum + l.quantity, 0),
    0
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors relative"
        aria-label="Abrir carrito corporativo"
      >
        <Building2 className="w-5 h-5" strokeWidth={1.5} />
        {mounted && totalSets > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#FF3B30] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {totalSets > 99 ? '99+' : totalSets}
          </span>
        )}
      </button>
      <CorporateCartDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

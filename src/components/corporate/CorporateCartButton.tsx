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
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 bg-[#111111] text-white rounded-full shadow-lg hover:opacity-90 transition-opacity"
        aria-label="Abrir carrito corporativo"
      >
        <Building2 className="w-5 h-5" strokeWidth={1.5} />
        <span className="text-sm font-medium">Carrito Corporativo</span>
        {mounted && totalSets > 0 && (
          <span className="flex items-center justify-center w-5 h-5 bg-white text-[#111111] text-xs font-bold rounded-full">
            {totalSets}
          </span>
        )}
      </button>
      <CorporateCartDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

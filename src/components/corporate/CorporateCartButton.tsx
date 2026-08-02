'use client';

import { useSyncExternalStore } from 'react';
import { Building2 } from 'lucide-react';
import { useCorporateCart } from '@/context/CorporateCartContext';

function useMounted() {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}

interface CorporateCartButtonProps {
  onClick: () => void;
}

// El drawer (`CorporateCartDrawer`) NO se monta acá — este botón vive dentro de `<header>`
// (Header.tsx), que tiene `backdrop-blur-md` cuando hace scroll. `backdrop-filter` crea un
// nuevo containing block para `position: fixed`, así que un drawer `fixed` montado dentro
// del header queda contenido por la altura del header (~64px) en vez de ocupar el viewport
// completo. El drawer se monta como hermano del Header en AppShell.tsx, igual que el
// CartDrawer individual — este componente solo dispara `onClick` para abrirlo.
export function CorporateCartButton({ onClick }: CorporateCartButtonProps) {
  const { items } = useCorporateCart();
  const mounted = useMounted();

  const totalSets = items.reduce(
    (sum, item) => sum + item.lines.reduce((lineSum, l) => lineSum + l.quantity, 0),
    0
  );

  return (
    <button
      onClick={onClick}
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
  );
}

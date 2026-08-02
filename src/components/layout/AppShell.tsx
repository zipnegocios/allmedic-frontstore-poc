'use client';

import { useState } from 'react';
import { Header } from './Header';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CorporateCartDrawer } from '@/components/corporate/CorporateCartDrawer';
import type { Product, Store, BrandNavItem } from '@/lib/types';
import type { CorporateSetNavItem } from '@/lib/corporate-types';

interface AppShellProps {
  children: React.ReactNode;
  products?: Product[];
  brands?: BrandNavItem[];
  stores?: Store[];
  corporateSets?: CorporateSetNavItem[];
}

export function AppShell({ children, products, brands, stores, corporateSets }: AppShellProps) {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCorporateCartOpen, setIsCorporateCartOpen] = useState(false);

  return (
    <>
      <Header
        onCartClick={() => setIsCartOpen(true)}
        onCorporateCartClick={() => setIsCorporateCartOpen(true)}
        products={products}
        brands={brands}
        stores={stores}
        corporateSets={corporateSets}
      />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      {/* Montado como hermano del Header (no anidado dentro de él) — el header tiene
          backdrop-blur-md al hacer scroll, que crea un containing block y rompería el
          posicionamiento `fixed` de este drawer si estuviera adentro. Ver nota en
          CorporateCartButton.tsx. */}
      <CorporateCartDrawer isOpen={isCorporateCartOpen} onClose={() => setIsCorporateCartOpen(false)} />
      {children}
    </>
  );
}

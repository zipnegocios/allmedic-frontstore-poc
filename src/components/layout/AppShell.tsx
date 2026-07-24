'use client';

import { useState } from 'react';
import { Header } from './Header';
import { CartDrawer } from '@/components/cart/CartDrawer';
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

  return (
    <>
      <Header
        onCartClick={() => setIsCartOpen(true)}
        products={products}
        brands={brands}
        stores={stores}
        corporateSets={corporateSets}
      />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      {children}
    </>
  );
}

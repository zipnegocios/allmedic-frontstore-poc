'use client';

import { useState } from 'react';
import { Header } from './Header';
import { CartDrawer } from '@/components/cart/CartDrawer';
import type { Product, Store } from '@/lib/types';

interface AppShellProps {
  children: React.ReactNode;
  products?: Product[];
  brands?: string[];
  stores?: Store[];
}

export function AppShell({ children, products, brands, stores }: AppShellProps) {
  const [isCartOpen, setIsCartOpen] = useState(false);

  return (
    <>
      <Header
        onCartClick={() => setIsCartOpen(true)}
        products={products}
        brands={brands}
        stores={stores}
      />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      {children}
    </>
  );
}

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { CartItem, Product, ProductColor, Size, Fit } from '@/lib/types';

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, variantId: string, color: ProductColor, size: Size, fit: Fit | undefined, quantity: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  getActiveVolumeDiscount: () => { minQty: number; discountPct: number; label: string } | null;
  getNextVolumeTier: () => { minQty: number; discountPct: number; itemsNeeded: number } | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'allmedic-cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((
    product: Product,
    variantId: string,
    color: ProductColor,
    size: Size,
    fit: Fit | undefined,
    quantity: number
  ) => {
    setItems(prev => {
      const existingItem = prev.find(
        item => item.productId === product.id && item.variantId === variantId
      );

      if (existingItem) {
        return prev.map(item =>
          item.id === existingItem.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      const variant = product.variants.find(v => v.id === variantId);
      const price = product.priceSale || product.priceNormal;

      const newItem: CartItem = {
        id: `${product.id}-${variantId}-${Date.now()}`,
        productId: product.id,
        variantId,
        name: product.name,
        brand: product.brand,
        color,
        size,
        fit,
        quantity,
        price,
        image: variant?.images[0] || '/images/placeholder-product.jpg',
        sku: variant?.sku || '',
      };

      return [...prev, newItem];
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const getActiveVolumeDiscount = useCallback(() => {
    // Simplificación: usamos descuentos estándar
    if (totalItems >= 20) return { minQty: 20, discountPct: 15, label: '20+ unidades' };
    if (totalItems >= 10) return { minQty: 10, discountPct: 10, label: '10-19 unidades' };
    return null;
  }, [totalItems]);

  const getNextVolumeTier = useCallback(() => {
    if (totalItems < 10) return { minQty: 10, discountPct: 10, itemsNeeded: 10 - totalItems };
    if (totalItems < 20) return { minQty: 20, discountPct: 15, itemsNeeded: 20 - totalItems };
    return null;
  }, [totalItems]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
        getActiveVolumeDiscount,
        getNextVolumeTier,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

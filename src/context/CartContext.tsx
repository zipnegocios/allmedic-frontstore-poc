'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Product, ProductColor, Size, Fit, CartItem, VolumeDiscount } from '@/lib/types';

// Note: We validate cart items by structure check in CartProvider
// since the schema types are strict literal types

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  subtotal: number;
  addItem: (product: Product, variantId: string, color: ProductColor, size: Size, fit: Fit | undefined, quantity: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getActiveVolumeDiscount: () => VolumeDiscount | null;
  getNextVolumeTier: () => VolumeDiscount | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Default volume discounts
const VOLUME_DISCOUNTS: VolumeDiscount[] = [
  { quantity: 3, minQty: 3, discount: 10, discountPct: 10, label: '3+ unidades' },
  { quantity: 5, minQty: 5, discount: 15, discountPct: 15, label: '5+ unidades' },
  { quantity: 10, minQty: 10, discount: 20, discountPct: 20, label: '10+ unidades' },
];

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cart');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Validate structure but allow the data through with type assertion
          // since we control the source
          if (Array.isArray(parsed) && parsed.every(item =>
            typeof item === 'object' && item !== null &&
            'id' in item && 'productId' in item && 'variantId' in item
          )) {
            return parsed as CartItem[];
          }
          return [];
        } catch (error) {
          console.warn('Failed to load cart from localStorage:', error);
          return [];
        }
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotal = totalPrice;

  const getActiveVolumeDiscount = useCallback((): VolumeDiscount | null => {
    const sortedDiscounts = [...VOLUME_DISCOUNTS].sort((a, b) => b.minQty - a.minQty);
    return sortedDiscounts.find(d => totalItems >= d.minQty) || null;
  }, [totalItems]);

  const getNextVolumeTier = useCallback((): VolumeDiscount | null => {
    const sortedDiscounts = [...VOLUME_DISCOUNTS].sort((a, b) => a.minQty - b.minQty);
    return sortedDiscounts.find(d => totalItems < d.minQty) || null;
  }, [totalItems]);

  const addItem = useCallback((
    product: Product,
    variantId: string,
    color: ProductColor,
    size: Size,
    fit: Fit | undefined,
    quantity: number
  ) => {
    const variant = product.variants.find(v => v.id === variantId);
    if (!variant) return;

    setItems(prev => {
      const existingItem = prev.find(
        item => item.variantId === variantId && item.color.id === color.id && item.size === size
      );

      if (existingItem) {
        return prev.map(item =>
          item.id === existingItem.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      const newItem: CartItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        productId: product.id,
        variantId,
        name: product.name,
        brand: product.brand,
        slug: product.slug,
        color,
        size,
        fit,
        sku: variant.sku,
        price: product.priceSale || product.priceNormal,
        quantity,
        image: variant.images[0] || '/images/placeholder-product.jpg',
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

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        totalPrice,
        subtotal,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
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

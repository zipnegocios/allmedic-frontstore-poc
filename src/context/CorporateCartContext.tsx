'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import {
  resolveRules,
  validateCorporateCart,
  computeCartPricing,
  type BusinessRule,
  type ValidationResult,
  type PricingResult,
  type SizeMode,
} from '@/lib/rules-engine';

export interface CorporateCartLine {
  id: string;
  size?: string;
  color?: string;
  pieceSelections?: Array<{ productId: string; size: string }>;
  quantity: number;
}

export interface CorporateCartItem {
  setId: string;
  setSlug: string;
  setName: string;
  imageUrl: string | null;
  sizeMode: SizeMode;
  setGroupId: string | null;
  brandId: string | null;
  unitPrice: number;
  hasMissingPrices: boolean;
  lines: CorporateCartLine[];
}

interface CorporateCartContextType {
  items: CorporateCartItem[];
  rules: BusinessRule[];
  rulesLoading: boolean;
  addLine: (
    set: Omit<CorporateCartItem, 'lines'>,
    line: Omit<CorporateCartLine, 'id'>
  ) => void;
  removeLine: (setId: string, lineId: string) => void;
  updateLineQuantity: (setId: string, lineId: string, quantity: number) => void;
  removeSet: (setId: string) => void;
  clearCart: () => void;
  validation: ValidationResult;
  pricing: PricingResult;
  globalMinQuantity: number;
}

const CorporateCartContext = createContext<CorporateCartContextType | undefined>(undefined);

const STORAGE_KEY = 'corporate_cart';

function lineId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function CorporateCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CorporateCartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/corporate/rules')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setRules(data.rules || []);
      })
      .catch(() => {
        if (!cancelled) setRules([]);
      })
      .finally(() => {
        if (!cancelled) setRulesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addLine = useCallback((set: Omit<CorporateCartItem, 'lines'>, line: Omit<CorporateCartLine, 'id'>) => {
    setItems((prev) => {
      const existingSetIndex = prev.findIndex((i) => i.setId === set.setId);
      const newLine: CorporateCartLine = { ...line, id: lineId() };

      if (existingSetIndex === -1) {
        return [...prev, { ...set, lines: [newLine] }];
      }

      const existing = prev[existingSetIndex];
      // Fusiona líneas idénticas (misma talla/color/selección de piezas)
      const matchIndex = existing.lines.findIndex(
        (l) =>
          l.size === newLine.size &&
          l.color === newLine.color &&
          JSON.stringify(l.pieceSelections) === JSON.stringify(newLine.pieceSelections)
      );

      const updatedLines =
        matchIndex === -1
          ? [...existing.lines, newLine]
          : existing.lines.map((l, idx) =>
              idx === matchIndex ? { ...l, quantity: l.quantity + newLine.quantity } : l
            );

      const updated = [...prev];
      updated[existingSetIndex] = { ...existing, lines: updatedLines };
      return updated;
    });
  }, []);

  const removeLine = useCallback((setId: string, lId: string) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.setId === setId ? { ...item, lines: item.lines.filter((l) => l.id !== lId) } : item
        )
        .filter((item) => item.lines.length > 0)
    );
  }, []);

  const updateLineQuantity = useCallback((setId: string, lId: string, quantity: number) => {
    if (quantity <= 0) {
      removeLine(setId, lId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.setId === setId
          ? { ...item, lines: item.lines.map((l) => (l.id === lId ? { ...l, quantity } : l)) }
          : item
      )
    );
  }, [removeLine]);

  const removeSet = useCallback((setId: string) => {
    setItems((prev) => prev.filter((item) => item.setId !== setId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const setMeta = useMemo(
    () =>
      Object.fromEntries(
        items.map((i) => [i.setId, { setGroupId: i.setGroupId, brandId: i.brandId }])
      ),
    [items]
  );

  const setPrices = useMemo(
    () =>
      Object.fromEntries(
        items.map((i) => [i.setId, { pricePerSet: i.unitPrice, hasMissingPrices: i.hasMissingPrices }])
      ),
    [items]
  );

  const cartForEngine = useMemo(
    () => ({
      items: items.map((i) => ({
        setId: i.setId,
        setName: i.setName,
        sizeMode: i.sizeMode,
        lines: i.lines.map((l) => ({
          size: l.size,
          color: l.color,
          pieceSelections: l.pieceSelections,
          quantity: l.quantity,
        })),
      })),
    }),
    [items]
  );

  const validation = useMemo(
    () => validateCorporateCart(cartForEngine, rules, setMeta),
    [cartForEngine, rules, setMeta]
  );

  const pricing = useMemo(
    () => computeCartPricing(cartForEngine, setPrices, rules),
    [cartForEngine, setPrices, rules]
  );

  const globalMinQuantity = useMemo(() => resolveRules(rules, {}).minQuantity.min, [rules]);

  return (
    <CorporateCartContext.Provider
      value={{
        items,
        rules,
        rulesLoading,
        addLine,
        removeLine,
        updateLineQuantity,
        removeSet,
        clearCart,
        validation,
        pricing,
        globalMinQuantity,
      }}
    >
      {children}
    </CorporateCartContext.Provider>
  );
}

export function useCorporateCart() {
  const context = useContext(CorporateCartContext);
  if (context === undefined) {
    throw new Error('useCorporateCart must be used within a CorporateCartProvider');
  }
  return context;
}

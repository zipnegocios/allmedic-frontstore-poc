'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  resolveRules,
  validateCorporateCart,
  computeCartPricing,
  type BusinessRule,
  type ValidationResult,
  type PricingResult,
  type SizeMode,
  type CountUnit,
  type InventoryIssue,
  type SetPieceInfo,
} from '@/lib/rules-engine';

export interface CorporateCartLine {
  id: string;
  quantity: number;
  /** Una entrada por pieza del set — talla ausente en sets NO_SIZES, color siempre opcional. */
  pieceSelections: Array<{ productId: string; size?: string; color?: string }>;
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
  /** Suma de quantityPerSet de todas las piezas del set — usado por MIN_QUANTITY
   * cuando la regla activa tiene countUnit: "PIECES". */
  piecesPerSet: number;
  /** Composición del set (productos + cantidad por set) — usada para resolver reglas de ámbito
   * Producto en la previsualización del carrito (mismo dato que ya usa el servidor). */
  pieces?: SetPieceInfo[];
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
  globalCountUnit: CountUnit;
  inventoryIssues: InventoryIssue[];
  inventoryChecking: boolean;
  /** Combina `validation.canSubmit` con la ausencia de violaciones BLOCK de inventario —
   * úsalo en vez de `validation.canSubmit` para habilitar/deshabilitar el envío. */
  canSubmit: boolean;
}

const CorporateCartContext = createContext<CorporateCartContextType | undefined>(undefined);

const STORAGE_KEY = 'corporate_cart';

function lineId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function lineKey(l: Pick<CorporateCartLine, 'pieceSelections'>): string {
  return JSON.stringify(l.pieceSelections);
}

/** Forma de una línea de carrito ANTES del armador de combinaciones: talla/color a nivel de
 * línea (compartidos por todas las piezas) y `pieceSelections` sin color. Se conserva solo
 * para migrar carritos persistidos (localStorage o BD) al nuevo formato en lectura. */
interface LegacyCorporateCartLine {
  id?: string;
  size?: string;
  color?: string;
  pieceSelections?: Array<{ productId: string; size: string }>;
  quantity: number;
}

/** Migra una línea a la forma unificada del armador: si ya trae `pieceSelections`, le
 * propaga el color de línea a cada pieza (formato PER_PIECE anterior); si no, la reconstruye
 * a partir de la composición del set guardada en el ítem (formato MATRIX/NO_SIZES anterior).
 * Si el ítem no tiene `pieces` (carritos muy antiguos, previos a esa metadata), la línea queda
 * sin piezas — no rompe la carga, pero no podrá enviarse hasta rehacerse en el armador. */
function migrateLine(item: { pieces?: SetPieceInfo[] }, raw: LegacyCorporateCartLine): CorporateCartLine {
  if (raw.pieceSelections && raw.pieceSelections.length > 0) {
    return {
      id: raw.id ?? lineId(),
      quantity: raw.quantity,
      pieceSelections: raw.pieceSelections.map((s) => ({
        productId: s.productId,
        size: s.size,
        color: raw.color,
      })),
    };
  }
  const pieces = item.pieces ?? [];
  return {
    id: raw.id ?? lineId(),
    quantity: raw.quantity,
    pieceSelections: pieces.map((p) => ({ productId: p.productId, size: raw.size, color: raw.color })),
  };
}

function normalizeCartItems(raw: unknown): CorporateCartItem[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Omit<CorporateCartItem, 'lines'> & { lines: LegacyCorporateCartLine[] }>).map((item) => ({
    ...item,
    lines: (item.lines ?? []).map((l) => migrateLine(item, l)),
  }));
}

/** Fusiona el carrito del servidor (BD) con el carrito local (localStorage), sumando
 * cantidades de líneas idénticas — se usa al iniciar sesión para no perder ninguno
 * de los dos carritos. */
function mergeCartItems(local: CorporateCartItem[], server: CorporateCartItem[]): CorporateCartItem[] {
  const merged: CorporateCartItem[] = local.map((item) => ({ ...item, lines: [...item.lines] }));

  for (const serverItem of server) {
    const localIndex = merged.findIndex((i) => i.setId === serverItem.setId);
    if (localIndex === -1) {
      merged.push({ ...serverItem, lines: serverItem.lines.map((l) => ({ ...l, id: lineId() })) });
      continue;
    }

    const localItem = merged[localIndex];
    const linesByKey = new Map(localItem.lines.map((l) => [lineKey(l), l]));

    for (const serverLine of serverItem.lines) {
      const key = lineKey(serverLine);
      const existingLine = linesByKey.get(key);
      if (existingLine) {
        existingLine.quantity += serverLine.quantity;
      } else {
        const newLine = { ...serverLine, id: lineId() };
        localItem.lines.push(newLine);
        linesByKey.set(key, newLine);
      }
    }
  }

  return merged;
}

export function CorporateCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CorporateCartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      return normalizeCartItems(JSON.parse(saved));
    } catch {
      return [];
    }
  });

  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const { data: session, status: sessionStatus } = useSession();
  const hasMergedRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Al iniciar sesión: fusiona el carrito guardado en BD con el de localStorage
  // (una sola vez por sesión) y persiste el resultado combinado en el servidor.
  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !session?.user || hasMergedRef.current) return;
    hasMergedRef.current = true;

    fetch('/api/corporate/cart')
      .then((res) => res.json())
      .then((data: { items?: unknown[] }) => {
        const serverItems = normalizeCartItems(data.items ?? []);
        if (serverItems.length === 0) return;
        setItems((prev) => {
          const merged = mergeCartItems(prev, serverItems);
          fetch('/api/corporate/cart', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: merged }),
          }).catch(() => {});
          return merged;
        });
      })
      .catch(() => {});
  }, [sessionStatus, session]);

  // Guarda el carrito en BD (debounced) mientras hay sesión iniciada —
  // permite continuar la compra desde otro dispositivo.
  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !hasMergedRef.current) return;
    const timer = setTimeout(() => {
      fetch('/api/corporate/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [items, sessionStatus]);

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
      // Fusiona líneas idénticas (misma combinación de talla/color por pieza)
      const matchIndex = existing.lines.findIndex((l) => lineKey(l) === lineKey(newLine));

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
        items.map((i) => [i.setId, { setGroupId: i.setGroupId, brandId: i.brandId, piecesPerSet: i.piecesPerSet, pieces: i.pieces }])
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
    () => computeCartPricing(cartForEngine, setPrices, rules, setMeta),
    [cartForEngine, setPrices, rules, setMeta]
  );

  const globalMinQuantityConfig = useMemo(() => resolveRules(rules, {}).minQuantity, [rules]);
  const globalMinQuantity = globalMinQuantityConfig.min;
  const globalCountUnit = globalMinQuantityConfig.countUnit;

  // INVENTORY_MODE: requiere stock real de la BD, así que se verifica contra un endpoint
  // (dry-run) en vez de calcularse en el motor puro del cliente. Debounced como el resto
  // de verificaciones asíncronas del proyecto (ver check-conflicts en RuleForm).
  const [inventoryIssues, setInventoryIssues] = useState<InventoryIssue[]>([]);
  const [inventoryChecking, setInventoryChecking] = useState(false);

  useEffect(() => {
    if (cartForEngine.items.length === 0) {
      setInventoryIssues([]);
      return;
    }
    const timer = setTimeout(async () => {
      setInventoryChecking(true);
      try {
        const res = await fetch('/api/corporate/cart/check-inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: cartForEngine.items }),
        });
        if (res.ok) {
          const data = await res.json();
          setInventoryIssues(data.issues ?? []);
        }
      } catch {
        // Fallback silencioso: el servidor vuelve a validar de forma bloqueante al enviar.
      } finally {
        setInventoryChecking(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [cartForEngine]);

  const canSubmit = validation.canSubmit && !inventoryIssues.some((i) => i.severity === 'BLOCK');

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
        globalCountUnit,
        inventoryIssues,
        inventoryChecking,
        canSubmit,
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

'use client';

import { createContext, useContext, useMemo } from 'react';
import { resolveRules, type BusinessRule } from '@/lib/rules-engine';

interface PriceVisibilityCtxValue {
  rules: BusinessRule[];
}

const PriceVisibilityContext = createContext<PriceVisibilityCtxValue | undefined>(undefined);

/**
 * Expone si el catálogo individual debe mostrar precios, resuelto POR ÍTEM (marca/producto) con
 * las reglas `PRICE_VISIBILITY` cargadas una sola vez en el servidor — la resolución es un loop
 * en memoria en cada componente que la consulta, no una consulta adicional por tarjeta.
 */
export function PriceVisibilityProvider({
  rules,
  children,
}: {
  rules: BusinessRule[];
  children: React.ReactNode;
}) {
  return (
    <PriceVisibilityContext.Provider value={{ rules }}>
      {children}
    </PriceVisibilityContext.Provider>
  );
}

/**
 * `usePriceVisibility()` sin argumentos resuelve solo el ámbito Global — coherente con
 * componentes de chrome (Header, MegaMenu, resumen agregado del carrito) que no representan un
 * único producto/marca. Pasa `{ brandId, productId }` en componentes de un producto concreto
 * (tarjeta, ficha, línea de carrito) para que una regla de ámbito Marca/Producto tenga efecto ahí.
 */
export function usePriceVisibility(context?: { brandId?: string | null; productId?: string | null }): boolean {
  const ctx = useContext(PriceVisibilityContext);
  // Fail-open: si el provider no está montado (ej. un componente reusado fuera
  // de la tienda), no ocultamos precios por accidente.
  const resolved = useMemo(() => {
    if (!ctx) return null;
    return resolveRules(ctx.rules, { brandId: context?.brandId, productId: context?.productId });
  }, [ctx, context?.brandId, context?.productId]);

  if (!resolved) return true;
  return (
    resolved.priceVisibility.showPrices &&
    (resolved.priceVisibility.catalog === 'INDIVIDUAL' || resolved.priceVisibility.catalog === 'BOTH')
  );
}

'use client';

import { createContext, useContext } from 'react';

const PriceVisibilityContext = createContext<boolean | undefined>(undefined);

/**
 * Expone si el catálogo individual debe mostrar precios, resuelto en el servidor
 * (regla `PRICE_VISIBILITY` del motor de reglas, catálogo INDIVIDUAL o BOTH) y
 * pasado como valor inicial — sin fetch adicional en el cliente, sin parpadeo.
 */
export function PriceVisibilityProvider({
  showPrices,
  children,
}: {
  showPrices: boolean;
  children: React.ReactNode;
}) {
  return (
    <PriceVisibilityContext.Provider value={showPrices}>
      {children}
    </PriceVisibilityContext.Provider>
  );
}

export function usePriceVisibility(): boolean {
  const value = useContext(PriceVisibilityContext);
  // Fail-open: si el provider no está montado (ej. un componente reusado fuera
  // de la tienda), no ocultamos precios por accidente.
  return value ?? true;
}

'use client';

import { AlertTriangle } from 'lucide-react';
import { CollapsibleSection } from '@/components/admin/product-form/CollapsibleSection';
import { computePairedColorWarnings } from './color-mode-utils';
import type { SetFormData, EligibleProduct } from './schema';

interface PairedColorAccordionProps {
  items: SetFormData['items'];
  products: EligibleProduct[];
}

/**
 * Acordeón informativo del modo "Piezas combinadas por color" — explica la regla y lista, sin
 * bloquear el guardado, qué piezas no tienen paridad de color entre sí (ver
 * `computePairedColorWarnings`). La regla COLOR_PAIRING que hace cumplir esto en el carrito real
 * la crea/activa el servidor automáticamente al guardar el set (ver `syncColorPairingRule`).
 */
export function PairedColorAccordion({ items, products }: PairedColorAccordionProps) {
  const warnings = computePairedColorWarnings(items, products);

  return (
    <CollapsibleSection title="Piezas del Set combinadas por color" defaultOpen>
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          Todas las piezas de este set se piden siempre en el mismo color — en el catálogo público
          solo se ofrecen los colores que existen en TODAS las piezas. Puedes seguir creando
          piezas en cualquier color; si un color no tiene paridad completa, simplemente no
          aparecerá como opción para el comprador.
        </p>
        {warnings.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
            {warnings.map((w, i) => (
              <p key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                {w.message}
              </p>
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

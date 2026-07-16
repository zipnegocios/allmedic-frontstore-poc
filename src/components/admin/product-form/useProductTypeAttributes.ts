'use client';

import { useEffect, useState } from 'react';
import type { ProductTypeAttributeLink, AttributeValueOption } from './schema';

/**
 * Carga los atributos EAV declarados para un Tipo de Producto (Fase 3.2:
 * `productTypeAttributes`) junto con los valores activos de cada atributo
 * (Fase 3.3: `attributeValues`) — una sola fuente compartida entre el generador
 * de matriz (`AttributeMatrixSection`) y el editor fila a fila de variantes
 * (`VariantsMediaSection`), para no duplicar el fetch.
 *
 * "Sin opción muerta" (Fase 3.4, ver brief B.2): si `productTypeId` no tiene
 * atributos asociados, `links` queda vacío — los consumidores deben mostrar un
 * mensaje explicativo en vez de un selector vacío.
 */
export function useProductTypeAttributes(productTypeId: string | undefined) {
  const [links, setLinks] = useState<ProductTypeAttributeLink[]>([]);
  const [valuesByAttribute, setValuesByAttribute] = useState<Record<string, AttributeValueOption[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLinks([]);
    setValuesByAttribute({});

    if (!productTypeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/admin/product-types/${productTypeId}/attributes`);
        if (!res.ok) return;
        const { attributes } = (await res.json()) as { attributes: ProductTypeAttributeLink[] };
        if (cancelled) return;
        setLinks(attributes);

        const entries = await Promise.all(
          attributes.map(async (link) => {
            const vRes = await fetch(`/api/admin/attributes/${link.attributeId}/values`);
            const { values } = vRes.ok
              ? ((await vRes.json()) as { values: AttributeValueOption[] })
              : { values: [] as AttributeValueOption[] };
            return [link.attributeId, values.filter((v) => v.isActive !== false)] as const;
          })
        );
        if (!cancelled) setValuesByAttribute(Object.fromEntries(entries));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productTypeId]);

  return { links, valuesByAttribute, loading };
}

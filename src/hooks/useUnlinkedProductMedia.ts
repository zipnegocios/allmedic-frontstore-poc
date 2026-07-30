'use client';

import { useCallback, useRef, useState } from 'react';
import type { MediaAssetSummary } from '@/lib/media';

interface ColorRef {
  id: string;
  code: string;
}

/**
 * Sugerencias de precarga: assets ya subidos a R2 bajo `products/{code}/{colorCode}/` que
 * todavía no están vinculados a este producto+color (ej. sesión previa que falló al guardar
 * después de subir fotos) — ver `/api/admin/media/unlinked-by-color`.
 *
 * El admin puede aceptarlas (se agregan a la galería vía `appendImage`, como cualquier otra
 * imagen) o descartarlas (desaparecen de la sugerencia y no vuelven a ofrecerse, registrado en
 * `product_media_dismissals` recién al GUARDAR el producto — ver `dismissedAssetIds`).
 */
export function useUnlinkedProductMedia(productId: string | undefined) {
  const [suggestionsByColorId, setSuggestionsByColorId] = useState<Record<string, MediaAssetSummary[]>>({});
  const [loading, setLoading] = useState(false);
  // assetId -> colorId de toda sugerencia alguna vez ofrecida en esta sesión de edición — la
  // diferencia contra lo que termine en `images[]` al guardar son los descartes a persistir.
  const everOfferedRef = useRef<Map<string, string | null>>(new Map());

  const scan = useCallback(async (code: string, colors: ColorRef[]) => {
    const trimmedCode = code.trim();
    if (!trimmedCode || colors.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/media/unlinked-by-color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, code: trimmedCode, colors }),
      });
      if (!res.ok) return;
      const { assetsByColorId } = (await res.json()) as { assetsByColorId: Record<string, MediaAssetSummary[]> };
      for (const [colorId, assets] of Object.entries(assetsByColorId)) {
        for (const asset of assets) everOfferedRef.current.set(asset.id, colorId);
      }
      setSuggestionsByColorId((prev) => ({ ...prev, ...assetsByColorId }));
    } finally {
      setLoading(false);
    }
  }, [productId]);

  /** Quita una sugerencia aceptada o descartada de la lista pendiente — en ambos casos deja de
   * mostrarse como "sugerida"; solo la aceptación agrega la imagen a la galería (responsabilidad
   * del llamador), el descarte no hace nada más acá (se persiste al guardar, ver abajo). */
  const clearSuggestion = useCallback((colorId: string, assetId: string) => {
    setSuggestionsByColorId((prev) => {
      const remaining = (prev[colorId] ?? []).filter((a) => a.id !== assetId);
      return { ...prev, [colorId]: remaining };
    });
  }, []);

  /** Descartes a enviar al guardar: toda sugerencia ofrecida en esta sesión cuyo assetId NO
   * esté en la lista final de `images[]` del formulario — cubre tanto "el admin tocó el botón
   * quitar en la sugerencia" como "la sugerencia quedó pendiente sin aceptar ni rechazar
   * explícitamente" (se trata igual: si no se guardó, se considera descartada). */
  const getDismissedAssetIds = useCallback((finalImageAssetIds: Set<string>) => {
    const dismissed: Array<{ assetId: string; colorId: string | null }> = [];
    for (const [assetId, colorId] of everOfferedRef.current.entries()) {
      if (!finalImageAssetIds.has(assetId)) dismissed.push({ assetId, colorId });
    }
    return dismissed;
  }, []);

  return { suggestionsByColorId, loading, scan, clearSuggestion, getDismissedAssetIds };
}

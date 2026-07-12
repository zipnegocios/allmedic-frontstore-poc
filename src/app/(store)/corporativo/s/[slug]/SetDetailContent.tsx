'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Building2, ChevronLeft, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useCorporateCart } from '@/context/CorporateCartContext';
import type { CorporateSetDetail, SetPiece } from '@/lib/corporate-types';
import type { InventoryModeValue, InventoryStockSnapshot, SizeMode } from '@/lib/rules-engine';
import { cn } from '@/lib/utils';

interface SetDetailContentProps {
  set: CorporateSetDetail;
  sizeMode: SizeMode;
  minQuantity: number;
  showPrices: boolean;
  inventoryMode: InventoryModeValue;
  stockSnapshot: InventoryStockSnapshot;
}

/** Sets completos que se pueden armar en `size` (MATRIX) — limitado por la pieza más escasa. */
function availableSetsForSize(pieces: SetPiece[], stockSnapshot: InventoryStockSnapshot, size: string): number {
  if (pieces.length === 0) return 0;
  return Math.min(
    ...pieces.map((p) => Math.floor((stockSnapshot[`${p.productId}::${size}`] ?? 0) / p.quantityPerSet))
  );
}

/** Sets completos que se pueden armar sin importar talla (NO_SIZES) — limitado por la pieza más escasa. */
function availableSetsNoSizes(pieces: SetPiece[], stockSnapshot: InventoryStockSnapshot): number {
  if (pieces.length === 0) return 0;
  return Math.min(...pieces.map((p) => Math.floor((stockSnapshot[p.productId] ?? 0) / p.quantityPerSet)));
}

/** Sets completos de UNA pieza específica en la talla elegida (PER_PIECE). */
function availableForPieceSize(piece: SetPiece, size: string, stockSnapshot: InventoryStockSnapshot): number {
  return Math.floor((stockSnapshot[`${piece.productId}::${size}`] ?? 0) / piece.quantityPerSet);
}

export function SetDetailContent({ set, sizeMode, minQuantity, showPrices, inventoryMode, stockSnapshot }: SetDetailContentProps) {
  const { addLine } = useCorporateCart();
  const showAvailability = inventoryMode !== 'IGNORE';

  // ── MATRIX: tallas comunes a todas las piezas (el set completo va en la misma talla) ──
  const commonSizes = useMemo(() => {
    if (set.pieces.length === 0) return [];
    const [first, ...rest] = set.pieces;
    return first.availableSizes.filter((size) => rest.every((p) => p.availableSizes.includes(size)));
  }, [set.pieces]);

  // Colores comunes a todas las piezas del set, con al menos una variante activa cada una — el
  // color se elige UNA vez por línea del carrito (no por pieza individual), igual en los 3 modos
  // de talla: extender la selección a nivel de pieza requeriría cambiar la forma de
  // `pieceSelections` (usada también por INVENTORY_MODE para calcular demanda), fuera del
  // alcance de esta activación de ámbitos.
  const commonColors = useMemo(() => {
    if (set.pieces.length === 0) return [];
    const hasActiveVariant = (p: SetPiece, colorId: string) =>
      p.variants.some((v) => v.colorId === colorId && v.status === 'AVAILABLE');
    const [first, ...rest] = set.pieces;
    return first.colors.filter(
      (c) => hasActiveVariant(first, c.id) && rest.every((p) => hasActiveVariant(p, c.id))
    );
  }, [set.pieces]);

  const [selectedColor, setSelectedColor] = useState<string>('');
  const [matrixQuantities, setMatrixQuantities] = useState<Record<string, number>>({});
  const [noSizeQuantity, setNoSizeQuantity] = useState<number>(minQuantity);
  const [perPieceQuantity, setPerPieceQuantity] = useState<number>(minQuantity);
  const [perPieceSizes, setPerPieceSizes] = useState<Record<string, string>>({});

  const piecesPerSet = set.pieces.reduce((sum, p) => sum + p.quantityPerSet, 0);

  const setCartItemBase = {
    setId: set.id,
    setSlug: set.slug,
    setName: set.name,
    imageUrl: set.imageUrl,
    sizeMode,
    setGroupId: set.setGroupId,
    brandId: set.brandId,
    unitPrice: set.referencePrice ?? 0,
    hasMissingPrices: set.hasMissingPrices,
    piecesPerSet,
    pieces: set.pieces.map((p) => ({ productId: p.productId, productName: p.productName, quantityPerSet: p.quantityPerSet })),
  };

  function handleAddMatrix() {
    const entries = Object.entries(matrixQuantities).filter(([, qty]) => qty > 0);
    if (entries.length === 0) {
      toast.error('Ingresa al menos una cantidad por talla.');
      return;
    }
    for (const [size, quantity] of entries) {
      addLine(setCartItemBase, { size, quantity, color: selectedColor || undefined });
    }
    toast.success('Agregado al carrito corporativo');
    setMatrixQuantities({});
  }

  function handleAddNoSizes() {
    if (noSizeQuantity <= 0) {
      toast.error('Ingresa una cantidad válida.');
      return;
    }
    addLine(setCartItemBase, { quantity: noSizeQuantity, color: selectedColor || undefined });
    toast.success('Agregado al carrito corporativo');
  }

  function handleAddPerPiece() {
    if (perPieceQuantity <= 0) {
      toast.error('Ingresa una cantidad válida.');
      return;
    }
    const pieceSelections = set.pieces.map((p) => ({
      productId: p.productId,
      size: perPieceSizes[p.productId] || p.availableSizes[0] || '',
    }));
    if (pieceSelections.some((s) => !s.size)) {
      toast.error('Selecciona la talla de cada pieza.');
      return;
    }
    addLine(setCartItemBase, { quantity: perPieceQuantity, pieceSelections, color: selectedColor || undefined });
    toast.success('Agregado al carrito corporativo');
  }

  const matrixTotal = Object.values(matrixQuantities).reduce((sum, q) => sum + (q || 0), 0);

  return (
    <main className="pt-14 sm:pt-16 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/corporativo" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#111111] mb-6">
          <ChevronLeft className="w-4 h-4" /> Volver al catálogo corporativo
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Imagen */}
          <div className="relative aspect-[4/3] bg-[#F5F5F7] rounded-xl overflow-hidden">
            {set.imageUrl ? (
              <Image src={set.imageUrl} alt={set.name} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <Building2 className="w-16 h-16" strokeWidth={1} />
              </div>
            )}
          </div>

          {/* Info + selector */}
          <div>
            {set.brandName && <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{set.brandName}</p>}
            <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] mb-2">{set.name}</h1>
            {set.description && <p className="text-gray-600 mb-4">{set.description}</p>}

            {/* Composición */}
            <div className="border border-[#E5E5E5] rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold mb-2">Composición del set</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                {set.pieces.map((p) => (
                  <li key={p.setItemId} className="flex justify-between">
                    <span>{p.quantityPerSet}× {p.productName}</span>
                    {showPrices && p.priceWholesale && (
                      <span className="text-gray-400">${(p.priceWholesaleSale ?? p.priceWholesale).toFixed(2)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {showPrices && (
              <div className="mb-4">
                {set.referencePrice !== null ? (
                  <p className="text-2xl font-bold text-[#111111]">
                    ${set.referencePrice.toFixed(2)}{' '}
                    <span className="text-sm font-normal text-gray-400">/ set referencial</span>
                  </p>
                ) : (
                  <p className="text-gray-500">Precio bajo cotización</p>
                )}
              </div>
            )}

            <div className="flex items-start gap-2 text-sm text-gray-500 bg-[#F5F5F7] rounded-lg p-3 mb-6">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Compra mínima: <strong>{minQuantity} sets</strong>. Precio referencial — sujeto a cotización formal.
              </span>
            </div>

            {/* ── Color (una elección por línea, común a los 3 modos de talla) ── */}
            {commonColors.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2">Color</h3>
                <div className="flex flex-wrap gap-2">
                  {commonColors.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedColor((prev) => (prev === c.code ? '' : c.code))}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors',
                        selectedColor === c.code
                          ? 'border-[#111111] bg-[#111111] text-white'
                          : 'border-[#E5E5E5] text-gray-600 hover:border-gray-400'
                      )}
                    >
                      <span className="w-3 h-3 rounded-full border border-white/40 flex-shrink-0" style={{ backgroundColor: c.hex }} />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Selector según SIZE_MODE ── */}
            {sizeMode === 'MATRIX' && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Selecciona cantidad por talla</h3>
                {commonSizes.length === 0 ? (
                  <p className="text-sm text-amber-600">
                    Las piezas de este set no comparten tallas en común. Contacta a ventas para más detalles.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
                    {commonSizes.map((size) => (
                      <div key={size} className="border border-[#E5E5E5] rounded-lg p-2 text-center">
                        <label className="text-xs text-gray-500 block mb-1">{size}</label>
                        <input
                          type="number"
                          min={0}
                          value={matrixQuantities[size] || ''}
                          onChange={(e) =>
                            setMatrixQuantities((prev) => ({ ...prev, [size]: Math.max(0, Number(e.target.value) || 0) }))
                          }
                          className="w-full text-center border border-[#E5E5E5] rounded px-1 py-1 text-sm"
                          placeholder="0"
                        />
                        {showAvailability && (
                          <span className="text-[11px] text-gray-400 block mt-1">
                            {availableSetsForSize(set.pieces, stockSnapshot, size)} disp.
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-sm text-gray-500 mb-3">Total: {matrixTotal} sets</p>
                <button
                  onClick={handleAddMatrix}
                  disabled={commonSizes.length === 0}
                  className="w-full px-6 py-3 bg-[#111111] text-white font-medium rounded-full hover:opacity-90 transition-opacity disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Agregar al carrito corporativo
                </button>
              </div>
            )}

            {sizeMode === 'NO_SIZES' && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Cantidad de sets</h3>
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="number"
                    min={1}
                    value={noSizeQuantity}
                    onChange={(e) => setNoSizeQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="w-32 border border-[#E5E5E5] rounded-lg px-3 py-2 text-center"
                  />
                  <span className="text-sm text-gray-500">sets</span>
                </div>
                {showAvailability && (
                  <p className="text-xs text-gray-400 mb-4">
                    Disponibilidad: {availableSetsNoSizes(set.pieces, stockSnapshot)} sets
                  </p>
                )}
                <button
                  onClick={handleAddNoSizes}
                  className="w-full px-6 py-3 bg-[#111111] text-white font-medium rounded-full hover:opacity-90 transition-opacity"
                >
                  Agregar al carrito corporativo
                </button>
              </div>
            )}

            {sizeMode === 'PER_PIECE' && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Selecciona talla por pieza</h3>
                <div className="space-y-3 mb-4">
                  {set.pieces.map((p) => (
                    <div key={p.setItemId} className="flex items-center justify-between border border-[#E5E5E5] rounded-lg p-3">
                      <span className="text-sm">{p.productName}</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={perPieceSizes[p.productId] || ''}
                          onChange={(e) => setPerPieceSizes((prev) => ({ ...prev, [p.productId]: e.target.value }))}
                          className="border border-[#E5E5E5] rounded-lg px-2 py-1 text-sm"
                        >
                          <option value="">Talla</option>
                          {p.availableSizes.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        {showAvailability && perPieceSizes[p.productId] && (
                          <span className="text-[11px] text-gray-400">
                            {availableForPieceSize(p, perPieceSizes[p.productId], stockSnapshot)} disp.
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="number"
                    min={1}
                    value={perPieceQuantity}
                    onChange={(e) => setPerPieceQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="w-32 border border-[#E5E5E5] rounded-lg px-3 py-2 text-center"
                  />
                  <span className="text-sm text-gray-500">sets con esta combinación</span>
                </div>
                <button
                  onClick={handleAddPerPiece}
                  className="w-full px-6 py-3 bg-[#111111] text-white font-medium rounded-full hover:opacity-90 transition-opacity"
                >
                  Agregar al carrito corporativo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

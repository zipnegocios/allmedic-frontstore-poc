'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Building2, ChevronLeft, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useCorporateCart } from '@/context/CorporateCartContext';
import type { CorporateSetDetail } from '@/lib/corporate-types';
import type { SizeMode } from '@/lib/rules-engine';

interface SetDetailContentProps {
  set: CorporateSetDetail;
  sizeMode: SizeMode;
  minQuantity: number;
  showPrices: boolean;
}

export function SetDetailContent({ set, sizeMode, minQuantity, showPrices }: SetDetailContentProps) {
  const { addLine } = useCorporateCart();

  // ── MATRIX: tallas comunes a todas las piezas (el set completo va en la misma talla) ──
  const commonSizes = useMemo(() => {
    if (set.pieces.length === 0) return [];
    const [first, ...rest] = set.pieces;
    return first.availableSizes.filter((size) => rest.every((p) => p.availableSizes.includes(size)));
  }, [set.pieces]);

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
  };

  function handleAddMatrix() {
    const entries = Object.entries(matrixQuantities).filter(([, qty]) => qty > 0);
    if (entries.length === 0) {
      toast.error('Ingresa al menos una cantidad por talla.');
      return;
    }
    for (const [size, quantity] of entries) {
      addLine(setCartItemBase, { size, quantity });
    }
    toast.success('Agregado al carrito corporativo');
    setMatrixQuantities({});
  }

  function handleAddNoSizes() {
    if (noSizeQuantity <= 0) {
      toast.error('Ingresa una cantidad válida.');
      return;
    }
    addLine(setCartItemBase, { quantity: noSizeQuantity });
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
    addLine(setCartItemBase, { quantity: perPieceQuantity, pieceSelections });
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

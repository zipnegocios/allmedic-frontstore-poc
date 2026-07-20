'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Building2, ChevronLeft, Info, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCorporateCart } from '@/context/CorporateCartContext';
import type { CorporateSetDetail, SetPiece } from '@/lib/corporate-types';
import type { ColorRestrictionConfig, SizeMode } from '@/lib/rules-engine';
import type { ProductColor, Size } from '@/lib/types';
import type { MediaItem } from '@/lib/media';
import { ColorSwatchGroup } from '@/components/catalog/ColorSwatch';
import { SizeSelector } from '@/components/catalog/SizeSelector';
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import { cn } from '@/lib/utils';

interface SetDetailContentProps {
  set: CorporateSetDetail;
  sizeMode: SizeMode;
  minQuantity: number;
  showPrices: boolean;
  colorRestrictions: ColorRestrictionConfig[];
}

type PieceSelection = { size?: string };
type PieceSelectionMap = Record<string, PieceSelection>;

interface CombinationRow {
  id: string;
  quantity: number;
  pieceSelections: Array<{ productId: string; size?: string; color?: string }>;
}

function newRowId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function SetDetailContent({
  set,
  sizeMode,
  minQuantity,
  showPrices,
  colorRestrictions,
}: SetDetailContentProps) {
  const { addLine } = useCorporateCart();
  const showsSizes = sizeMode !== 'NO_SIZES';
  const isPaired = set.colorMode === 'PAIRED';
  const isMixed = set.colorMode === 'MIXED';

  // ── Tallas comunes a todas las piezas — solo se usan para el atajo de MATRIX ──
  const commonSizes = useMemo(() => {
    if (set.pieces.length === 0) return [];
    const [first, ...rest] = set.pieces;
    return first.availableSizes.filter((size) => rest.every((p) => p.availableSizes.includes(size)));
  }, [set.pieces]);

  // PAIRED: colores presentes en TODAS las piezas (con al menos una variante no agotada) — el
  // resto de colores no tienen paridad completa y no se ofrecen, tal como exige la regla.
  const pairedColorOptions = useMemo(() => {
    if (!isPaired || set.pieces.length === 0) return [];
    const [first, ...rest] = set.pieces;
    return first.colors.filter((c) =>
      rest.every((p) => p.colors.some((pc) => pc.code === c.code)) &&
      set.pieces.every((p) => {
        const match = p.colors.find((pc) => pc.code === c.code);
        return match && p.variants.some((v) => v.colorId === match.id && v.status !== 'OUT_OF_STOCK');
      })
    );
  }, [isPaired, set.pieces]);

  const [selections, setSelections] = useState<PieceSelectionMap>({});
  const [pairedColor, setPairedColor] = useState<string | undefined>(undefined);
  const [selectedComboId, setSelectedComboId] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState<number>(Math.max(1, minQuantity));
  const [rows, setRows] = useState<CombinationRow[]>([]);

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

  function setPieceSize(productId: string, size: string) {
    setSelections((prev) => ({ ...prev, [productId]: { ...prev[productId], size } }));
  }

  function applyMatrixShortcut(size: string) {
    setSelections((prev) => {
      const next: PieceSelectionMap = { ...prev };
      for (const piece of set.pieces) {
        next[piece.productId] = { ...next[piece.productId], size };
      }
      return next;
    });
  }

  /** Color efectivo de una pieza según la modalidad del set — PAIRED comparte un único color
   * entre todas las piezas; MIXED lo toma de la combinación curada elegida. */
  function colorForPiece(productId: string): string | undefined {
    if (isPaired) return pairedColor;
    if (isMixed) {
      const combo = set.colorCombos.find((c) => c.id === selectedComboId);
      return combo?.items.find((i) => i.productId === productId)?.colorCode;
    }
    return undefined;
  }

  function pieceColorImage(piece: SetPiece): MediaItem | undefined {
    const colorCode = colorForPiece(piece.productId);
    if (!colorCode) return undefined;
    const color = piece.colors.find((c) => c.code === colorCode);
    if (!color) return undefined;
    const variant = piece.variants.find((v) => v.colorId === color.id && v.images.length > 0);
    return variant?.images[0];
  }

  function sizeStatusesFor(piece: SetPiece) {
    const colorCode = colorForPiece(piece.productId);
    const color = colorCode ? piece.colors.find((c) => c.code === colorCode) : undefined;
    const relevantVariants = color ? piece.variants.filter((v) => v.colorId === color.id) : piece.variants;
    const statuses: Partial<Record<Size, 'AVAILABLE' | 'BACKORDER' | 'OUT_OF_STOCK'>> = {};
    for (const v of relevantVariants) {
      const existing = statuses[v.size];
      // Si hay varias variantes con la misma talla (varios colores), prioriza la más disponible.
      if (!existing || v.status === 'AVAILABLE') statuses[v.size] = v.status;
    }
    return statuses;
  }

  function currentSelectionsArray() {
    return set.pieces.map((p) => ({
      productId: p.productId,
      size: selections[p.productId]?.size,
      color: colorForPiece(p.productId),
    }));
  }

  function handleAddCombination() {
    if (quantity <= 0) {
      toast.error('Ingresa una cantidad válida.');
      return;
    }
    if (isPaired && pairedColorOptions.length > 0 && !pairedColor) {
      toast.error('Elige el color del set.');
      return;
    }
    if (isMixed && set.colorCombos.length > 0 && !selectedComboId) {
      toast.error('Elige una combinación de color.');
      return;
    }
    const pieceSelections = currentSelectionsArray();
    if (showsSizes && pieceSelections.some((s) => !s.size)) {
      toast.error('Selecciona la talla de cada pieza.');
      return;
    }
    setRows((prev) => [...prev, { id: newRowId(), quantity, pieceSelections }]);
    toast.success('Combinación agregada — sigue armando o agrégala al carrito.');
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRowQuantity(id: string, newQuantity: number) {
    if (newQuantity <= 0) {
      removeRow(id);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, quantity: newQuantity } : r)));
  }

  /** Espejo cliente de la verificación defensiva de `validate.ts` — con esta UI no debería ser
   * posible armar una fila con colores distintos, pero se revalida por si el estado quedó
   * desactualizado (ej. dos pestañas, o el set cambió de modalidad mientras se armaba). */
  function rowPairingViolations(row: CombinationRow): string[] {
    if (!isPaired) return [];
    const distinct = new Set(row.pieceSelections.map((s) => s.color).filter(Boolean));
    if (distinct.size > 1) {
      return ['Todas las piezas de esta combinación deben llevar el mismo color.'];
    }
    return [];
  }

  function rowColorViolations(row: CombinationRow): string[] {
    const messages: string[] = [];
    for (const sel of row.pieceSelections) {
      if (!sel.color) continue;
      const piece = set.pieces.find((p) => p.productId === sel.productId);
      if (!piece) continue;
      const units = row.quantity * piece.quantityPerSet;
      for (const restriction of colorRestrictions) {
        if (restriction.colorCode === sel.color && units < restriction.min) {
          messages.push(
            `"${piece.productName}" en color "${sel.color}" requiere un mínimo de ${restriction.min} unidades; esta combinación lleva ${units}.`
          );
        }
      }
    }
    return messages;
  }

  function handleAddToCart() {
    if (rows.length === 0) {
      toast.error('Arma al menos una combinación.');
      return;
    }
    const hasColorViolation = rows.some((r) => rowColorViolations(r).length > 0 || rowPairingViolations(r).length > 0);
    if (hasColorViolation) {
      toast.error('Corrige las combinaciones marcadas antes de continuar.');
      return;
    }
    for (const row of rows) {
      addLine(setCartItemBase, { quantity: row.quantity, pieceSelections: row.pieceSelections });
    }
    toast.success('Agregado al carrito corporativo');
    setRows([]);
  }

  return (
    <main className="pt-14 sm:pt-16 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/corporativo" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#111111] mb-6">
          <ChevronLeft className="w-4 h-4" /> Volver al catálogo corporativo
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Imagen de portada — misma proporción que el catálogo individual */}
          <div className="relative aspect-[4/5] bg-[#F5F5F7] rounded-xl overflow-hidden">
            {set.imageUrl ? (
              <Image src={set.imageUrl} alt={set.name} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <Building2 className="w-16 h-16" strokeWidth={1} />
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {set.brandName && <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{set.brandName}</p>}
            <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] mb-2">{set.name}</h1>
            {set.description && <p className="text-gray-600 mb-4">{set.description}</p>}

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
          </div>
        </div>

        {/* ── Armador de combinaciones ── */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-[#111111] mb-1">Arma tu combinación</h2>
          <p className="text-sm text-gray-500 mb-6">
            Elige color y talla de cada pieza, define la cantidad de sets y agrega la combinación. Puedes repetir el
            proceso para armar varias combinaciones distintas antes de llevarlas al carrito.
          </p>

          {sizeMode === 'MATRIX' && commonSizes.length > 0 && (
            <div className="mb-6 border border-[#E5E5E5] rounded-lg p-4 bg-[#F5F5F7]">
              <h3 className="text-sm font-semibold mb-2">Todo el set en la misma talla</h3>
              <div className="flex flex-wrap gap-2">
                {commonSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => applyMatrixShortcut(size)}
                    className="px-4 h-9 text-sm font-medium rounded-full border border-[#E5E5E5] bg-white text-[#111111] hover:border-[#111111] transition-colors"
                  >
                    {size}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Rellena la talla de todas las piezas de un tap — luego puedes ajustar cada pieza individualmente.
              </p>
            </div>
          )}

          {isPaired && pairedColorOptions.length > 0 && (
            <div className="mb-6 border border-[#E5E5E5] rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2">Color del set</h3>
              <ColorSwatchGroup
                colors={pairedColorOptions}
                selectedColorId={pairedColorOptions.find((c) => c.code === pairedColor)?.id}
                availableColorIds={pairedColorOptions.map((c) => c.id)}
                onColorSelect={(color: ProductColor) => setPairedColor((prev) => (prev === color.code ? undefined : color.code))}
                size="sm"
              />
              <p className="text-xs text-gray-400 mt-2">Todas las piezas de este set se piden en el mismo color.</p>
            </div>
          )}

          {isMixed && (
            <div className="mb-6 border border-[#E5E5E5] rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2">Elige una combinación de color</h3>
              {set.colorCombos.length === 0 ? (
                <p className="text-sm text-gray-500">No hay combinaciones de color disponibles para este set — contacta a ventas.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {set.colorCombos.map((combo) => (
                    <button
                      key={combo.id}
                      type="button"
                      onClick={() => setSelectedComboId((prev) => (prev === combo.id ? undefined : combo.id))}
                      className={cn(
                        'text-left border rounded-lg p-3 transition-colors',
                        selectedComboId === combo.id ? 'border-[#111111] bg-[#F5F5F7]' : 'border-[#E5E5E5] hover:border-gray-300'
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        {combo.items.map((item) => {
                          const piece = set.pieces.find((p) => p.productId === item.productId);
                          const color = piece?.colors.find((c) => c.code === item.colorCode);
                          return (
                            <span key={item.productId} className="inline-flex items-center gap-1">
                              <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: color?.hex ?? '#ccc' }} />
                              {piece?.productName ?? item.productId}: {color?.name ?? item.colorCode}
                            </span>
                          );
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 mb-6">
            {set.pieces.map((piece) => {
              const image = pieceColorImage(piece);
              const selectedSize = selections[piece.productId]?.size;

              return (
                <div key={piece.setItemId} className="border border-[#E5E5E5] rounded-lg p-4">
                  <div className="flex gap-4">
                    <div className="relative w-20 sm:w-24 aspect-[4/5] flex-shrink-0 bg-[#F5F5F7] rounded-lg overflow-hidden">
                      <MediaGridThumb
                        item={image}
                        fallback="/images/placeholder-product.jpg"
                        alt={piece.productName}
                        className="object-cover"
                        sizes="120px"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#111111] mb-2">
                        {piece.quantityPerSet}× {piece.productName}
                      </p>

                      {showsSizes && piece.availableSizes.length > 0 && (
                        <SizeSelector
                          sizes={piece.availableSizes as Size[]}
                          selectedSize={selectedSize as Size | undefined}
                          sizeStatuses={sizeStatusesFor(piece) as Record<Size, 'AVAILABLE' | 'BACKORDER' | 'OUT_OF_STOCK'>}
                          onSizeSelect={(size) => setPieceSize(piece.productId, size)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border border-[#E5E5E5] rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <label className="text-sm text-gray-500">Cantidad de sets con esta combinación</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 border border-[#E5E5E5] rounded-lg px-3 py-2 text-center"
              />
            </div>
            <button
              onClick={handleAddCombination}
              className="w-full sm:w-auto px-6 py-2.5 bg-white border border-[#111111] text-[#111111] font-medium rounded-full hover:bg-[#F5F5F7] transition-colors"
            >
              Agregar combinación
            </button>
          </div>

          {rows.length > 0 && (
            <div className="space-y-2 mb-6">
              <h3 className="text-sm font-semibold text-[#111111]">Combinaciones armadas</h3>
              {rows.map((row) => {
                const violations = [...rowColorViolations(row), ...rowPairingViolations(row)];
                return (
                  <div
                    key={row.id}
                    className={cn(
                      'border rounded-lg p-3',
                      violations.length > 0 ? 'border-red-300 bg-red-50' : 'border-[#E5E5E5]'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0 text-sm text-gray-600">
                        {row.pieceSelections
                          .map((s) => {
                            const piece = set.pieces.find((p) => p.productId === s.productId);
                            const parts = [s.size, s.color].filter(Boolean).join(' / ');
                            return `${piece?.productName ?? s.productId}${parts ? ` (${parts})` : ''}`;
                          })
                          .join(' + ')}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(e) => updateRowQuantity(row.id, Math.max(0, Number(e.target.value) || 0))}
                          className="w-16 border border-[#E5E5E5] rounded px-2 py-1 text-center text-sm"
                        />
                        <span className="text-xs text-gray-400">sets</span>
                        <button onClick={() => removeRow(row.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {violations.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {violations.map((msg, idx) => (
                          <p key={idx} className="text-xs text-red-600">{msg}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={handleAddToCart}
            disabled={rows.length === 0}
            className="w-full px-6 py-3 bg-[#111111] text-white font-medium rounded-full hover:opacity-90 transition-opacity disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Agregar al carrito corporativo
          </button>
        </div>
      </div>
    </main>
  );
}

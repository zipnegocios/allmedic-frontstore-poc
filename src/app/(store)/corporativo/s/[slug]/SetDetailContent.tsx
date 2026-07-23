'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronLeft, ChevronUp, ChevronDown, Check, Info, Minus, Plus, X } from 'lucide-react';
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

const GALLERY_RAIL_WINDOW = 4;
const GALLERY_ARROWS_THRESHOLD = 4;

function newRowId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface CombinationRow {
  id: string;
  quantity: number;
  pieceSelections: Array<{ productId: string; size?: string; color?: string }>;
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
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
  const [blockA, blockB] = set.blocks;

  // ── Preselección por defecto (Decisión 8): cada bloque trae su primera opción elegida ──
  const [choiceAId, setChoiceAId] = useState(blockA.options[0].productId);
  const [choiceBId, setChoiceBId] = useState(blockB.options[0].productId);
  const pieceA = useMemo(
    () => blockA.options.find((o) => o.productId === choiceAId) ?? blockA.options[0],
    [blockA, choiceAId]
  );
  const pieceB = useMemo(
    () => blockB.options.find((o) => o.productId === choiceBId) ?? blockB.options[0],
    [blockB, choiceBId]
  );
  // PAIRED: colores presentes en AMBAS piezas elegidas (con al menos una variante no agotada) —
  // la intersección se recalcula cada vez que cambia la pieza elegida de cualquier bloque.
  const pairedColorOptions = useMemo(() => {
    if (!isPaired) return [];
    return pieceA.colors.filter((c) => {
      const matchB = pieceB.colors.find((pc) => pc.code === c.code);
      if (!matchB) return false;
      const availableInA = pieceA.variants.some((v) => v.colorId === c.id && v.status !== 'OUT_OF_STOCK');
      const availableInB = pieceB.variants.some((v) => v.colorId === matchB.id && v.status !== 'OUT_OF_STOCK');
      return availableInA && availableInB;
    });
  }, [isPaired, pieceA, pieceB]);

  const [pairedColor, setPairedColor] = useState<string | undefined>(() => pairedColorOptions[0]?.code);
  const [selectedComboId, setSelectedComboId] = useState<string | undefined>(undefined);
  const [sizeA, setSizeA] = useState<string | undefined>(undefined);
  const [sizeB, setSizeB] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState<number>(Math.max(1, minQuantity));
  const [rows, setRows] = useState<CombinationRow[]>([]);

  // ── Galería de doble carril (Decisión 13) ──
  const [focus, setFocus] = useState<{ side: 'A' | 'B'; index: number }>({ side: 'A', index: 0 });
  const [offsetA, setOffsetA] = useState(0);
  const [offsetB, setOffsetB] = useState(0);

  const piecesPerSet = blockA.quantityPerSet + blockB.quantityPerSet;

  const setCartItemBase = {
    setId: set.id,
    setSlug: set.slug,
    setName: set.name,
    imageUrl: set.cover?.url ?? null,
    sizeMode,
    brandId: set.brandId,
    unitPrice: set.referencePrice ?? 0,
    hasMissingPrices: set.hasMissingPrices,
    piecesPerSet,
    pieces: [
      { productId: blockA.options[0].productId, productName: blockA.options[0].productName, quantityPerSet: blockA.quantityPerSet },
      { productId: blockA.options[1].productId, productName: blockA.options[1].productName, quantityPerSet: blockA.quantityPerSet },
      { productId: blockB.options[0].productId, productName: blockB.options[0].productName, quantityPerSet: blockB.quantityPerSet },
      { productId: blockB.options[1].productId, productName: blockB.options[1].productName, quantityPerSet: blockB.quantityPerSet },
    ],
  };

  /** Cambiar de opción en un bloque resetea su talla y reajusta el color si ya no es válido
   * (Decisión 8) — nunca deja el armador en un estado inválido. */
  function selectPieceA(productId: string) {
    setChoiceAId(productId);
    setSizeA(undefined);
    setFocus({ side: 'A', index: 0 });
    setOffsetA(0);
    if (isPaired) {
      const nextPiece = blockA.options.find((o) => o.productId === productId);
      const stillValid = nextPiece && pairedColor && nextPiece.colors.some((c) => c.code === pairedColor) &&
        pieceB.colors.some((c) => c.code === pairedColor);
      if (!stillValid) {
        const nextIntersection = (nextPiece?.colors ?? []).filter((c) => pieceB.colors.some((pc) => pc.code === c.code));
        setPairedColor(nextIntersection[0]?.code);
      }
    }
  }

  function selectPieceB(productId: string) {
    setChoiceBId(productId);
    setSizeB(undefined);
    setFocus({ side: 'B', index: 0 });
    setOffsetB(0);
    if (isPaired) {
      const nextPiece = blockB.options.find((o) => o.productId === productId);
      const stillValid = nextPiece && pairedColor && nextPiece.colors.some((c) => c.code === pairedColor) &&
        pieceA.colors.some((c) => c.code === pairedColor);
      if (!stillValid) {
        const nextIntersection = (nextPiece?.colors ?? []).filter((c) => pieceA.colors.some((pc) => pc.code === c.code));
        setPairedColor(nextIntersection[0]?.code);
      }
    }
  }

  /** Color efectivo de una pieza según la modalidad del set — PAIRED comparte un único color
   * entre las 2 piezas elegidas; MIXED lo toma de la combinación curada elegida. */
  function colorForPiece(productId: string): string | undefined {
    if (isPaired) return pairedColor;
    if (isMixed) {
      const combo = set.colorCombos.find((c) => c.id === selectedComboId);
      return combo?.items.find((i) => i.productId === productId)?.colorCode;
    }
    return undefined;
  }

  const tintHex = useMemo(() => {
    const colorCode = isPaired ? pairedColor : undefined;
    const color = colorCode ? pieceA.colors.find((c) => c.code === colorCode) : undefined;
    return color?.hex;
  }, [isPaired, pairedColor, pieceA]);

  function sizeStatusesFor(piece: SetPiece) {
    const colorCode = colorForPiece(piece.productId);
    const color = colorCode ? piece.colors.find((c) => c.code === colorCode) : undefined;
    const relevantVariants = color ? piece.variants.filter((v) => v.colorId === color.id) : piece.variants;
    const statuses: Partial<Record<Size, 'AVAILABLE' | 'BACKORDER' | 'OUT_OF_STOCK'>> = {};
    for (const v of relevantVariants) {
      const existing = statuses[v.size];
      if (!existing || v.status === 'AVAILABLE') statuses[v.size] = v.status;
    }
    return statuses;
  }

  const galleryImagesA = useMemo(() => {
    const colorCode = colorForPiece(pieceA.productId);
    const color = colorCode ? pieceA.colors.find((c) => c.code === colorCode) : undefined;
    const variant = color ? pieceA.variants.find((v) => v.colorId === color.id) : pieceA.variants[0];
    return variant?.images ?? [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceA, pairedColor, selectedComboId]);

  const galleryImagesB = useMemo(() => {
    const colorCode = colorForPiece(pieceB.productId);
    const color = colorCode ? pieceB.colors.find((c) => c.code === colorCode) : undefined;
    const variant = color ? pieceB.variants.find((v) => v.colorId === color.id) : pieceB.variants[0];
    return variant?.images ?? [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceB, pairedColor, selectedComboId]);

  const focusedImage = focus.side === 'A' ? galleryImagesA[focus.index] : galleryImagesB[focus.index];

  function currentSelectionsArray() {
    return [
      { productId: pieceA.productId, size: sizeA, color: colorForPiece(pieceA.productId) },
      { productId: pieceB.productId, size: sizeB, color: colorForPiece(pieceB.productId) },
    ];
  }

  const comboReady = Boolean(
    (!isPaired || pairedColorOptions.length === 0 || pairedColor) &&
    (!isMixed || set.colorCombos.length === 0 || selectedComboId) &&
    (!showsSizes || (sizeA && sizeB))
  );

  const comboUnitPrice = (pieceA.priceWholesaleSale ?? pieceA.priceWholesale ?? 0) + (pieceB.priceWholesaleSale ?? pieceB.priceWholesale ?? 0);

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
    setQuantity(Math.max(1, minQuantity));
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

  function pieceLabelFor(productId: string): string {
    return [pieceA, pieceB].find((p) => p.productId === productId)?.productName ?? productId;
  }

  function rowColorViolations(row: CombinationRow): string[] {
    const messages: string[] = [];
    for (const sel of row.pieceSelections) {
      if (!sel.color) continue;
      const qtyPerSet = sel.productId === pieceA.productId ? blockA.quantityPerSet : blockB.quantityPerSet;
      const units = row.quantity * qtyPerSet;
      for (const restriction of colorRestrictions) {
        if (restriction.colorCode === sel.color && units < restriction.min) {
          messages.push(
            `"${pieceLabelFor(sel.productId)}" en color "${sel.color}" requiere un mínimo de ${restriction.min} unidades; esta combinación lleva ${units}.`
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

  // ── Piezas recomendadas: color/talla/cantidad independientes, sin relación con los bloques ──
  const [extraChoices, setExtraChoices] = useState<Record<string, { color?: string; size?: string; quantity?: number }>>({});
  function setExtraChoice(productId: string, patch: Partial<{ color: string; size: string; quantity: number }>) {
    setExtraChoices((prev) => ({ ...prev, [productId]: { ...prev[productId], ...patch } }));
  }
  function addRecommendedToCart(piece: SetPiece) {
    const choice = extraChoices[piece.productId] ?? {};
    if (!choice.color || (showsSizes && piece.availableSizes.length > 0 && !choice.size)) {
      toast.error('Elige color y talla antes de agregar.');
      return;
    }
    addLine(
      {
        setId: `${set.id}::recommended::${piece.productId}`,
        setSlug: set.slug,
        setName: piece.productName,
        imageUrl: set.cover?.url ?? null,
        sizeMode,
        brandId: set.brandId,
        unitPrice: piece.priceWholesaleSale ?? piece.priceWholesale ?? 0,
        hasMissingPrices: piece.priceWholesale === null,
        piecesPerSet: 1,
        pieces: [{ productId: piece.productId, productName: piece.productName, quantityPerSet: 1 }],
      },
      {
        quantity: choice.quantity ?? 1,
        pieceSelections: [{ productId: piece.productId, size: choice.size, color: choice.color }],
      }
    );
    toast.success(`${piece.productName} agregado a la cotización`);
    setExtraChoices((prev) => ({ ...prev, [piece.productId]: {} }));
  }

  return (
    <main className="pt-14 sm:pt-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/corporativo" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#111111] mb-6">
          <ChevronLeft className="w-4 h-4" /> Volver al catálogo corporativo
        </Link>

        {/* ── (a) Color del set — a todo el ancho ── */}
        {isPaired && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-[#111111]">Color del set</h2>
            <p className="text-xs text-gray-500 mb-3">Todas las piezas de este set se piden en el mismo color.</p>
            {pairedColorOptions.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border rounded-lg p-3">
                <Info className="w-4 h-4 flex-shrink-0" />
                <span>Estas dos piezas no comparten ningún color en común — elige otra combinación.</span>
              </div>
            ) : (
              <ColorSwatchGroup
                colors={pairedColorOptions}
                selectedColorId={pairedColorOptions.find((c) => c.code === pairedColor)?.id}
                availableColorIds={pairedColorOptions.map((c) => c.id)}
                onColorSelect={(color: ProductColor) => setPairedColor(color.code)}
                size="sm"
              />
            )}
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
                        const piece = [pieceA, pieceB].find((p) => p.productId === item.productId);
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

        {/* ── (b) Tiras de selección de pieza por bloque ── */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <BlockStrip pieces={blockA.options} selectedId={pieceA.productId} onSelect={selectPieceA} tintHex={tintHex} />
          <BlockStrip pieces={blockB.options} selectedId={pieceB.productId} onSelect={selectPieceB} tintHex={tintHex} />
        </div>

        {/* ── (c) Galería + tallas / Info + armador ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Gallery
              pieceA={pieceA}
              pieceB={pieceB}
              imagesA={galleryImagesA}
              imagesB={galleryImagesB}
              focusedImage={focusedImage}
              tintHex={tintHex}
              focus={focus}
              setFocus={setFocus}
              offsetA={offsetA}
              setOffsetA={setOffsetA}
              offsetB={offsetB}
              setOffsetB={setOffsetB}
            />

            {showsSizes && (
              <SizeGroupBox
                pieceA={pieceA}
                sizeA={sizeA}
                onSizeA={setSizeA}
                statusesA={sizeStatusesFor(pieceA)}
                pieceB={pieceB}
                sizeB={sizeB}
                onSizeB={setSizeB}
                statusesB={sizeStatusesFor(pieceB)}
              />
            )}
          </div>

          <div className="space-y-5">
            {set.brandName && <p className="font-sans text-body-sm text-gray-400 uppercase tracking-badge">{set.brandName}</p>}
            <h1 className="font-sans font-medium text-h1-pdp sm:text-2xl text-[#111111]">{set.name}</h1>
            {set.description && <p className="text-gray-600">{set.description}</p>}

            <CompositionCard
              pieceA={pieceA}
              qtyA={blockA.quantityPerSet}
              sizeA={sizeA}
              pieceB={pieceB}
              qtyB={blockB.quantityPerSet}
              sizeB={sizeB}
              showsSizes={showsSizes}
              showPrices={showPrices}
              colorName={isPaired ? pairedColorOptions.find((c) => c.code === pairedColor)?.name : undefined}
            />

            {showPrices && (
              <p className="text-2xl font-bold text-[#111111]">
                {set.referencePrice !== null ? (
                  <>
                    {money(set.referencePrice)} <span className="text-sm font-normal text-gray-400">/ set referencial</span>
                  </>
                ) : (
                  <span className="text-base font-normal text-gray-500">Precio bajo cotización</span>
                )}
              </p>
            )}

            <div className="flex items-start gap-2 text-sm text-gray-600 bg-[#F5F5F7] rounded-lg p-3">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Compra mínima: <strong>{minQuantity} sets</strong>. Precio referencial — sujeto a cotización formal.
              </span>
            </div>

            <div>
              <h2 className="text-base font-semibold text-[#111111]">Arma tu combinación</h2>
              <p className="text-sm text-gray-500 mt-1">
                Elige color y talla de cada pieza, define la cantidad de sets y agrega la combinación. Puedes repetir el
                proceso para armar varias combinaciones distintas antes de llevarlas al carrito.
              </p>
            </div>

            <CombinationBuilderCard
              quantity={quantity}
              setQuantity={setQuantity}
              comboReady={comboReady}
              comboUnitPrice={comboUnitPrice}
              showPrices={showPrices}
              onAdd={handleAddCombination}
              rows={rows}
              pieceLabelFor={pieceLabelFor}
              onUpdateQuantity={updateRowQuantity}
              onRemoveRow={removeRow}
              rowViolations={(row) => [...rowColorViolations(row), ...rowPairingViolations(row)]}
              onCheckout={handleAddToCart}
            />
          </div>
        </div>

        {/* ── (d) Piezas recomendadas ── */}
        {set.recommendedPieces.length > 0 && (
          <div className="mt-12">
            <RecommendedSection
              items={set.recommendedPieces}
              showsSizes={showsSizes}
              showPrices={showPrices}
              extraChoices={extraChoices}
              setExtraChoice={setExtraChoice}
              onAdd={addRecommendedToCart}
            />
          </div>
        )}
      </div>
    </main>
  );
}

// ── Tiras "qué pieza elegir" por bloque, con preselección ──
function BlockStrip({
  pieces,
  selectedId,
  onSelect,
  tintHex,
}: {
  pieces: [SetPiece, SetPiece];
  selectedId: string;
  onSelect: (productId: string) => void;
  tintHex: string | undefined;
}) {
  return (
    <div className="flex-1 border border-[#E5E5E5] rounded-lg p-2 flex gap-2">
      {pieces.map((p) => {
        const selected = selectedId === p.productId;
        const image = p.variants.find((v) => v.images.length > 0)?.images[0];
        return (
          <button
            key={p.productId}
            type="button"
            onClick={() => onSelect(p.productId)}
            className={cn(
              'relative flex items-center gap-2 flex-1 p-2 rounded-md border text-left transition-colors',
              selected ? 'border-[#111111] bg-[#F5F5F7]' : 'border-transparent hover:bg-[#F5F5F7]'
            )}
          >
            <div className="relative w-10 h-10 rounded-md flex-shrink-0 bg-[#F5F5F7] overflow-hidden">
              {image ? (
                <MediaGridThumb item={image} fallback="/images/placeholder-product.jpg" alt={p.productName} fit="cover" sizes="40px" className="object-cover" />
              ) : (
                <div className="w-full h-full" style={{ backgroundColor: selected ? tintHex : undefined }} />
              )}
            </div>
            <span className="text-xs font-medium truncate pr-4">{p.productName}</span>
            {selected && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#111111] flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-white" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Galería de doble carril (Decisión 13) ──
function GalleryRail({
  images,
  side,
  focusSide,
  focusIndex,
  onFocus,
  offset,
  setOffset,
}: {
  images: MediaItem[];
  side: 'A' | 'B';
  focusSide: 'A' | 'B';
  focusIndex: number;
  onFocus: (f: { side: 'A' | 'B'; index: number }) => void;
  offset: number;
  setOffset: (updater: (o: number) => number) => void;
}) {
  const total = images.length;
  if (total === 0) return <div className="w-16 flex-shrink-0" />;
  const showArrows = total > GALLERY_ARROWS_THRESHOLD;
  const canUp = offset > 0;
  const canDown = offset + GALLERY_RAIL_WINDOW < total;
  const visible = Array.from({ length: Math.min(GALLERY_RAIL_WINDOW, total) }, (_, i) => offset + i).filter((i) => i < total);

  return (
    <div className="flex flex-col items-center gap-1.5 w-16 flex-shrink-0">
      {showArrows && (
        <button type="button" disabled={!canUp} onClick={() => setOffset((o) => Math.max(0, o - 1))} className="disabled:opacity-20 text-gray-400 hover:text-[#111111]">
          <ChevronUp className="w-4 h-4" />
        </button>
      )}
      <div className="flex flex-col gap-1.5">
        {visible.map((idx) => {
          const active = focusSide === side && focusIndex === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onFocus({ side, index: idx })}
              className={cn('relative w-16 h-16 rounded-md overflow-hidden border-2 bg-[#F5F5F7]', active ? 'border-[#111111]' : 'border-transparent')}
            >
              <MediaGridThumb item={images[idx]} fallback="/images/placeholder-product.jpg" alt="" fit="cover" sizes="64px" className="object-cover" />
            </button>
          );
        })}
      </div>
      {showArrows && (
        <button type="button" disabled={!canDown} onClick={() => setOffset((o) => Math.min(total - GALLERY_RAIL_WINDOW, o + 1))} className="disabled:opacity-20 text-gray-400 hover:text-[#111111]">
          <ChevronDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function Gallery({
  pieceA,
  pieceB,
  imagesA,
  imagesB,
  focusedImage,
  tintHex,
  focus,
  setFocus,
  offsetA,
  setOffsetA,
  offsetB,
  setOffsetB,
}: {
  pieceA: SetPiece;
  pieceB: SetPiece;
  imagesA: MediaItem[];
  imagesB: MediaItem[];
  focusedImage: MediaItem | undefined;
  tintHex: string | undefined;
  focus: { side: 'A' | 'B'; index: number };
  setFocus: (f: { side: 'A' | 'B'; index: number }) => void;
  offsetA: number;
  setOffsetA: (updater: (o: number) => number) => void;
  offsetB: number;
  setOffsetB: (updater: (o: number) => number) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <GalleryRail images={imagesA} side="A" focusSide={focus.side} focusIndex={focus.index} onFocus={setFocus} offset={offsetA} setOffset={setOffsetA} />
      <div className="flex-1">
        <div className="relative w-full aspect-product bg-[#F5F5F7] rounded-xl overflow-hidden">
          {focusedImage ? (
            <MediaGridThumb item={focusedImage} fallback="/images/placeholder-product.jpg" alt={focus.side === 'A' ? pieceA.productName : pieceB.productName} fit="contain" className="object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300" style={{ backgroundColor: tintHex }}>
              <Building2 className="w-16 h-16" strokeWidth={1} />
            </div>
          )}
        </div>
      </div>
      <GalleryRail images={imagesB} side="B" focusSide={focus.side} focusIndex={focus.index} onFocus={setFocus} offset={offsetB} setOffset={setOffsetB} />
    </div>
  );
}

// ── Grupo de tallas con conector "+" ──
function SizePanel({
  piece,
  size,
  onSize,
  statuses,
}: {
  piece: SetPiece;
  size: string | undefined;
  onSize: (size: string) => void;
  statuses: Partial<Record<Size, 'AVAILABLE' | 'BACKORDER' | 'OUT_OF_STOCK'>>;
}) {
  return (
    <div className="flex-1 p-4 space-y-2">
      <p className="text-sm font-medium text-[#111111] truncate">{piece.productName}</p>
      {piece.availableSizes.length > 0 ? (
        <SizeSelector
          sizes={piece.availableSizes as Size[]}
          selectedSize={size as Size | undefined}
          sizeStatuses={statuses as Record<Size, 'AVAILABLE' | 'BACKORDER' | 'OUT_OF_STOCK'>}
          onSizeSelect={onSize}
        />
      ) : (
        <p className="text-xs text-gray-400">Sin tallas cargadas</p>
      )}
    </div>
  );
}

function SizeGroupBox({
  pieceA,
  sizeA,
  onSizeA,
  statusesA,
  pieceB,
  sizeB,
  onSizeB,
  statusesB,
}: {
  pieceA: SetPiece;
  sizeA: string | undefined;
  onSizeA: (size: string) => void;
  statusesA: Partial<Record<Size, 'AVAILABLE' | 'BACKORDER' | 'OUT_OF_STOCK'>>;
  pieceB: SetPiece;
  sizeB: string | undefined;
  onSizeB: (size: string) => void;
  statusesB: Partial<Record<Size, 'AVAILABLE' | 'BACKORDER' | 'OUT_OF_STOCK'>>;
}) {
  return (
    <div className="border border-[#E5E5E5] rounded-lg flex flex-col sm:flex-row sm:items-stretch">
      <SizePanel piece={pieceA} size={sizeA} onSize={onSizeA} statuses={statusesA} />
      {/* Carril central propio para el conector "+" — nunca se superpone a las tallas (a
          diferencia de un posicionamiento absoluto centrado sobre todo el contenedor). */}
      <div className="flex items-center justify-center py-1 sm:py-0 sm:px-1 border-t border-b-0 sm:border-t-0 sm:border-l sm:border-r border-[#E5E5E5]">
        <span className="w-8 h-8 rounded-full bg-[#111111] text-white flex items-center justify-center flex-shrink-0">
          <Plus className="w-4 h-4" />
        </span>
      </div>
      <SizePanel piece={pieceB} size={sizeB} onSize={onSizeB} statuses={statusesB} />
    </div>
  );
}

// ── Composición del set (dinámica) ──
function CompositionLine({
  piece,
  quantityPerSet,
  size,
  colorName,
  showsSizes,
  showPrices,
}: {
  piece: SetPiece;
  quantityPerSet: number;
  size: string | undefined;
  colorName: string | undefined;
  showsSizes: boolean;
  showPrices: boolean;
}) {
  const price = piece.priceWholesaleSale ?? piece.priceWholesale;
  return (
    <div className="flex items-start justify-between gap-3 text-sm py-2">
      <span className="text-gray-700">
        {quantityPerSet}× {piece.productName} {colorName ? `(${colorName}${size ? `, ${size}` : ''})` : ''}
        {showsSizes && !size && <span className="text-amber-600"> — elige talla</span>}
      </span>
      {showPrices && price !== null && <span className="font-medium flex-shrink-0">{money(price)}</span>}
    </div>
  );
}

function CompositionCard({
  pieceA,
  qtyA,
  sizeA,
  pieceB,
  qtyB,
  sizeB,
  showsSizes,
  showPrices,
  colorName,
}: {
  pieceA: SetPiece;
  qtyA: number;
  sizeA: string | undefined;
  pieceB: SetPiece;
  qtyB: number;
  sizeB: string | undefined;
  showsSizes: boolean;
  showPrices: boolean;
  colorName: string | undefined;
}) {
  return (
    <div className="border border-[#E5E5E5] rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-1">Composición del set</h3>
      <div className="divide-y">
        <CompositionLine piece={pieceA} quantityPerSet={qtyA} size={sizeA} colorName={colorName} showsSizes={showsSizes} showPrices={showPrices} />
        <CompositionLine piece={pieceB} quantityPerSet={qtyB} size={sizeB} colorName={colorName} showsSizes={showsSizes} showPrices={showPrices} />
      </div>
    </div>
  );
}

// ── Armador: cantidad, agregar, combinaciones armadas, carrito ──
function CombinationBuilderCard({
  quantity,
  setQuantity,
  comboReady,
  comboUnitPrice,
  showPrices,
  onAdd,
  rows,
  pieceLabelFor,
  onUpdateQuantity,
  onRemoveRow,
  rowViolations,
  onCheckout,
}: {
  quantity: number;
  setQuantity: (q: number) => void;
  comboReady: boolean;
  comboUnitPrice: number;
  showPrices: boolean;
  onAdd: () => void;
  rows: CombinationRow[];
  pieceLabelFor: (productId: string) => string;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveRow: (id: string) => void;
  rowViolations: (row: CombinationRow) => string[];
  onCheckout: () => void;
}) {
  return (
    <div className="border border-[#E5E5E5] rounded-lg p-4 space-y-4">
      <div>
        <label className="text-xs text-gray-500">Cantidad de sets con esta combinación</label>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          className="mt-1 w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-center"
        />
      </div>

      <button
        type="button"
        onClick={onAdd}
        disabled={!comboReady}
        className="w-full px-6 py-2.5 bg-white border border-[#111111] text-[#111111] font-medium rounded-full hover:bg-[#F5F5F7] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Agregar combinación
      </button>

      {showPrices && comboReady && (
        <p className="text-xs text-gray-500 text-center">
          {money(comboUnitPrice)} / set × {quantity} = {money(comboUnitPrice * quantity)}
        </p>
      )}

      {rows.length > 0 && (
        <div className="pt-2 border-t space-y-2">
          <p className="text-xs font-medium text-gray-500">Combinaciones armadas</p>
          {rows.map((row) => {
            const violations = rowViolations(row);
            return (
              <div key={row.id} className={cn('rounded-lg p-2', violations.length > 0 && 'bg-red-50')}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-700 flex-1 min-w-0 truncate">
                    {row.pieceSelections
                      .map((s) => {
                        const parts = [s.size, s.color].filter(Boolean).join(' / ');
                        return `${pieceLabelFor(s.productId)}${parts ? ` (${parts})` : ''}`;
                      })
                      .join(' + ')}
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) => onUpdateQuantity(row.id, Math.max(0, Number(e.target.value) || 0))}
                      className="w-14 border border-[#E5E5E5] rounded px-1 py-0.5 text-center text-xs"
                    />
                    sets
                    <button type="button" onClick={() => onRemoveRow(row.id)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
                {violations.length > 0 && (
                  <div className="mt-1 space-y-0.5">
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
        type="button"
        onClick={onCheckout}
        disabled={rows.length === 0}
        className="w-full px-6 py-3 bg-[#111111] text-white font-medium rounded-full hover:opacity-90 transition-opacity disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        Agregar al carrito corporativo
      </button>
    </div>
  );
}

// ── Piezas recomendadas ──
function RecommendedSection({
  items,
  showsSizes,
  showPrices,
  extraChoices,
  setExtraChoice,
  onAdd,
}: {
  items: SetPiece[];
  showsSizes: boolean;
  showPrices: boolean;
  extraChoices: Record<string, { color?: string; size?: string; quantity?: number }>;
  setExtraChoice: (productId: string, patch: Partial<{ color: string; size: string; quantity: number }>) => void;
  onAdd: (piece: SetPiece) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[#111111] mb-1">Piezas recomendadas</h2>
      <p className="text-sm text-gray-500 mb-4">
        De la misma colección. Se agregan de forma independiente a tu cotización, con su propio color, talla y
        cantidad — no forman parte del combo de arriba ni comparten su regla de color.
      </p>

      <div className="space-y-4">
        {items.map((item) => {
          const choice = extraChoices[item.productId] || {};
          const price = item.priceWholesaleSale ?? item.priceWholesale;
          const availableColors = item.colors.filter((c) => item.variants.some((v) => v.colorId === c.id && v.status !== 'OUT_OF_STOCK'));
          return (
            <div key={item.productId} className="border border-[#E5E5E5] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">{item.productName}</p>
                {showPrices && price !== null && <p className="text-sm text-gray-500">{money(price)}</p>}
              </div>
              <div className="flex flex-wrap items-end gap-4">
                {availableColors.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Color</p>
                    <div className="flex gap-2">
                      {availableColors.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setExtraChoice(item.productId, { color: c.code })}
                          className={cn('w-6 h-6 rounded-full border-2', choice.color === c.code ? 'border-[#111111]' : 'border-transparent')}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {showsSizes && item.availableSizes.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Talla</p>
                    <div className="flex gap-2">
                      {item.availableSizes.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setExtraChoice(item.productId, { size: s })}
                          className={cn(
                            'px-2.5 h-7 text-xs rounded-full border',
                            choice.size === s ? 'bg-[#111111] text-white border-[#111111]' : 'border-[#E5E5E5]'
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Cantidad</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setExtraChoice(item.productId, { quantity: Math.max(1, (choice.quantity || 1) - 1) })}
                      className="w-7 h-7 flex items-center justify-center border border-[#E5E5E5] rounded"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm">{choice.quantity || 1}</span>
                    <button
                      type="button"
                      onClick={() => setExtraChoice(item.productId, { quantity: (choice.quantity || 1) + 1 })}
                      className="w-7 h-7 flex items-center justify-center border border-[#E5E5E5] rounded"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onAdd(item)}
                  className="ml-auto px-4 py-2 text-sm border border-[#111111] text-[#111111] rounded-full hover:bg-[#F5F5F7] transition-colors"
                >
                  Agregar a la cotización
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

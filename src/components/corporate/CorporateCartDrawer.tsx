'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { X, Building2, AlertCircle, Trash2, Minus, Plus, Gift } from 'lucide-react';
import { useCorporateCart } from '@/context/CorporateCartContext';
import { cn } from '@/lib/utils';

interface CorporateCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function useMounted() {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}

function ClientOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const mounted = useMounted();
  return mounted ? <>{children}</> : <>{fallback}</>;
}

function unitLabel(countUnit: 'SETS' | 'PIECES', n: number): string {
  if (countUnit === 'PIECES') return n === 1 ? 'pieza' : 'piezas';
  return n === 1 ? 'set' : 'sets';
}

export function CorporateCartDrawer({ isOpen, onClose }: CorporateCartDrawerProps) {
  const {
    items,
    updateLineQuantity,
    removeLine,
    validation,
    pricing,
    rulesLoading,
    globalMinQuantity,
    globalCountUnit,
    inventoryIssues,
    canSubmit,
  } = useCorporateCart();

  const progressPct = Math.min(100, (validation.totalSets / Math.max(1, validation.minRequired)) * 100);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-50 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          'fixed top-0 right-0 h-full bg-white z-50 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'w-full max-w-[440px]',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5]">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" strokeWidth={1.5} />
            <h2 className="text-lg font-semibold">Carrito Corporativo</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors">
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex flex-col h-[calc(100%-73px)]">
          <ClientOnly>
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <Building2 className="w-16 h-16 text-gray-300 mb-4" strokeWidth={1.5} />
                <p className="text-gray-500 mb-2">Tu carrito corporativo está vacío</p>
                <p className="text-sm text-gray-400">
                  Mínimo de compra: {globalMinQuantity} {unitLabel(globalCountUnit, globalMinQuantity)}
                </p>
                <Link
                  href="/corporativo"
                  onClick={onClose}
                  className="mt-6 px-6 py-2 bg-[#111111] text-white text-sm font-medium rounded-full hover:opacity-80 transition-opacity"
                >
                  Explorar sets corporativos
                </Link>
              </div>
            ) : (
              <>
                {/* Barra de progreso hacia el mínimo */}
                <div className="px-6 py-4 border-b border-[#E5E5E5] bg-[#F5F5F7]">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">
                      {validation.totalSets} de {validation.minRequired} {unitLabel(validation.countUnit, validation.minRequired)}
                    </span>
                    {validation.setsRemaining > 0 ? (
                      <span className="font-medium text-[#FF9500]">
                        {validation.setsRemaining === 1 ? 'Falta' : 'Faltan'} {validation.setsRemaining}
                      </span>
                    ) : (
                      <span className="font-medium text-[#34C759]">Mínimo alcanzado</span>
                    )}
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        validation.canSubmit ? 'bg-[#34C759]' : 'bg-[#FF9500]'
                      )}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {items.map((item) => (
                    <div key={item.setId} className="border border-[#E5E5E5] rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <Link
                            href={`/corporativo/s/${item.setSlug}`}
                            onClick={onClose}
                            className="font-medium text-sm hover:underline"
                          >
                            {item.setName}
                          </Link>
                          {item.hasMissingPrices && (
                            <p className="text-xs text-amber-600 mt-0.5">Precio referencial incompleto</p>
                          )}
                        </div>
                        <button onClick={() => removeLine(item.setId, item.lines[0]?.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {item.lines.map((line) => (
                          <div key={line.id} className="flex items-center justify-between text-sm bg-[#F5F5F7] rounded-lg px-3 py-2">
                            <div>
                              {line.pieceSelections.length > 0 ? (
                                <span className="text-xs text-gray-600">
                                  {line.pieceSelections
                                    .map((s) => [s.size, s.color].filter(Boolean).join(' / '))
                                    .filter(Boolean)
                                    .join(' · ') || 'Set completo'}
                                </span>
                              ) : (
                                <span className="text-gray-500">Set completo</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateLineQuantity(item.setId, line.id, line.quantity - 1)}
                                className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-300 hover:bg-white"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-6 text-center">{line.quantity}</span>
                              <button
                                onClick={() => updateLineQuantity(item.setId, line.id, line.quantity + 1)}
                                className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-300 hover:bg-white"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {item.unitPrice > 0 && (
                        <p className="text-xs text-gray-400 mt-2">
                          Precio referencial: ${item.unitPrice.toFixed(2)} / set — sujeto a cotización
                        </p>
                      )}
                    </div>
                  ))}

                  {/* Violaciones de reglas */}
                  {!rulesLoading && validation.violations.length > 0 && (
                    <div className="space-y-2">
                      {validation.violations
                        .filter((v) => v.code !== 'MIN_QUANTITY')
                        .map((v, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{v.message}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Avisos y errores de inventario (INVENTORY_MODE) */}
                  {inventoryIssues.length > 0 && (
                    <div className="space-y-2">
                      {inventoryIssues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'flex items-start gap-2 text-sm rounded-lg px-3 py-2',
                            issue.severity === 'BLOCK' ? 'text-red-600 bg-red-50' : 'text-amber-700 bg-amber-50'
                          )}
                        >
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-[#E5E5E5] px-6 py-4 space-y-3 bg-[#F5F5F7]">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal referencial</span>
                    <span className="font-medium">${pricing.subtotalBeforeDiscount.toFixed(2)}</span>
                  </div>
                  {pricing.volumeDiscountPct > 0 && (
                    <div className="flex justify-between text-sm text-[#34C759]">
                      <span>Escala de volumen ({pricing.volumeDiscountPct}%)</span>
                      <span>-${pricing.volumeDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {pricing.promoDiscountAmount > 0 && (
                    <div>
                      <div className="flex justify-between text-sm text-[#34C759]">
                        <span>Descuento por promoción</span>
                        <span>-${pricing.promoDiscountAmount.toFixed(2)}</span>
                      </div>
                      {pricing.promoBreakdown.length > 1 && (
                        <div className="pl-3 mt-1 space-y-0.5">
                          {pricing.promoBreakdown.map((p, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-gray-400">
                              <span>{p.ruleName}</span>
                              <span>-${p.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#E5E5E5]">
                    <span>Total referencial</span>
                    <span>${pricing.total.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Precio referencial — sujeto a cotización. El equipo de ventas confirmará los valores finales.
                  </p>

                  {pricing.promoNotes.length > 0 && (
                    <div className="space-y-1.5">
                      {pricing.promoNotes.map((note, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-[#34C759] bg-green-50 rounded-lg px-3 py-2">
                          <Gift className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{note}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Link
                    href="/corporativo/solicitud"
                    onClick={(e) => {
                      if (!canSubmit) e.preventDefault();
                      else onClose();
                    }}
                    aria-disabled={!canSubmit}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 px-6 py-3 text-white font-medium rounded-full transition-opacity',
                      canSubmit
                        ? 'bg-[#111111] hover:opacity-90'
                        : 'bg-gray-300 cursor-not-allowed pointer-events-none'
                    )}
                  >
                    {!validation.canSubmit
                      ? `${validation.setsRemaining === 1 ? 'Falta' : 'Faltan'} ${validation.setsRemaining} ${unitLabel(validation.countUnit, validation.setsRemaining)} para el mínimo`
                      : !canSubmit
                        ? 'Resuelve el stock insuficiente para continuar'
                        : 'Solicitar cotización'}
                  </Link>
                </div>
              </>
            )}
          </ClientOnly>
        </div>
      </div>
    </>
  );
}

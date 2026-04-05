'use client';

import { useState } from 'react';
import { X, ShoppingBag, TrendingUp, MessageCircle } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { CartItemComponent } from './CartItem';
import { Modal } from '@/components/ui/Modal';
import { generateWhatsAppMessage, openWhatsApp, registerLead } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, totalItems, subtotal, updateQuantity, removeItem, getActiveVolumeDiscount, getNextVolumeTier, clearCart } = useCart();
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeDiscount = getActiveVolumeDiscount();
  const nextTier = getNextVolumeTier();
  const discountAmount = activeDiscount ? subtotal * (activeDiscount.discountPct / 100) : 0;
  const finalTotal = subtotal - discountAmount;

  const handleCheckout = async () => {
    if (!customerName.trim() || !customerCity.trim() || !customerPhone.trim()) return;

    setIsSubmitting(true);
    
    try {
      await registerLead({
        items,
        customerName: customerName.trim(),
        customerCity: customerCity.trim(),
        customerPhone: customerPhone.trim(),
      });

      const message = generateWhatsAppMessage({
        items,
        customerName: customerName.trim(),
        customerCity: customerCity.trim(),
        customerPhone: customerPhone.trim(),
      });

      openWhatsApp(message);
      clearCart();
      setShowCheckoutModal(false);
      setCustomerName('');
      setCustomerCity('');
      setCustomerPhone('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-50 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full bg-white z-50 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'w-full max-w-[420px]',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5]">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
            <h2 className="text-lg font-semibold">Mi Pedido ({totalItems})</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col h-[calc(100%-140px)]">
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" strokeWidth={1.5} />
              <p className="text-gray-500 mb-2">Tu pedido está vacío</p>
              <p className="text-sm text-gray-400">Agrega productos para comenzar tu cotización</p>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2 bg-[#111111] text-white text-sm font-medium rounded-full hover:opacity-80 transition-opacity"
              >
                Explorar catálogo
              </button>
            </div>
          ) : (
            <>
              {/* Items List */}
              <div className="flex-1 overflow-y-auto px-6">
                {items.map(item => (
                  <CartItemComponent
                    key={item.id}
                    item={item}
                    onUpdateQuantity={(qty) => updateQuantity(item.id, qty)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-[#E5E5E5] px-6 py-4 space-y-4 bg-[#F5F5F7]">
                {/* Volume Discount Info */}
                {activeDiscount && (
                  <div className="flex items-center gap-2 text-sm text-[#34C759]">
                    <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
                    <span>Descuento {activeDiscount.discountPct}% aplicado</span>
                  </div>
                )}
                {nextTier && (
                  <div className="flex items-center gap-2 text-sm text-[#FF9500]">
                    <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
                    <span>Agrega {nextTier.itemsNeeded} más y ahorra {nextTier.discountPct}%</span>
                  </div>
                )}

                {/* Subtotal */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-[#34C759]">
                      <span>Descuento ({activeDiscount?.discountPct}%)</span>
                      <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#E5E5E5]">
                    <span>Total estimado</span>
                    <span>${finalTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Checkout Button */}
                <button
                  onClick={() => setShowCheckoutModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#25D366] text-white font-medium rounded-full hover:opacity-90 transition-opacity"
                >
                  <MessageCircle className="w-5 h-5" strokeWidth={1.5} />
                  Enviar por WhatsApp
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Checkout Modal */}
      <Modal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        title="Completa tu pedido"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Ingresa tus datos para enviar tu cotización por WhatsApp.
          </p>

          <div>
            <label className="block text-sm font-medium text-[#111111] mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ej: María García"
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#111111] mb-1">
              Ciudad
            </label>
            <input
              type="text"
              value={customerCity}
              onChange={(e) => setCustomerCity(e.target.value)}
              placeholder="Ej: Quito"
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#111111] mb-1">
              Número de WhatsApp
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Ej: +593 99 999 9999"
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#111111] transition-colors"
            />
          </div>

          <div className="pt-4 border-t border-[#E5E5E5]">
            <div className="flex justify-between text-sm mb-4">
              <span className="text-gray-500">Total de items:</span>
              <span className="font-medium">{totalItems}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={!customerName.trim() || !customerCity.trim() || !customerPhone.trim() || isSubmitting}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-6 py-3 text-white font-medium rounded-full transition-opacity',
                !customerName.trim() || !customerCity.trim() || !customerPhone.trim() || isSubmitting
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-[#25D366] hover:opacity-90'
              )}
            >
              <MessageCircle className="w-5 h-5" strokeWidth={1.5} />
              {isSubmitting ? 'Enviando...' : 'Enviar por WhatsApp'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

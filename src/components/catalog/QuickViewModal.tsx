import { useState, useEffect } from 'react';
import { X, ShoppingBag, Check, AlertCircle } from 'lucide-react';
import type { Product, ProductColor, Size, Fit, VariantStatus } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

interface QuickViewModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export function QuickViewModal({ product, isOpen, onClose }: QuickViewModalProps) {
  const { addItem } = useCart();
  const [selectedColor, setSelectedColor] = useState<ProductColor | null>(null);
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [selectedFit, setSelectedFit] = useState<Fit | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when product changes
  useEffect(() => {
    if (product) {
      const firstColor = product.colors[0];
      setSelectedColor(firstColor);
      
      // Auto-select first available size
      const colorVariants = product.variants.filter(v => v.colorId === firstColor?.id);
      const firstAvailable = colorVariants.find(v => v.status !== 'OUT_OF_STOCK');
      setSelectedSize(firstAvailable?.size || null);
      
      setSelectedFit(product.availableFits?.[0] || null);
      setQuantity(1);
      setError(null);
      setShowSuccess(false);
    }
  }, [product]);

  if (!product) return null;

  const hasDiscount = product.priceSale && product.priceSale < product.priceNormal;
  const discountPercentage = hasDiscount
    ? Math.round(((product.priceNormal - product.priceSale!) / product.priceNormal) * 100)
    : 0;

  // Get variants for selected color
  const colorVariants = selectedColor 
    ? product.variants.filter(v => v.colorId === selectedColor.id)
    : [];
  
  // Get variant status for each size
  const getSizeStatus = (size: Size): VariantStatus | null => {
    const variant = colorVariants.find(v => v.size === size);
    return variant?.status || null;
  };

  // Get selected variant
  const selectedVariant = colorVariants.find(
    v => v.size === selectedSize && (!selectedFit || v.fit === selectedFit)
  );

  const isOutOfStock = selectedVariant?.status === 'OUT_OF_STOCK';

  // Get display image
  const displayImage = selectedVariant?.images[0] || product.variants[0]?.images[0] || '/images/placeholder-product.jpg';

  const handleAddToCart = () => {
    if (!selectedColor) {
      setError('Selecciona un color');
      return;
    }
    if (!selectedSize) {
      setError('Selecciona una talla');
      return;
    }
    if (!selectedVariant || isOutOfStock) {
      setError('Esta combinación no está disponible');
      return;
    }

    setIsAdding(true);
    setError(null);

    setTimeout(() => {
      addItem(product, selectedVariant.id, selectedColor, selectedSize, selectedFit || undefined, quantity);
      setIsAdding(false);
      setShowSuccess(true);
      
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 1500);
    }, 300);
  };

  const statusConfig = {
    AVAILABLE: { dot: 'bg-[#34C759]', text: 'Disponible' },
    BACKORDER: { dot: 'bg-[#FF9500]', text: 'Bajo pedido (7-10 días)' },
    OUT_OF_STOCK: { dot: 'bg-[#FF3B30]', text: 'Agotado' },
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" showCloseButton={false}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Image */}
        <div className="aspect-[4/5] bg-[#F5F5F7] rounded-lg overflow-hidden">
          <img
            src={displayImage}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/placeholder-product.jpg';
            }}
          />
        </div>

        {/* Info */}
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">
                {product.brand}
              </p>
              <h2 className="text-xl font-bold text-[#111111]">{product.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors"
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-6">
            {hasDiscount ? (
              <>
                <span className="text-2xl font-bold text-[#111111]">
                  ${product.priceSale?.toFixed(2)}
                </span>
                <span className="text-lg text-gray-400 line-through">
                  ${product.priceNormal.toFixed(2)}
                </span>
                <span className="px-2 py-0.5 bg-[#FF3B30] text-white text-xs font-bold rounded">
                  -{discountPercentage}%
                </span>
              </>
            ) : (
              <span className="text-2xl font-bold text-[#111111]">
                ${product.priceNormal.toFixed(2)}
              </span>
            )}
          </div>

          {/* Color Selector */}
          <div className="mb-4">
            <p className="text-sm font-medium text-[#111111] mb-2">
              Color: <span className="text-gray-500">{selectedColor?.name}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((color) => (
                <button
                  key={color.id}
                  onClick={() => {
                    setSelectedColor(color);
                    // Auto-select first available size for new color
                    const variants = product.variants.filter(v => v.colorId === color.id);
                    const firstAvailable = variants.find(v => v.status !== 'OUT_OF_STOCK');
                    setSelectedSize(firstAvailable?.size || null);
                    setError(null);
                  }}
                  className={cn(
                    'w-10 h-10 rounded-full border-2 transition-all duration-200',
                    selectedColor?.id === color.id
                      ? 'border-[#111111] ring-2 ring-offset-2 ring-[#111111]'
                      : 'border-transparent hover:scale-110',
                    color.hex === '#FFFFFF' && 'border-gray-300'
                  )}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Size Selector */}
          <div className="mb-4">
            <p className="text-sm font-medium text-[#111111] mb-2">Talla</p>
            <div className="flex flex-wrap gap-2">
              {product.availableSizes.map((size) => {
                const status = getSizeStatus(size);
                const isAvailable = status !== 'OUT_OF_STOCK';
                
                return (
                  <button
                    key={size}
                    onClick={() => {
                      if (isAvailable) {
                        setSelectedSize(size);
                        setError(null);
                      }
                    }}
                    disabled={!isAvailable}
                    className={cn(
                      'min-w-[44px] h-10 px-3 text-sm font-medium rounded-lg transition-all duration-200',
                      selectedSize === size
                        ? 'bg-[#111111] text-white'
                        : isAvailable
                        ? 'border border-[#E5E5E5] text-[#333333] hover:border-[#111111]'
                        : 'border border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed line-through'
                    )}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fit Selector (if applicable) */}
          {product.availableFits && product.availableFits.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-[#111111] mb-2">Corte</p>
              <div className="flex flex-wrap gap-2">
                {product.availableFits.map((fit) => (
                  <button
                    key={fit}
                    onClick={() => setSelectedFit(fit)}
                    className={cn(
                      'px-4 h-9 text-sm font-medium rounded-full transition-all duration-200',
                      selectedFit === fit
                        ? 'bg-[#111111] text-white'
                        : 'border border-[#E5E5E5] text-[#333333] hover:border-[#111111]'
                    )}
                  >
                    {fit}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Availability Status */}
          {selectedVariant && (
            <div className="flex items-center gap-2 mb-4">
              <span className={cn('w-2 h-2 rounded-full', statusConfig[selectedVariant.status].dot)} />
              <span className="text-sm text-gray-600">{statusConfig[selectedVariant.status].text}</span>
            </div>
          )}

          {/* Quantity */}
          <div className="mb-4">
            <p className="text-sm font-medium text-[#111111] mb-2">Cantidad</p>
            <div className="flex items-center border border-[#E5E5E5] rounded-lg w-fit">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 flex items-center justify-center hover:bg-[#F5F5F7] transition-colors text-lg"
              >
                −
              </button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 flex items-center justify-center hover:bg-[#F5F5F7] transition-colors text-lg"
              >
                +
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-[#FF3B30] text-sm mb-4">
              <AlertCircle className="w-4 h-4" strokeWidth={1.5} />
              {error}
            </div>
          )}

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={isAdding || showSuccess}
            className={cn(
              'mt-auto w-full flex items-center justify-center gap-2 px-6 py-4 font-medium rounded-full transition-all duration-300',
              showSuccess
                ? 'bg-[#34C759] text-white'
                : isOutOfStock
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-[#111111] text-white hover:opacity-80'
            )}
          >
            {showSuccess ? (
              <>
                <Check className="w-5 h-5" strokeWidth={1.5} />
                Agregado
              </>
            ) : isAdding ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Agregando...
              </>
            ) : (
              <>
                <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
                AGREGAR A MI PEDIDO
              </>
            )}
          </button>

          {/* View Full Details Link */}
          <a
            href={`/p/${product.slug}`}
            onClick={(e) => {
              e.preventDefault();
              onClose();
              window.location.href = `/p/${product.slug}`;
            }}
            className="mt-3 text-center text-sm text-gray-500 hover:text-[#111111] transition-colors underline"
          >
            Ver detalles completos
          </a>
        </div>
      </div>
    </Modal>
  );
}

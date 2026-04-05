import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, Check, Plus, Minus, ShoppingBag, Info, X, Clock } from 'lucide-react';
import { getProductBySlug, PRODUCTS } from '@/lib/dummy-data';
import { useCart } from '@/context/CartContext';
import { useNotificationContext } from '@/App';
import { ImageGallery } from '@/components/product/ImageGallery';
import { PriceDisplay } from '@/components/product/PriceDisplay';
import { CountdownTimer } from '@/components/product/CountdownTimer';
import { VolumeDiscountTable } from '@/components/product/VolumeDiscountTable';
import { VariantSelector } from '@/components/product/VariantSelector';
import { CrossSellCard } from '@/components/product/CrossSellCard';
import type { ProductColor, Size, Fit, VariantStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

// Accordion Component
function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[#E5E5E5]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <span className="font-medium text-[#111111]">{title}</span>
        <span
          className={cn(
            'text-2xl transition-transform duration-300',
            isOpen ? 'rotate-45' : ''
          )}
        >
          +
        </span>
      </button>
      {isOpen && <div className="pb-4 text-sm text-gray-600">{children}</div>}
    </div>
  );
}

// Availability Status Component
function AvailabilityStatus({ status }: { status: VariantStatus | undefined }) {
  if (!status) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <span className="w-2 h-2 rounded-full bg-gray-300" />
        <span className="text-sm">Selecciona opciones para ver disponibilidad</span>
      </div>
    );
  }

  const statusConfig = {
    AVAILABLE: {
      icon: Check,
      dot: 'bg-[#34C759]',
      text: 'Disponible - Listo para envío',
      textColor: 'text-[#34C759]',
      bgColor: 'bg-[#34C759]/10',
    },
    BACKORDER: {
      icon: Clock,
      dot: 'bg-[#FF9500]',
      text: 'Bajo pedido - Llega en 7-10 días',
      textColor: 'text-[#FF9500]',
      bgColor: 'bg-[#FF9500]/10',
    },
    OUT_OF_STOCK: {
      icon: X,
      dot: 'bg-[#FF3B30]',
      text: 'Agotado - No disponible',
      textColor: 'text-[#FF3B30]',
      bgColor: 'bg-[#FF3B30]/10',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg', config.bgColor)}>
      <Icon className={cn('w-4 h-4', config.textColor)} strokeWidth={2} />
      <span className={cn('text-sm font-medium', config.textColor)}>{config.text}</span>
    </div>
  );
}

export function Product() {
  const { slug } = useParams<{ slug: string }>();
  const { addItem } = useCart();
  const { showSuccess, showError, showWarning } = useNotificationContext();

  const product = slug ? getProductBySlug(slug) : undefined;

  // State
  const [selectedColor, setSelectedColor] = useState<ProductColor | undefined>();
  const [selectedSize, setSelectedSize] = useState<Size | undefined>();
  const [selectedFit, setSelectedFit] = useState<Fit | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // Initialize selections
  useEffect(() => {
    if (product) {
      setSelectedColor(product.colors[0]);
      // Auto-select first available size for the first color
      const firstColorVariants = product.variants.filter(v => v.colorId === product.colors[0]?.id);
      const firstAvailableSize = firstColorVariants.find(v => v.status !== 'OUT_OF_STOCK')?.size;
      setSelectedSize(firstAvailableSize);
      setSelectedFit(product.availableFits?.[0]);
      setQuantity(1);
    }
  }, [product]);

  if (!product) {
    return (
      <main className="min-h-screen bg-white pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-16">
          <h1 className="text-2xl font-bold mb-4">Producto no encontrado</h1>
          <p className="text-gray-500 mb-6">El producto que buscas no existe o ha sido eliminado.</p>
          <Link
            to="/catalogo"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#111111] text-white font-medium rounded-full hover:opacity-80 transition-opacity"
          >
            Ver catálogo
          </Link>
        </div>
      </main>
    );
  }

  // Get variant for selected options
  const selectedVariant = product.variants.find(
    (v) =>
      v.colorId === selectedColor?.id &&
      v.size === selectedSize &&
      (!selectedFit || v.fit === selectedFit)
  );

  const variantStatus = selectedVariant?.status;
  const isOutOfStock = variantStatus === 'OUT_OF_STOCK';
  const isBackorder = variantStatus === 'BACKORDER';
  const canAddToCart = selectedVariant && !isOutOfStock;

  // Get images for selected color
  const colorVariant = product.variants.find((v) => v.colorId === selectedColor?.id);
  const images = colorVariant?.images || ['/images/placeholder-product.jpg'];

  // Get complementary product
  const complementaryProduct = product.complementaryProduct
    ? PRODUCTS.find((p) => p.id === product.complementaryProduct)
    : undefined;

  const handleAddToCart = () => {
    if (!selectedColor) {
      showWarning('Por favor selecciona un color');
      return;
    }
    if (!selectedSize) {
      showWarning('Por favor selecciona una talla');
      return;
    }
    if (!selectedVariant) {
      showError('La combinación seleccionada no está disponible');
      return;
    }

    if (isOutOfStock) {
      showError(`Producto agotado: ${product.name} - ${selectedColor.name} / Talla ${selectedSize}`);
      return;
    }

    setIsAdding(true);

    // Simulate adding to cart
    setTimeout(() => {
      addItem(product, selectedVariant.id, selectedColor, selectedSize, selectedFit, quantity);
      
      // Show notification based on status
      if (isBackorder) {
        showWarning(
          `Agregado: ${product.name} - ${selectedColor.name} / Talla ${selectedSize}. Bajo pedido: llega en 7-10 días`,
          5000
        );
      } else {
        showSuccess(
          `Agregado: ${product.name} - ${selectedColor.name} / Talla ${selectedSize}`,
          3000
        );
      }
      
      setIsAdding(false);
    }, 300);
  };

  const handleAddComplementary = (size: Size) => {
    if (!complementaryProduct || !selectedColor) return;

    const variant = complementaryProduct.variants.find(
      (v) => v.colorId === selectedColor.id && v.size === size
    );

    if (variant) {
      addItem(complementaryProduct, variant.id, selectedColor, size, undefined, 1);
      
      if (variant.status === 'BACKORDER') {
        showWarning(
          `Agregado: ${complementaryProduct.name} - ${selectedColor.name} / Talla ${size}. Bajo pedido: llega en 7-10 días`,
          5000
        );
      } else if (variant.status === 'OUT_OF_STOCK') {
        showError(`${complementaryProduct.name} está agotado`);
      } else {
        showSuccess(`${complementaryProduct.name} agregado a tu pedido`);
      }
    }
  };

  // Mobile layout: Brand → Title → Image → Variants → Quantity → Price → Button
  // Desktop layout: Image (left) → Info (right)

  return (
    <main className="min-h-screen bg-white pt-16">
      {/* Breadcrumb - Hidden on mobile */}
      <div className="hidden sm:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/" className="hover:text-[#111111] transition-colors">
            Inicio
          </Link>
          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
          <Link to="/catalogo" className="hover:text-[#111111] transition-colors">
            Catálogo
          </Link>
          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
          <Link
            to={`/catalogo?category=${product.category}`}
            className="hover:text-[#111111] transition-colors"
          >
            {product.category}
          </Link>
          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
          <span className="text-[#111111] truncate">{product.name}</span>
        </nav>
      </div>

      {/* Product Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Mobile Layout */}
        <div className="lg:hidden">
          {/* Brand */}
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
            {product.brand}
          </p>

          {/* Name */}
          <h1 className="text-2xl font-bold text-[#111111] mb-4">
            {product.name}
          </h1>

          {/* Image Gallery */}
          <div className="mb-6">
            <ImageGallery images={images} productName={product.name} />
          </div>

          {/* Variant Selector */}
          {selectedColor && (
            <div className="mb-6">
              <VariantSelector
                product={product}
                selectedColor={selectedColor}
                selectedSize={selectedSize}
                selectedFit={selectedFit}
                onColorSelect={setSelectedColor}
                onSizeSelect={setSelectedSize}
                onFitSelect={product.availableFits ? setSelectedFit : undefined}
              />
            </div>
          )}

          {/* Availability Status */}
          <div className="mb-4">
            <AvailabilityStatus status={variantStatus} />
          </div>

          {/* Quantity */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-[#111111] mb-2">Cantidad</h3>
            <div className="flex items-center border border-[#E5E5E5] rounded-lg w-fit">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 flex items-center justify-center hover:bg-[#F5F5F7] transition-colors"
              >
                <Minus className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 flex items-center justify-center hover:bg-[#F5F5F7] transition-colors"
              >
                <Plus className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Price Display */}
          <div className="mb-4">
            <PriceDisplay
              priceNormal={product.priceNormal}
              priceSale={product.priceSale}
              discountPct={product.discountPct}
            />
          </div>

          {/* Countdown */}
          {product.discountEnd && new Date(product.discountEnd) > new Date() && (
            <div className="mb-4">
              <CountdownTimer endDate={product.discountEnd} />
            </div>
          )}

          {/* CTA Button */}
          <button
            onClick={handleAddToCart}
            disabled={!canAddToCart || isAdding}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-6 py-4 font-medium rounded-full transition-all duration-300',
              !canAddToCart
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-[#111111] text-white hover:opacity-80'
            )}
          >
            <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
            {!canAddToCart
              ? 'Selecciona opciones disponibles'
              : isAdding
              ? 'Agregando...'
              : 'AGREGAR A MI PEDIDO'}
          </button>

          {/* Volume Discounts */}
          {product.volumeDiscounts && product.volumeDiscounts.length > 0 && (
            <div className="mt-6">
              <VolumeDiscountTable
                discounts={product.volumeDiscounts}
                basePrice={product.priceSale || product.priceNormal}
                currentQuantity={quantity}
              />
            </div>
          )}
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-2 lg:gap-12">
          {/* Gallery */}
          <div>
            <ImageGallery images={images} productName={product.name} />
          </div>

          {/* Info */}
          <div className="lg:pl-8">
            {/* Brand */}
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
              {product.brand}
            </p>

            {/* Name */}
            <h1 className="text-3xl md:text-4xl font-bold text-[#111111] mb-4">
              {product.name}
            </h1>

            {/* Price */}
            <div className="mb-4">
              <PriceDisplay
                priceNormal={product.priceNormal}
                priceSale={product.priceSale}
                discountPct={product.discountPct}
              />
            </div>

            {/* Countdown */}
            {product.discountEnd && new Date(product.discountEnd) > new Date() && (
              <div className="mb-6">
                <CountdownTimer endDate={product.discountEnd} />
              </div>
            )}

            {/* Variant Selector */}
            {selectedColor && (
              <div className="mb-6">
                <VariantSelector
                  product={product}
                  selectedColor={selectedColor}
                  selectedSize={selectedSize}
                  selectedFit={selectedFit}
                  onColorSelect={setSelectedColor}
                  onSizeSelect={setSelectedSize}
                  onFitSelect={product.availableFits ? setSelectedFit : undefined}
                />
              </div>
            )}

            {/* Availability Status */}
            <div className="mb-4">
              <AvailabilityStatus status={variantStatus} />
            </div>

            {/* Quantity */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-[#111111] mb-2">Cantidad</h3>
              <div className="flex items-center border border-[#E5E5E5] rounded-lg w-fit">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center hover:bg-[#F5F5F7] transition-colors"
                >
                  <Minus className="w-4 h-4" strokeWidth={1.5} />
                </button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-[#F5F5F7] transition-colors"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={handleAddToCart}
              disabled={!canAddToCart || isAdding}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-6 py-4 font-medium rounded-full transition-all duration-300',
                !canAddToCart
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-[#111111] text-white hover:opacity-80'
              )}
            >
              <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
              {!canAddToCart
                ? 'Selecciona opciones disponibles'
                : isAdding
                ? 'Agregando...'
                : 'AGREGAR A MI PEDIDO'}
            </button>

            {/* Volume Discounts */}
            {product.volumeDiscounts && product.volumeDiscounts.length > 0 && (
              <div className="mt-8">
                <VolumeDiscountTable
                  discounts={product.volumeDiscounts}
                  basePrice={product.priceSale || product.priceNormal}
                  currentQuantity={quantity}
                />
              </div>
            )}

            {/* Cross-sell */}
            {complementaryProduct && selectedColor && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Completa el look</h3>
                <CrossSellCard
                  product={complementaryProduct}
                  selectedColorId={selectedColor.id}
                  onColorChange={() => {
                    // The cross-sell card handles its own color selection
                  }}
                  onAdd={handleAddComplementary}
                />
              </div>
            )}
          </div>
        </div>

        {/* Product Info Accordions */}
        <div className="mt-12 lg:mt-16 max-w-3xl">
          <Accordion title="Descripción" defaultOpen>
            <p className="leading-relaxed">{product.description}</p>
          </Accordion>

          <Accordion title="Características">
            <ul className="space-y-2">
              {product.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#34C759] mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </Accordion>

          <Accordion title="Guía de tallas">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5E5E5]">
                    <th className="text-left py-2 px-2">Talla</th>
                    <th className="text-left py-2 px-2">Busto (cm)</th>
                    <th className="text-left py-2 px-2">Cintura (cm)</th>
                    <th className="text-left py-2 px-2">Cadera (cm)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 px-2">XS</td>
                    <td className="py-2 px-2">82-86</td>
                    <td className="py-2 px-2">64-68</td>
                    <td className="py-2 px-2">90-94</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 px-2">S</td>
                    <td className="py-2 px-2">86-90</td>
                    <td className="py-2 px-2">68-72</td>
                    <td className="py-2 px-2">94-98</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 px-2">M</td>
                    <td className="py-2 px-2">90-94</td>
                    <td className="py-2 px-2">72-76</td>
                    <td className="py-2 px-2">98-102</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 px-2">L</td>
                    <td className="py-2 px-2">94-98</td>
                    <td className="py-2 px-2">76-80</td>
                    <td className="py-2 px-2">102-106</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2">XL</td>
                    <td className="py-2 px-2">98-102</td>
                    <td className="py-2 px-2">80-84</td>
                    <td className="py-2 px-2">106-110</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Accordion>

          <Accordion title="Cuidados">
            <ul className="space-y-2">
              {product.careInstructions.map((instruction, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                  <span>{instruction}</span>
                </li>
              ))}
            </ul>
          </Accordion>
        </div>
      </div>
    </main>
  );
}

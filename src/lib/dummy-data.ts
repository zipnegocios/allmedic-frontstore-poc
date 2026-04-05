import type { Product, Store, ProductColor, ProductVariant, Size, Gender, Fit } from './types';

// Colors
export const COLORS: ProductColor[] = [
  { id: 'navy', name: 'Navy', code: 'NV', hex: '#1B365D' },
  { id: 'black', name: 'Black', code: 'BK', hex: '#000000' },
  { id: 'white', name: 'White', code: 'WH', hex: '#FFFFFF' },
  { id: 'ceil', name: 'Ceil Blue', code: 'CB', hex: '#89CFF0' },
  { id: 'wine', name: 'Wine', code: 'WN', hex: '#722F37' },
  { id: 'teal', name: 'Teal', code: 'TL', hex: '#008080' },
  { id: 'burgundy', name: 'Burgundy', code: 'BG', hex: '#800020' },
  { id: 'royal', name: 'Royal Blue', code: 'RB', hex: '#4169E1' },
];

// Available colors for filters
export const AVAILABLE_COLORS = COLORS;

// Sizes
export const SIZES: Size[] = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];

// Brands
export const BRANDS = ['FIGS', 'Cherokee', 'Grey\'s Anatomy', 'WonderWink', 'Koi', 'Dickies'];

// Categories
export const CATEGORIES = ['Camisas', 'Pantalones', 'Chaquetas', 'Conjuntos', 'Accesorios'];

// Generate variants for a product
function generateVariants(
  productId: string,
  colorIds: string[],
  sizes: Size[],
  fits?: Fit[]
): ProductVariant[] {
  const variants: ProductVariant[] = [];
  
  colorIds.forEach((colorId) => {
    sizes.forEach((size) => {
      const sku = `${productId}-${colorId.toUpperCase()}-${size}`;
      const statuses: ('AVAILABLE' | 'BACKORDER' | 'OUT_OF_STOCK')[] = ['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'BACKORDER', 'OUT_OF_STOCK'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      variants.push({
        id: `${productId}-${colorId}-${size}`,
        sku,
        colorId,
        size,
        fit: fits?.[0],
        images: [`/images/products/${productId}_${colorId}_1.jpg`, `/images/products/${productId}_${colorId}_2.jpg`],
        status,
      });
    });
  });
  
  return variants;
}

// Sample products
export const PRODUCTS: Product[] = [
  {
    id: 'figs-casma',
    slug: 'figs-casma-scrub-top',
    name: 'Casma Scrub Top',
    brand: 'FIGS',
    category: 'Camisas',
    gender: 'Mujer',
    description: 'El Casma Scrub Top de FIGS combina estilo y funcionalidad. Con tejido elástico de cuatro direcciones y tecnología FIONx que repele líquidos.',
    features: [
      'Tejido FIONx elástico de 4 direcciones',
      'Tecnología anti-microbiana',
      'Bolsillos laterales profundos',
      'Cuello en V moderno',
      'Ajuste atlético',
    ],
    careInstructions: [
      'Lavar en agua fría',
      'No usar blanqueador',
      'Secar a baja temperatura',
      'Planchar a temperatura media',
    ],
    priceNormal: 48.00,
    priceSale: 38.40,
    discountPct: 20,
    discountEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    colors: [COLORS[0], COLORS[1], COLORS[3], COLORS[6]],
    availableSizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
    variants: generateVariants('figs-casma', ['navy', 'black', 'ceil', 'burgundy'], ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
    isNew: true,
    isBestSeller: true,
    volumeDiscounts: [
      { quantity: 3, minQty: 3, discount: 10, discountPct: 10, label: '3+ unidades' },
      { quantity: 5, minQty: 5, discount: 15, discountPct: 15, label: '5+ unidades' },
      { quantity: 10, minQty: 10, discount: 20, discountPct: 20, label: '10+ unidades' },
    ],
  },
  {
    id: 'figs-yola',
    slug: 'figs-yola-scrub-pants',
    name: 'Yola Scrub Pants',
    brand: 'FIGS',
    category: 'Pantalones',
    gender: 'Mujer',
    description: 'Pantalones scrub Yola con cintura elástica y ajuste cómodo. Perfectos para largas jornadas de trabajo.',
    features: [
      'Cintura elástica ajustable',
      'Bolsillos cargo laterales',
      'Tejido transpirable',
      'Resistente a arrugas',
    ],
    careInstructions: [
      'Lavar en ciclo suave',
      'No usar suavizante',
      'Secar al aire libre preferiblemente',
    ],
    priceNormal: 52.00,
    colors: [COLORS[0], COLORS[1], COLORS[4]],
    availableSizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
    variants: generateVariants('figs-yola', ['navy', 'black', 'wine'], ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
    isNew: false,
    isBestSeller: true,
    complementaryProduct: 'figs-casma',
  },
  {
    id: 'cherokee-workwear',
    slug: 'cherokee-workwear-scrub-top',
    name: 'Workwear Scrub Top',
    brand: 'Cherokee',
    category: 'Camisas',
    gender: 'Unisex',
    description: 'El clásico scrub top de Cherokee Workwear. Duradero, cómodo y asequible.',
    features: [
      'Mezcla de poliéster y algodón',
      'Dos bolsillos frontales',
      'Cuello en V',
      'Fácil cuidado',
    ],
    careInstructions: [
      'Lavar a máquina',
      'Secar en secadora',
      'No necesita plancha',
    ],
    priceNormal: 24.99,
    priceSale: 19.99,
    discountPct: 20,
    colors: [COLORS[0], COLORS[1], COLORS[2], COLORS[3]],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    variants: generateVariants('cherokee-workwear', ['navy', 'black', 'white', 'ceil'], ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']),
    isNew: false,
    isBestSeller: true,
  },
  {
    id: 'greys-anatomy-lexie',
    slug: 'greys-anatomy-lexie-scrub-top',
    name: 'Lexie Scrub Top',
    brand: 'Grey\'s Anatomy',
    category: 'Camisas',
    gender: 'Mujer',
    description: 'Elegante scrub top con detalles de moda. Tejido suave que se siente increíble contra la piel.',
    features: [
      'Tejido suave y elástico',
      'Detalles de costuras decorativas',
      'Bolsillos funcionales',
      'Ajuste favorecedor',
    ],
    careInstructions: [
      'Lavar en agua fría',
      'Secar a baja temperatura',
    ],
    priceNormal: 38.00,
    colors: [COLORS[0], COLORS[1], COLORS[5]],
    availableSizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
    variants: generateVariants('greys-anatomy-lexie', ['navy', 'black', 'teal'], ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
    isNew: true,
    isBestSeller: false,
  },
  {
    id: 'wonderwink-four-stretch',
    slug: 'wonderwink-four-stretch-scrub-top',
    name: 'Four-Stretch Scrub Top',
    brand: 'WonderWink',
    category: 'Camisas',
    gender: 'Mujer',
    description: 'Scrub top con elástico de cuatro direcciones para máxima comodidad y movimiento.',
    features: [
      'Elástico de 4 direcciones',
      'Bolsillos múltiples',
      'Cuello redondo',
      'Colores vibrantes',
    ],
    careInstructions: [
      'Lavar a máquina',
      'No usar blanqueador',
    ],
    priceNormal: 32.00,
    priceSale: 25.60,
    discountPct: 20,
    discountEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    colors: [COLORS[0], COLORS[1], COLORS[4], COLORS[6]],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    variants: generateVariants('wonderwink-four-stretch', ['navy', 'black', 'wine', 'burgundy'], ['XS', 'S', 'M', 'L', 'XL', '2XL']),
    isNew: false,
    isBestSeller: true,
  },
  {
    id: 'koi-lindsey',
    slug: 'koi-lindsey-scrub-pants',
    name: 'Lindsey Scrub Pants',
    brand: 'Koi',
    category: 'Pantalones',
    gender: 'Mujer',
    description: 'Pantalones scrub Lindsey con estilo único y funcionalidad superior.',
    features: [
      'Diseño de carga con múltiples bolsillos',
      'Cintura ajustable con cordón',
      'Tejido duradero',
      'Colores de moda',
    ],
    careInstructions: [
      'Lavar en agua fría',
      'Secar en secadora a baja temperatura',
    ],
    priceNormal: 42.00,
    colors: [COLORS[0], COLORS[1], COLORS[3]],
    availableSizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
    variants: generateVariants('koi-lindsey', ['navy', 'black', 'ceil'], ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
    isNew: true,
    isBestSeller: false,
  },
  {
    id: 'dickies-eds',
    slug: 'dickies-eds-scrub-top',
    name: 'EDS Scrub Top',
    brand: 'Dickies',
    category: 'Camisas',
    gender: 'Unisex',
    description: 'El clásico EDS de Dickies. Confiabilidad y durabilidad desde 1922.',
    features: [
      'Tejido resistente',
      'Costuras reforzadas',
      'Bolsillos funcionales',
      'Fácil mantenimiento',
    ],
    careInstructions: [
      'Lavar a máquina',
      'Secar en secadora',
      'No necesita plancha',
    ],
    priceNormal: 22.00,
    priceSale: 17.60,
    discountPct: 20,
    colors: [COLORS[0], COLORS[1], COLORS[2]],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    variants: generateVariants('dickies-eds', ['navy', 'black', 'white'], ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']),
    isNew: false,
    isBestSeller: true,
  },
  {
    id: 'figs-catarina',
    slug: 'figs-catarina-scrub-top',
    name: 'Catarina Scrub Top',
    brand: 'FIGS',
    category: 'Camisas',
    gender: 'Mujer',
    description: 'Scrub top Catarina con diseño elegante y funcionalidad superior.',
    features: [
      'Tejido FIONx premium',
      'Diseño asimétrico moderno',
      'Múltiples bolsillos',
      'Ajuste favorecedor',
    ],
    careInstructions: [
      'Lavar en agua fría',
      'Secar a baja temperatura',
    ],
    priceNormal: 46.00,
    colors: [COLORS[0], COLORS[1], COLORS[6], COLORS[7]],
    availableSizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
    variants: generateVariants('figs-catarina', ['navy', 'black', 'burgundy', 'royal'], ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
    isNew: true,
    isBestSeller: true,
  },
];

// Stores
export const STORES: Store[] = [
  {
    id: 'quito-main',
    name: 'AllMedic Quito - Matriz',
    address: 'Av. 6 de Diciembre N34-123, Quito, Ecuador',
    phone: '+593 2 123 4567',
    hours: 'Lun - Vie: 9:00 - 18:00, Sáb: 10:00 - 14:00',
    isMain: true,
  },
  {
    id: 'guayaquil',
    name: 'AllMedic Guayaquil',
    address: 'Av. 9 de Octubre 1234, Guayaquil, Ecuador',
    phone: '+593 4 234 5678',
    hours: 'Lun - Vie: 9:00 - 18:00, Sáb: 10:00 - 14:00',
    isMain: false,
  },
  {
    id: 'cuenca',
    name: 'AllMedic Cuenca',
    address: 'Calle Larga 567, Cuenca, Ecuador',
    phone: '+593 7 345 6789',
    hours: 'Lun - Vie: 9:00 - 18:00, Sáb: 10:00 - 14:00',
    isMain: false,
  },
];

// Hero slides
export const HERO_SLIDES = [
  {
    id: 1,
    title: 'Uniformes médicos de alta calidad',
    subtitle: 'Descubre nuestra colección de scrubs premium diseñados para profesionales de la salud.',
    image: '/images/hero-1.jpg',
    cta: 'Ver catálogo',
    ctaLink: '/catalogo',
  },
  {
    id: 2,
    title: 'Nueva colección FIGS 2024',
    subtitle: 'Los scrubs más cómodos y estilosos del mercado. Tecnología FIONx de última generación.',
    image: '/images/hero-2.jpg',
    cta: 'Descubrir',
    ctaLink: '/catalogo?brand=FIGS',
  },
  {
    id: 3,
    title: 'Descuentos en Cherokee',
    subtitle: 'Hasta 20% de descuento en toda la línea Cherokee Workwear.',
    image: '/images/hero-3.jpg',
    cta: 'Ver ofertas',
    ctaLink: '/catalogo?brand=Cherokee',
  },
];

// Helper functions
export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find(p => p.slug === slug);
}

export function getFeaturedProducts(): Product[] {
  return PRODUCTS.filter(p => p.isBestSeller);
}

export function filterProducts(filters: {
  gender?: Gender;
  categories?: string[];
  brands?: string[];
  colors?: string[];
  sizes?: string[];
  fits?: string[];
  priceMin?: number;
  priceMax?: number;
}): Product[] {
  return PRODUCTS.filter(product => {
    if (filters.gender && product.gender !== filters.gender && product.gender !== 'Unisex') {
      return false;
    }
    if (filters.categories?.length && !filters.categories.includes(product.category)) {
      return false;
    }
    if (filters.brands?.length && !filters.brands.includes(product.brand)) {
      return false;
    }
    if (filters.colors?.length && !product.colors.some(c => filters.colors?.includes(c.name))) {
      return false;
    }
    if (filters.sizes?.length && !product.availableSizes.some(s => filters.sizes?.includes(s))) {
      return false;
    }
    const price = product.priceSale || product.priceNormal;
    if (filters.priceMin !== undefined && price < filters.priceMin) {
      return false;
    }
    if (filters.priceMax !== undefined && price > filters.priceMax) {
      return false;
    }
    return true;
  });
}

export function searchProducts(query: string): Product[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return PRODUCTS;
  
  return PRODUCTS.filter(p => {
    // Search in basic fields
    const basicMatch = 
      p.name.toLowerCase().includes(lowerQuery) ||
      p.brand.toLowerCase().includes(lowerQuery) ||
      p.category.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery) ||
      p.gender.toLowerCase().includes(lowerQuery);
    
    if (basicMatch) return true;
    
    // Search in colors (name and hex)
    const colorMatch = p.colors.some(c => 
      c.name.toLowerCase().includes(lowerQuery) ||
      c.code.toLowerCase().includes(lowerQuery) ||
      c.hex.toLowerCase().includes(lowerQuery)
    );
    if (colorMatch) return true;
    
    // Search in sizes
    const sizeMatch = p.availableSizes.some(s => 
      s.toLowerCase().includes(lowerQuery)
    );
    if (sizeMatch) return true;
    
    // Search in features
    const featureMatch = p.features.some(f => 
      f.toLowerCase().includes(lowerQuery)
    );
    if (featureMatch) return true;
    
    // Search in variants (SKU)
    const variantMatch = p.variants.some(v => 
      v.sku.toLowerCase().includes(lowerQuery) ||
      v.size.toLowerCase().includes(lowerQuery)
    );
    if (variantMatch) return true;
    
    return false;
  });
}

import type { Product, ProductColor, Store, HeroSlide, VolumeDiscount } from './types';

// ============================================
// COLORES DISPONIBLES
// ============================================

export const AVAILABLE_COLORS: ProductColor[] = [
  { id: 'appletini', name: 'Appletini', code: 'APL', hex: '#88B04B' },
  { id: 'black', name: 'Black', code: 'BLK', hex: '#000000' },
  { id: 'black-pewter', name: 'Black/Pewter', code: 'BKP', hex: '#2E2E2E' },
  { id: 'blushing-coral', name: 'Blushing Coral', code: 'BLC', hex: '#F88379' },
  { id: 'caribbean-blue', name: 'Caribbean Blue', code: 'CAB', hex: '#0081AB' },
  { id: 'carmine-pink', name: 'Carmine Pink', code: 'CRP', hex: '#EB4C42' },
  { id: 'ciel-blue', name: 'Ciel Blue', code: 'CIB', hex: '#92A1CF' },
  { id: 'eggplant', name: 'Eggplant', code: 'EGP', hex: '#614051' },
  { id: 'espresso', name: 'Espresso', code: 'ESP', hex: '#3D3635' },
  { id: 'flamingo', name: 'Flamingo', code: 'FLM', hex: '#FC8EAC' },
  { id: 'galaxy-blue', name: 'Galaxy Blue', code: 'GAB', hex: '#2A445D' },
  { id: 'grape', name: 'Grape', code: 'GRP', hex: '#602F6B' },
  { id: 'grey', name: 'Grey', code: 'GRY', hex: '#808080' },
  { id: 'hot-tomato', name: 'Hot Tomato', code: 'HTM', hex: '#CE2029' },
  { id: 'hunter-green', name: 'Hunter Green', code: 'HGR', hex: '#355E3B' },
  { id: 'khaki', name: 'Khaki', code: 'KHK', hex: '#C3B091' },
  { id: 'latte', name: 'Latte', code: 'LAT', hex: '#C5A582' },
  { id: 'mango-smoothie', name: 'Mango Smoothie', code: 'MGS', hex: '#FFBE4F' },
  { id: 'mythic-blue', name: 'Mythic Blue', code: 'MYB', hex: '#5C83AB' },
  { id: 'navy', name: 'Navy', code: 'NVY', hex: '#000080' },
  { id: 'olive', name: 'Olive', code: 'OLV', hex: '#808000' },
  { id: 'patel-peony', name: 'Patel Peony', code: 'PNP', hex: '#E5A4CB' },
  { id: 'pewter', name: 'Pewter', code: 'PWT', hex: '#696969' },
  { id: 'pink-tonic', name: 'Pink Tonic', code: 'PTN', hex: '#FF69B4' },
  { id: 'red', name: 'Red', code: 'RED', hex: '#FF0000' },
  { id: 'royal', name: 'Royal', code: 'RYL', hex: '#4169E1' },
  { id: 'royal-black', name: 'Royal/Black', code: 'RYB', hex: '#2B3D5E' },
  { id: 'sea-salt', name: 'Sea Salt', code: 'SSL', hex: '#F5F5F5' },
  { id: 'sky-blue', name: 'Sky Blue', code: 'SKB', hex: '#87CEEB' },
  { id: 'tea-rose', name: 'Tea Rose', code: 'TRS', hex: '#F4C2C2' },
  { id: 'teal-blue', name: 'Teal Blue', code: 'TEB', hex: '#008080' },
  { id: 'turquoise', name: 'Turquoise', code: 'TRQ', hex: '#40E0D0' },
  { id: 'white', name: 'White', code: 'WHT', hex: '#FFFFFF' },
  { id: 'wine', name: 'Wine', code: 'WNE', hex: '#722F37' },
  { id: 'wine-pewter', name: 'Wine/Pewter', code: 'WNP', hex: '#5E3A43' },
];

// ============================================
// MARCAS
// ============================================

export const BRANDS = [
  'FIGS',
  "Grey's Anatomy",
  'Skechers',
  'Healing Hands',
  'WonderWink',
  'Infinity',
  'Heartsoul',
  'Med Couture',
  'Landau',
  'Koi',
  'Jaanuu',
  'Adar',
  'Carhartt Liberty',
  'Maevn',
  'Mandala',
];

// ============================================
// DESCUENTOS POR VOLUMEN EJEMPLO
// ============================================

const standardVolumeDiscounts: VolumeDiscount[] = [
  { minQty: 1, discountPct: 0, label: '1-9 unidades' },
  { minQty: 10, discountPct: 10, label: '10-19 unidades' },
  { minQty: 20, discountPct: 15, label: '20+ unidades' },
];

// ============================================
// PRODUCTOS DUMMY
// ============================================

export const PRODUCTS: Product[] = [
  {
    id: '1',
    slug: 'cherokee-infinity-scrub-top',
    name: 'Cherokee Infinity Scrub Top',
    brand: 'Infinity',
    category: 'Camisas',
    gender: 'Mujer',
    description: 'Top médico de alto rendimiento con tecnología de secado rápido y resistencia a las arrugas. Cuello en V moderno con costuras decorativas.',
    features: [
      'Tecnología Certainty con protección antimicrobiana',
      '4 bolsillos funcionales',
      'Tejido stretch 4-way',
      'Cuello en V moderno',
      'Costuras decorativas',
    ],
    careInstructions: [
      'Lavar en agua fría',
      'No usar blanqueador',
      'Secar a baja temperatura',
      'Planchar a temperatura media',
    ],
    priceNormal: 45.99,
    priceSale: 38.99,
    discountPct: 15,
    discountEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'ciel-blue')!,
      AVAILABLE_COLORS.find(c => c.id === 'wine')!,
    ],
    variants: [
      { id: 'v1-1', colorId: 'navy', size: 'XS', status: 'AVAILABLE', images: ['/images/product-1-navy-1.jpg', '/images/product-1-navy-2.jpg'], sku: 'CK123A-NVY-XS' },
      { id: 'v1-2', colorId: 'navy', size: 'S', status: 'AVAILABLE', images: ['/images/product-1-navy-1.jpg', '/images/product-1-navy-2.jpg'], sku: 'CK123A-NVY-S' },
      { id: 'v1-3', colorId: 'navy', size: 'M', status: 'AVAILABLE', images: ['/images/product-1-navy-1.jpg', '/images/product-1-navy-2.jpg'], sku: 'CK123A-NVY-M' },
      { id: 'v1-4', colorId: 'navy', size: 'L', status: 'BACKORDER', images: ['/images/product-1-navy-1.jpg', '/images/product-1-navy-2.jpg'], sku: 'CK123A-NVY-L' },
      { id: 'v1-5', colorId: 'navy', size: 'XL', status: 'AVAILABLE', images: ['/images/product-1-navy-1.jpg', '/images/product-1-navy-2.jpg'], sku: 'CK123A-NVY-XL' },
      { id: 'v1-6', colorId: 'black', size: 'XS', status: 'AVAILABLE', images: ['/images/product-1-black-1.jpg', '/images/product-1-black-2.jpg'], sku: 'CK123A-BLK-XS' },
      { id: 'v1-7', colorId: 'black', size: 'S', status: 'AVAILABLE', images: ['/images/product-1-black-1.jpg', '/images/product-1-black-2.jpg'], sku: 'CK123A-BLK-S' },
      { id: 'v1-8', colorId: 'black', size: 'M', status: 'OUT_OF_STOCK', images: ['/images/product-1-black-1.jpg', '/images/product-1-black-2.jpg'], sku: 'CK123A-BLK-M' },
      { id: 'v1-9', colorId: 'ciel-blue', size: 'S', status: 'AVAILABLE', images: ['/images/product-1-ciel-1.jpg', '/images/product-1-ciel-2.jpg'], sku: 'CK123A-CIB-S' },
      { id: 'v1-10', colorId: 'ciel-blue', size: 'M', status: 'AVAILABLE', images: ['/images/product-1-ciel-1.jpg', '/images/product-1-ciel-2.jpg'], sku: 'CK123A-CIB-M' },
      { id: 'v1-11', colorId: 'wine', size: 'M', status: 'AVAILABLE', images: ['/images/product-1-wine-1.jpg', '/images/product-1-wine-2.jpg'], sku: 'CK123A-WNE-M' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    isNew: false,
    isBestSeller: true,
    relatedProducts: ['2', '5'],
    complementaryProduct: '2',
  },
  {
    id: '2',
    slug: 'cherokee-infinity-scrub-pant',
    name: 'Cherokee Infinity Scrub Pant',
    brand: 'Infinity',
    category: 'Pantalones',
    gender: 'Mujer',
    description: 'Pantalón médico de corte moderno con cintura elástica y múltiples bolsillos. Comodidad todo el día garantizada.',
    features: [
      'Cintura elástica con cordón ajustable',
      '6 bolsillos incluyendo 2 cargo',
      'Tobillo recto moderno',
      'Tejido stretch premium',
    ],
    careInstructions: [
      'Lavar en agua fría',
      'No usar blanqueador',
      'Secar a baja temperatura',
    ],
    priceNormal: 48.99,
    priceSale: 41.99,
    discountPct: 14,
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'ciel-blue')!,
      AVAILABLE_COLORS.find(c => c.id === 'wine')!,
    ],
    variants: [
      { id: 'v2-1', colorId: 'navy', size: 'XS', fit: 'Petite', status: 'AVAILABLE', images: ['/images/product-2-navy-1.jpg'], sku: 'CK123B-NVY-XS-P' },
      { id: 'v2-2', colorId: 'navy', size: 'XS', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-2-navy-1.jpg'], sku: 'CK123B-NVY-XS-R' },
      { id: 'v2-3', colorId: 'navy', size: 'S', fit: 'Petite', status: 'AVAILABLE', images: ['/images/product-2-navy-1.jpg'], sku: 'CK123B-NVY-S-P' },
      { id: 'v2-4', colorId: 'navy', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-2-navy-1.jpg'], sku: 'CK123B-NVY-S-R' },
      { id: 'v2-5', colorId: 'navy', size: 'S', fit: 'Tall', status: 'BACKORDER', images: ['/images/product-2-navy-1.jpg'], sku: 'CK123B-NVY-S-T' },
      { id: 'v2-6', colorId: 'black', size: 'XS', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-2-black-1.jpg'], sku: 'CK123B-BLK-XS-R' },
      { id: 'v2-7', colorId: 'black', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-2-black-1.jpg'], sku: 'CK123B-BLK-S-R' },
      { id: 'v2-8', colorId: 'black', size: 'M', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-2-black-1.jpg'], sku: 'CK123B-BLK-M-R' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    availableFits: ['Petite', 'Regular', 'Tall'],
    isNew: false,
    isBestSeller: true,
    relatedProducts: ['1', '5'],
    complementaryProduct: '1',
  },
  {
    id: '3',
    slug: 'figs-catarina-one-pocket-top',
    name: 'FIGS Catarina One-Pocket Top',
    brand: 'FIGS',
    category: 'Camisas',
    gender: 'Mujer',
    description: 'El top más icónico de FIGS. Diseño minimalista con un bolsillo funcional y tejido ultra-suave.',
    features: [
      'Tejido FIONx ultra-suave',
      'Tecnología antiolor',
      'Secado rápido',
      '4-way stretch',
      '1 bolsillo en el pecho',
    ],
    careInstructions: [
      'Lavar a máquina',
      'No usar suavizante',
      'Secar a baja temperatura',
    ],
    priceNormal: 68.00,
    volumeDiscounts: [
      { minQty: 1, discountPct: 0, label: '1-4 unidades' },
      { minQty: 5, discountPct: 8, label: '5-9 unidades' },
      { minQty: 10, discountPct: 12, label: '10+ unidades' },
    ],
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'sea-salt')!,
      AVAILABLE_COLORS.find(c => c.id === 'teal-blue')!,
    ],
    variants: [
      { id: 'v3-1', colorId: 'black', size: 'XXS', status: 'AVAILABLE', images: ['/images/product-3-black-1.jpg'], sku: 'FG001-BLK-XXS' },
      { id: 'v3-2', colorId: 'black', size: 'XS', status: 'AVAILABLE', images: ['/images/product-3-black-1.jpg'], sku: 'FG001-BLK-XS' },
      { id: 'v3-3', colorId: 'black', size: 'S', status: 'AVAILABLE', images: ['/images/product-3-black-1.jpg'], sku: 'FG001-BLK-S' },
      { id: 'v3-4', colorId: 'black', size: 'M', status: 'AVAILABLE', images: ['/images/product-3-black-1.jpg'], sku: 'FG001-BLK-M' },
      { id: 'v3-5', colorId: 'navy', size: 'XS', status: 'AVAILABLE', images: ['/images/product-3-navy-1.jpg'], sku: 'FG001-NVY-XS' },
      { id: 'v3-6', colorId: 'navy', size: 'S', status: 'AVAILABLE', images: ['/images/product-3-navy-1.jpg'], sku: 'FG001-NVY-S' },
      { id: 'v3-7', colorId: 'sea-salt', size: 'XS', status: 'AVAILABLE', images: ['/images/product-3-salt-1.jpg'], sku: 'FG001-SSL-XS' },
      { id: 'v3-8', colorId: 'teal-blue', size: 'S', status: 'BACKORDER', images: ['/images/product-3-teal-1.jpg'], sku: 'FG001-TEB-S' },
    ],
    availableSizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL'],
    isNew: true,
    isBestSeller: true,
    relatedProducts: ['4', '6'],
    complementaryProduct: '4',
  },
  {
    id: '4',
    slug: 'figs-yola-skinny-scrub-pant',
    name: 'FIGS Yola Skinny Scrub Pant',
    brand: 'FIGS',
    category: 'Pantalones',
    gender: 'Mujer',
    description: 'Pantalón skinny de corte moderno con cintura elástica y bolsillos laterales. El favorito de las profesionales.',
    features: [
      'Corte skinny moderno',
      'Cintura elástica de 3.5"',
      '8 bolsillos funcionales',
      'Tejido FIONx premium',
      'Costuras planas anti-roce',
    ],
    careInstructions: [
      'Lavar a máquina en frío',
      'No usar suavizante',
      'Secar a baja temperatura',
    ],
    priceNormal: 72.00,
    volumeDiscounts: [
      { minQty: 1, discountPct: 0, label: '1-4 unidades' },
      { minQty: 5, discountPct: 8, label: '5-9 unidades' },
      { minQty: 10, discountPct: 12, label: '10+ unidades' },
    ],
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'sea-salt')!,
    ],
    variants: [
      { id: 'v4-1', colorId: 'black', size: 'XS', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-4-black-1.jpg'], sku: 'FG002-BLK-XS-R' },
      { id: 'v4-2', colorId: 'black', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-4-black-1.jpg'], sku: 'FG002-BLK-S-R' },
      { id: 'v4-3', colorId: 'black', size: 'S', fit: 'Petite', status: 'AVAILABLE', images: ['/images/product-4-black-1.jpg'], sku: 'FG002-BLK-S-P' },
      { id: 'v4-4', colorId: 'navy', size: 'XS', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-4-navy-1.jpg'], sku: 'FG002-NVY-XS-R' },
      { id: 'v4-5', colorId: 'navy', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-4-navy-1.jpg'], sku: 'FG002-NVY-S-R' },
      { id: 'v4-6', colorId: 'sea-salt', size: 'S', fit: 'Regular', status: 'OUT_OF_STOCK', images: ['/images/product-4-salt-1.jpg'], sku: 'FG002-SSL-S-R' },
    ],
    availableSizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL'],
    availableFits: ['Petite', 'Regular', 'Tall'],
    isNew: false,
    isBestSeller: true,
    relatedProducts: ['3', '6'],
    complementaryProduct: '3',
  },
  {
    id: '5',
    slug: 'greys-anatomy-classic-scrub-top',
    name: "Grey's Anatomy Classic Scrub Top",
    brand: "Grey's Anatomy",
    category: 'Camisas',
    gender: 'Mujer',
    description: 'El clásico atemporal de\'s Anatomy. Suavidad inigualable y durabilidad excepcional.',
    features: [
      'Tejido ArcLux ultra-suave',
      'Cuello en V clásico',
      '3 bolsillos funcionales',
      'Resistente a decoloración',
      'Secado rápido',
    ],
    careInstructions: [
      'Lavar en agua tibia',
      'No usar blanqueador',
      'Secar a temperatura media',
    ],
    priceNormal: 52.99,
    priceSale: 44.99,
    discountPct: 15,
    discountEnd: new Date(Date.now() + 5 * 60 * 60 * 1000), // 5 hours from now - FLASH SALE
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'ciel-blue')!,
      AVAILABLE_COLORS.find(c => c.id === 'blushing-coral')!,
    ],
    variants: [
      { id: 'v5-1', colorId: 'black', size: 'XS', status: 'AVAILABLE', images: ['/images/product-5-black-1.jpg'], sku: 'GA200-BLK-XS' },
      { id: 'v5-2', colorId: 'black', size: 'S', status: 'AVAILABLE', images: ['/images/product-5-black-1.jpg'], sku: 'GA200-BLK-S' },
      { id: 'v5-3', colorId: 'black', size: 'M', status: 'AVAILABLE', images: ['/images/product-5-black-1.jpg'], sku: 'GA200-BLK-M' },
      { id: 'v5-4', colorId: 'navy', size: 'XS', status: 'AVAILABLE', images: ['/images/product-5-navy-1.jpg'], sku: 'GA200-NVY-XS' },
      { id: 'v5-5', colorId: 'navy', size: 'S', status: 'AVAILABLE', images: ['/images/product-5-navy-1.jpg'], sku: 'GA200-NVY-S' },
      { id: 'v5-6', colorId: 'ciel-blue', size: 'S', status: 'AVAILABLE', images: ['/images/product-5-ciel-1.jpg'], sku: 'GA200-CIB-S' },
      { id: 'v5-7', colorId: 'blushing-coral', size: 'M', status: 'BACKORDER', images: ['/images/product-5-coral-1.jpg'], sku: 'GA200-BLC-M' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    isNew: false,
    isBestSeller: false,
    relatedProducts: ['1', '2'],
    complementaryProduct: '2',
  },
  {
    id: '6',
    slug: 'greys-anatomy-drawstring-pant',
    name: "Grey's Anatomy Drawstring Pant",
    brand: "Grey's Anatomy",
    category: 'Pantalones',
    gender: 'Mujer',
    description: 'Pantalón clásico con cordón ajustable y corte recto atemporal. La elección de las profesionales por décadas.',
    features: [
      'Cintura elástica con cordón',
      'Corte recto clásico',
      '5 bolsillos funcionales',
      'Tejido ArcLux premium',
      'Resistente a arrugas',
    ],
    careInstructions: [
      'Lavar en agua tibia',
      'No usar blanqueador',
      'Secar a temperatura media',
    ],
    priceNormal: 54.99,
    priceSale: 46.99,
    discountPct: 15,
    discountEnd: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'ciel-blue')!,
    ],
    variants: [
      { id: 'v6-1', colorId: 'black', size: 'XS', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-6-black-1.jpg'], sku: 'GA201-BLK-XS-R' },
      { id: 'v6-2', colorId: 'black', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-6-black-1.jpg'], sku: 'GA201-BLK-S-R' },
      { id: 'v6-3', colorId: 'black', size: 'M', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-6-black-1.jpg'], sku: 'GA201-BLK-M-R' },
      { id: 'v6-4', colorId: 'navy', size: 'XS', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-6-navy-1.jpg'], sku: 'GA201-NVY-XS-R' },
      { id: 'v6-5', colorId: 'navy', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-6-navy-1.jpg'], sku: 'GA201-NVY-S-R' },
      { id: 'v6-6', colorId: 'ciel-blue', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-6-ciel-1.jpg'], sku: 'GA201-CIB-S-R' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    availableFits: ['Petite', 'Regular', 'Tall'],
    isNew: false,
    isBestSeller: false,
    relatedProducts: ['3', '4'],
    complementaryProduct: '5',
  },
  {
    id: '7',
    slug: 'skechers-sr-slip-resistant-top',
    name: 'Skechers SR Slip-Resistant Top',
    brand: 'Skechers',
    category: 'Camisas',
    gender: 'Unisex',
    description: 'Top médico con tecnología antideslizante y máxima comodidad. Ideal para largas jornadas.',
    features: [
      'Tecnología Slip-Resistant',
      'Tejido transpirable',
      '4 bolsillos funcionales',
      'Cuello en V moderno',
      'Secado rápido',
    ],
    careInstructions: [
      'Lavar a máquina',
      'No usar blanqueador',
      'Secar a baja temperatura',
    ],
    priceNormal: 42.99,
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'pewter')!,
    ],
    variants: [
      { id: 'v7-1', colorId: 'black', size: 'XS', status: 'AVAILABLE', images: ['/images/product-7-black-1.jpg'], sku: 'SK100-BLK-XS' },
      { id: 'v7-2', colorId: 'black', size: 'S', status: 'AVAILABLE', images: ['/images/product-7-black-1.jpg'], sku: 'SK100-BLK-S' },
      { id: 'v7-3', colorId: 'black', size: 'M', status: 'AVAILABLE', images: ['/images/product-7-black-1.jpg'], sku: 'SK100-BLK-M' },
      { id: 'v7-4', colorId: 'navy', size: 'S', status: 'AVAILABLE', images: ['/images/product-7-navy-1.jpg'], sku: 'SK100-NVY-S' },
      { id: 'v7-5', colorId: 'pewter', size: 'M', status: 'AVAILABLE', images: ['/images/product-7-pewter-1.jpg'], sku: 'SK100-PWT-M' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    isNew: true,
    isBestSeller: false,
    relatedProducts: ['8'],
    complementaryProduct: '8',
  },
  {
    id: '8',
    slug: 'skechers-sr-cargo-pant',
    name: 'Skechers SR Cargo Pant',
    brand: 'Skechers',
    category: 'Pantalones',
    gender: 'Unisex',
    description: 'Pantalón cargo con múltiples bolsillos y tecnología antideslizante. Resistencia y estilo.',
    features: [
      '8 bolsillos cargo',
      'Cintura elástica',
      'Tecnología Slip-Resistant',
      'Tejido resistente',
      'Corte moderno',
    ],
    careInstructions: [
      'Lavar a máquina',
      'No usar blanqueador',
      'Secar a baja temperatura',
    ],
    priceNormal: 45.99,
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'pewter')!,
    ],
    variants: [
      { id: 'v8-1', colorId: 'black', size: 'XS', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-8-black-1.jpg'], sku: 'SK101-BLK-XS-R' },
      { id: 'v8-2', colorId: 'black', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-8-black-1.jpg'], sku: 'SK101-BLK-S-R' },
      { id: 'v8-3', colorId: 'navy', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-8-navy-1.jpg'], sku: 'SK101-NVY-S-R' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    availableFits: ['Regular', 'Tall'],
    isNew: true,
    isBestSeller: false,
    relatedProducts: ['7'],
    complementaryProduct: '7',
  },
  {
    id: '9',
    slug: 'healing-hands-purple-label-top',
    name: 'Healing Hands Purple Label Top',
    brand: 'Healing Hands',
    category: 'Camisas',
    gender: 'Mujer',
    description: 'Top de la línea Purple Label con tejido premium y acabados de lujo. Elegancia en cada detalle.',
    features: [
      'Tejido 360° stretch',
      'Cuello en V con detalle',
      '4 bolsillos funcionales',
      'Costuras planas',
      'Etiqueta sin roce',
    ],
    careInstructions: [
      'Lavar en agua fría',
      'No usar blanqueador',
      'Secar a baja temperatura',
    ],
    priceNormal: 49.99,
    priceSale: 42.99,
    discountPct: 14,
    discountEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'wine')!,
      AVAILABLE_COLORS.find(c => c.id === 'royal')!,
    ],
    variants: [
      { id: 'v9-1', colorId: 'black', size: 'XS', status: 'AVAILABLE', images: ['/images/product-9-black-1.jpg'], sku: 'HH300-BLK-XS' },
      { id: 'v9-2', colorId: 'black', size: 'S', status: 'AVAILABLE', images: ['/images/product-9-black-1.jpg'], sku: 'HH300-BLK-S' },
      { id: 'v9-3', colorId: 'navy', size: 'S', status: 'AVAILABLE', images: ['/images/product-9-navy-1.jpg'], sku: 'HH300-NVY-S' },
      { id: 'v9-4', colorId: 'wine', size: 'M', status: 'BACKORDER', images: ['/images/product-9-wine-1.jpg'], sku: 'HH300-WNE-M' },
      { id: 'v9-5', colorId: 'royal', size: 'L', status: 'AVAILABLE', images: ['/images/product-9-royal-1.jpg'], sku: 'HH300-RYL-L' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    isNew: false,
    isBestSeller: true,
    relatedProducts: ['10'],
    complementaryProduct: '10',
  },
  {
    id: '10',
    slug: 'healing-hands-purple-label-pant',
    name: 'Healing Hands Purple Label Pant',
    brand: 'Healing Hands',
    category: 'Pantalones',
    gender: 'Mujer',
    description: 'Pantalón de la línea Purple Label con corte sofisticado y comodidad excepcional.',
    features: [
      'Corte bootleg elegante',
      'Cintura elástica de 4"',
      '6 bolsillos funcionales',
      'Tejido 360° stretch',
      'Costuras reforzadas',
    ],
    careInstructions: [
      'Lavar en agua fría',
      'No usar blanqueador',
      'Secar a baja temperatura',
    ],
    priceNormal: 52.99,
    priceSale: 44.99,
    discountPct: 15,
    discountEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'wine')!,
    ],
    variants: [
      { id: 'v10-1', colorId: 'black', size: 'XS', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-10-black-1.jpg'], sku: 'HH301-BLK-XS-R' },
      { id: 'v10-2', colorId: 'black', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-10-black-1.jpg'], sku: 'HH301-BLK-S-R' },
      { id: 'v10-3', colorId: 'navy', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-10-navy-1.jpg'], sku: 'HH301-NVY-S-R' },
      { id: 'v10-4', colorId: 'wine', size: 'M', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-10-wine-1.jpg'], sku: 'HH301-WNE-M-R' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    availableFits: ['Petite', 'Regular', 'Tall'],
    isNew: false,
    isBestSeller: true,
    relatedProducts: ['9'],
    complementaryProduct: '9',
  },
  {
    id: '11',
    slug: 'wonderwink-w123-scrub-top',
    name: 'WonderWink W123 Scrub Top',
    brand: 'WonderWink',
    category: 'Camisas',
    gender: 'Mujer',
    description: 'Top W123 con diseño moderno y funcionalidad excepcional. Para quienes buscan estilo y practicidad.',
    features: [
      'Diseño asimétrico moderno',
      '5 bolsillos funcionales',
      'Cuello en V con detalle',
      'Tejido stretch',
      'Etiqueta sin roce',
    ],
    careInstructions: [
      'Lavar a máquina',
      'No usar blanqueador',
      'Secar a baja temperatura',
    ],
    priceNormal: 38.99,
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'hot-tomato')!,
      AVAILABLE_COLORS.find(c => c.id === 'turquoise')!,
    ],
    variants: [
      { id: 'v11-1', colorId: 'black', size: 'XS', status: 'AVAILABLE', images: ['/images/product-11-black-1.jpg'], sku: 'WW123-BLK-XS' },
      { id: 'v11-2', colorId: 'black', size: 'S', status: 'AVAILABLE', images: ['/images/product-11-black-1.jpg'], sku: 'WW123-BLK-S' },
      { id: 'v11-3', colorId: 'navy', size: 'S', status: 'AVAILABLE', images: ['/images/product-11-navy-1.jpg'], sku: 'WW123-NVY-S' },
      { id: 'v11-4', colorId: 'hot-tomato', size: 'M', status: 'AVAILABLE', images: ['/images/product-11-tomato-1.jpg'], sku: 'WW123-HTM-M' },
      { id: 'v11-5', colorId: 'turquoise', size: 'L', status: 'AVAILABLE', images: ['/images/product-11-turq-1.jpg'], sku: 'WW123-TRQ-L' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    isNew: true,
    isBestSeller: false,
    relatedProducts: ['12'],
    complementaryProduct: '12',
  },
  {
    id: '12',
    slug: 'wonderwink-w123-scrub-pant',
    name: 'WonderWink W123 Scrub Pant',
    brand: 'WonderWink',
    category: 'Pantalones',
    gender: 'Mujer',
    description: 'Pantalón W123 con corte flare moderno y bolsillos cargo. Comodidad y estilo en uno.',
    features: [
      'Corte flare moderno',
      '8 bolsillos cargo',
      'Cintura elástica',
      'Tejido resistente',
      'Costuras reforzadas',
    ],
    careInstructions: [
      'Lavar a máquina',
      'No usar blanqueador',
      'Secar a baja temperatura',
    ],
    priceNormal: 41.99,
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'pewter')!,
    ],
    variants: [
      { id: 'v12-1', colorId: 'black', size: 'XS', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-12-black-1.jpg'], sku: 'WW124-BLK-XS-R' },
      { id: 'v12-2', colorId: 'black', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-12-black-1.jpg'], sku: 'WW124-BLK-S-R' },
      { id: 'v12-3', colorId: 'navy', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-12-navy-1.jpg'], sku: 'WW124-NVY-S-R' },
      { id: 'v12-4', colorId: 'pewter', size: 'M', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-12-pewter-1.jpg'], sku: 'WW124-PWT-M-R' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    availableFits: ['Regular', 'Tall'],
    isNew: true,
    isBestSeller: false,
    relatedProducts: ['11'],
    complementaryProduct: '11',
  },
  {
    id: '13',
    slug: 'koi-basics-scrub-top',
    name: 'Koi Basics Scrub Top',
    brand: 'Koi',
    category: 'Camisas',
    gender: 'Mujer',
    description: 'Top básico de Koi con diseño simple y funcionalidad excepcional. Calidad accesible.',
    features: [
      'Diseño clásico atemporal',
      '3 bolsillos funcionales',
      'Cuello en V',
      'Tejido suave',
      'Fácil cuidado',
    ],
    careInstructions: [
      'Lavar a máquina',
      'No usar blanqueador',
      'Secar a baja temperatura',
    ],
    priceNormal: 35.99,
    priceSale: 29.99,
    discountPct: 17,
    discountEnd: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'white')!,
      AVAILABLE_COLORS.find(c => c.id === 'pink-tonic')!,
    ],
    variants: [
      { id: 'v13-1', colorId: 'black', size: 'XS', status: 'AVAILABLE', images: ['/images/product-13-black-1.jpg'], sku: 'KOI100-BLK-XS' },
      { id: 'v13-2', colorId: 'black', size: 'S', status: 'AVAILABLE', images: ['/images/product-13-black-1.jpg'], sku: 'KOI100-BLK-S' },
      { id: 'v13-3', colorId: 'navy', size: 'S', status: 'AVAILABLE', images: ['/images/product-13-navy-1.jpg'], sku: 'KOI100-NVY-S' },
      { id: 'v13-4', colorId: 'white', size: 'M', status: 'AVAILABLE', images: ['/images/product-13-white-1.jpg'], sku: 'KOI100-WHT-M' },
      { id: 'v13-5', colorId: 'pink-tonic', size: 'L', status: 'OUT_OF_STOCK', images: ['/images/product-13-pink-1.jpg'], sku: 'KOI100-PTN-L' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    isNew: false,
    isBestSeller: false,
    relatedProducts: ['14'],
    complementaryProduct: '14',
  },
  {
    id: '14',
    slug: 'koi-basics-scrub-pant',
    name: 'Koi Basics Scrub Pant',
    brand: 'Koi',
    category: 'Pantalones',
    gender: 'Mujer',
    description: 'Pantalón básico de Koi con corte recto y comodidad excepcional. El básico perfecto.',
    features: [
      'Corte recto clásico',
      '4 bolsillos',
      'Cintura elástica',
      'Tejido suave',
      'Fácil cuidado',
    ],
    careInstructions: [
      'Lavar a máquina',
      'No usar blanqueador',
      'Secar a baja temperatura',
    ],
    priceNormal: 37.99,
    priceSale: 31.99,
    discountPct: 16,
    discountEnd: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'white')!,
    ],
    variants: [
      { id: 'v14-1', colorId: 'black', size: 'XS', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-14-black-1.jpg'], sku: 'KOI101-BLK-XS-R' },
      { id: 'v14-2', colorId: 'black', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-14-black-1.jpg'], sku: 'KOI101-BLK-S-R' },
      { id: 'v14-3', colorId: 'navy', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-14-navy-1.jpg'], sku: 'KOI101-NVY-S-R' },
      { id: 'v14-4', colorId: 'white', size: 'M', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-14-white-1.jpg'], sku: 'KOI101-WHT-M-R' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    availableFits: ['Regular', 'Tall'],
    isNew: false,
    isBestSeller: false,
    relatedProducts: ['13'],
    complementaryProduct: '13',
  },
  {
    id: '15',
    slug: 'jaanuu-performance-scrub-top',
    name: 'Jaanuu Performance Scrub Top',
    brand: 'Jaanuu',
    category: 'Camisas',
    gender: 'Mujer',
    description: 'Top de alto rendimiento con tecnología antibacteriana y diseño contemporáneo.',
    features: [
      'Tecnología SILVADUR antibacteriana',
      'Tejido ultra-stretch',
      '5 bolsillos funcionales',
      'Cuello en V asimétrico',
      'Secado ultra-rápido',
    ],
    careInstructions: [
      'Lavar en agua fría',
      'No usar suavizante',
      'Secar a baja temperatura',
    ],
    priceNormal: 58.00,
    volumeDiscounts: [
      { minQty: 1, discountPct: 0, label: '1-3 unidades' },
      { minQty: 4, discountPct: 10, label: '4-7 unidades' },
      { minQty: 8, discountPct: 15, label: '8+ unidades' },
    ],
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'mythic-blue')!,
      AVAILABLE_COLORS.find(c => c.id === 'olive')!,
    ],
    variants: [
      { id: 'v15-1', colorId: 'black', size: 'XS', status: 'AVAILABLE', images: ['/images/product-15-black-1.jpg'], sku: 'JN200-BLK-XS' },
      { id: 'v15-2', colorId: 'black', size: 'S', status: 'AVAILABLE', images: ['/images/product-15-black-1.jpg'], sku: 'JN200-BLK-S' },
      { id: 'v15-3', colorId: 'navy', size: 'S', status: 'AVAILABLE', images: ['/images/product-15-navy-1.jpg'], sku: 'JN200-NVY-S' },
      { id: 'v15-4', colorId: 'mythic-blue', size: 'M', status: 'AVAILABLE', images: ['/images/product-15-mythic-1.jpg'], sku: 'JN200-MYB-M' },
      { id: 'v15-5', colorId: 'olive', size: 'L', status: 'BACKORDER', images: ['/images/product-15-olive-1.jpg'], sku: 'JN200-OLV-L' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    isNew: true,
    isBestSeller: true,
    relatedProducts: ['16'],
    complementaryProduct: '16',
  },
  {
    id: '16',
    slug: 'jaanuu-performance-scrub-pant',
    name: 'Jaanuu Performance Scrub Pant',
    brand: 'Jaanuu',
    category: 'Pantalones',
    gender: 'Mujer',
    description: 'Pantalón de alto rendimiento con tecnología antibacteriana y corte moderno.',
    features: [
      'Tecnología SILVADUR antibacteriana',
      'Corte skinny moderno',
      '7 bolsillos funcionales',
      'Cintura elástica de 4"',
      'Tejido ultra-stretch',
    ],
    careInstructions: [
      'Lavar en agua fría',
      'No usar suavizante',
      'Secar a baja temperatura',
    ],
    priceNormal: 62.00,
    volumeDiscounts: [
      { minQty: 1, discountPct: 0, label: '1-3 unidades' },
      { minQty: 4, discountPct: 10, label: '4-7 unidades' },
      { minQty: 8, discountPct: 15, label: '8+ unidades' },
    ],
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'mythic-blue')!,
    ],
    variants: [
      { id: 'v16-1', colorId: 'black', size: 'XS', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-16-black-1.jpg'], sku: 'JN201-BLK-XS-R' },
      { id: 'v16-2', colorId: 'black', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-16-black-1.jpg'], sku: 'JN201-BLK-S-R' },
      { id: 'v16-3', colorId: 'navy', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-16-navy-1.jpg'], sku: 'JN201-NVY-S-R' },
      { id: 'v16-4', colorId: 'mythic-blue', size: 'M', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-16-mythic-1.jpg'], sku: 'JN201-MYB-M-R' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    availableFits: ['Petite', 'Regular', 'Tall'],
    isNew: true,
    isBestSeller: true,
    relatedProducts: ['15'],
    complementaryProduct: '15',
  },
  {
    id: '17',
    slug: 'med-couture-activate-top',
    name: 'Med Couture Activate Top',
    brand: 'Med Couture',
    category: 'Camisas',
    gender: 'Mujer',
    description: 'Top de la línea Activate con tejido deportivo y máxima movilidad.',
    features: [
      'Tejido deportivo stretch',
      'Cuello en V moderno',
      '4 bolsillos funcionales',
      'Paneles de malla transpirable',
      'Secado rápido',
    ],
    careInstructions: [
      'Lavar a máquina',
      'No usar blanqueador',
      'Secar a baja temperatura',
    ],
    priceNormal: 44.99,
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'caribbean-blue')!,
      AVAILABLE_COLORS.find(c => c.id === 'grape')!,
    ],
    variants: [
      { id: 'v17-1', colorId: 'black', size: 'XS', status: 'AVAILABLE', images: ['/images/product-17-black-1.jpg'], sku: 'MC500-BLK-XS' },
      { id: 'v17-2', colorId: 'black', size: 'S', status: 'AVAILABLE', images: ['/images/product-17-black-1.jpg'], sku: 'MC500-BLK-S' },
      { id: 'v17-3', colorId: 'navy', size: 'S', status: 'AVAILABLE', images: ['/images/product-17-navy-1.jpg'], sku: 'MC500-NVY-S' },
      { id: 'v17-4', colorId: 'caribbean-blue', size: 'M', status: 'AVAILABLE', images: ['/images/product-17-carib-1.jpg'], sku: 'MC500-CAB-M' },
      { id: 'v17-5', colorId: 'grape', size: 'L', status: 'AVAILABLE', images: ['/images/product-17-grape-1.jpg'], sku: 'MC500-GRP-L' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    isNew: false,
    isBestSeller: false,
    relatedProducts: ['18'],
    complementaryProduct: '18',
  },
  {
    id: '18',
    slug: 'med-couture-activate-pant',
    name: 'Med Couture Activate Pant',
    brand: 'Med Couture',
    category: 'Pantalones',
    gender: 'Mujer',
    description: 'Pantalón deportivo de la línea Activate con corte jogger moderno.',
    features: [
      'Corte jogger moderno',
      'Puños elásticos en tobillo',
      '6 bolsillos funcionales',
      'Tejido deportivo stretch',
      'Cintura elástica ancha',
    ],
    careInstructions: [
      'Lavar a máquina',
      'No usar blanqueador',
      'Secar a baja temperatura',
    ],
    priceNormal: 47.99,
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'caribbean-blue')!,
    ],
    variants: [
      { id: 'v18-1', colorId: 'black', size: 'XS', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-18-black-1.jpg'], sku: 'MC501-BLK-XS-R' },
      { id: 'v18-2', colorId: 'black', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-18-black-1.jpg'], sku: 'MC501-BLK-S-R' },
      { id: 'v18-3', colorId: 'navy', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-18-navy-1.jpg'], sku: 'MC501-NVY-S-R' },
      { id: 'v18-4', colorId: 'caribbean-blue', size: 'M', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-18-carib-1.jpg'], sku: 'MC501-CAB-M-R' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    availableFits: ['Regular'],
    isNew: false,
    isBestSeller: false,
    relatedProducts: ['17'],
    complementaryProduct: '17',
  },
  {
    id: '19',
    slug: 'landau-womens-lab-coat',
    name: 'Landau Women\'s Lab Coat',
    brand: 'Landau',
    category: 'Batas',
    gender: 'Mujer',
    description: 'Bata de laboratorio clásica de alta calidad con corte femenino.',
    features: [
      'Largo 32"',
      'Tejido de sarga premium',
      '3 bolsillos exteriores',
      '1 bolsillo interior',
      'Cierre de botones',
    ],
    careInstructions: [
      'Lavar en agua tibia',
      'Usar blanqueador si es necesario',
      'Planchar a temperatura alta',
    ],
    priceNormal: 65.99,
    priceSale: 55.99,
    discountPct: 15,
    discountEnd: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'white')!,
    ],
    variants: [
      { id: 'v19-1', colorId: 'white', size: 'XS', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-19-white-1.jpg'], sku: 'LD800-WHT-XS-R' },
      { id: 'v19-2', colorId: 'white', size: 'S', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-19-white-1.jpg'], sku: 'LD800-WHT-S-R' },
      { id: 'v19-3', colorId: 'white', size: 'M', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-19-white-1.jpg'], sku: 'LD800-WHT-M-R' },
      { id: 'v19-4', colorId: 'white', size: 'L', fit: 'Regular', status: 'AVAILABLE', images: ['/images/product-19-white-1.jpg'], sku: 'LD800-WHT-L-R' },
      { id: 'v19-5', colorId: 'white', size: 'XL', fit: 'Regular', status: 'BACKORDER', images: ['/images/product-19-white-1.jpg'], sku: 'LD800-WHT-XL-R' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    availableFits: ['Petite', 'Regular', 'Tall'],
    isNew: false,
    isBestSeller: true,
    relatedProducts: ['1', '2'],
  },
  {
    id: '20',
    slug: 'carhartt-liberty-scrub-jacket',
    name: 'Carhartt Liberty Scrub Jacket',
    brand: 'Carhartt Liberty',
    category: 'Chaquetas',
    gender: 'Mujer',
    description: 'Chaqueta médica resistente con estilo Carhartt. Perfecta para mantenerte abrigada.',
    features: [
      'Tejido ripstop resistente',
      'Cierre frontal de snaps',
      '4 bolsillos funcionales',
      'Puños elásticos',
      'Forro suave',
    ],
    careInstructions: [
      'Lavar a máquina',
      'No usar blanqueador',
      'Secar a baja temperatura',
    ],
    priceNormal: 59.99,
    volumeDiscounts: standardVolumeDiscounts,
    colors: [
      AVAILABLE_COLORS.find(c => c.id === 'black')!,
      AVAILABLE_COLORS.find(c => c.id === 'navy')!,
      AVAILABLE_COLORS.find(c => c.id === 'espresso')!,
    ],
    variants: [
      { id: 'v20-1', colorId: 'black', size: 'XS', status: 'AVAILABLE', images: ['/images/product-20-black-1.jpg'], sku: 'CH900-BLK-XS' },
      { id: 'v20-2', colorId: 'black', size: 'S', status: 'AVAILABLE', images: ['/images/product-20-black-1.jpg'], sku: 'CH900-BLK-S' },
      { id: 'v20-3', colorId: 'black', size: 'M', status: 'AVAILABLE', images: ['/images/product-20-black-1.jpg'], sku: 'CH900-BLK-M' },
      { id: 'v20-4', colorId: 'navy', size: 'S', status: 'AVAILABLE', images: ['/images/product-20-navy-1.jpg'], sku: 'CH900-NVY-S' },
      { id: 'v20-5', colorId: 'espresso', size: 'M', status: 'AVAILABLE', images: ['/images/product-20-espresso-1.jpg'], sku: 'CH900-ESP-M' },
    ],
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    isNew: true,
    isBestSeller: false,
    relatedProducts: ['1', '2'],
  },
];

// ============================================
// SUCURSALES
// ============================================

export const STORES: Store[] = [
  {
    id: '1',
    name: 'MATRIZ - Shyris',
    address: 'Av. De los Shyris y El Universo, Quito',
    hours: 'Lun-Vie 9:00 - 18:00, Sáb 9:00 - 17:00',
    mapUrl: 'https://maps.google.com/?q=Av.+De+los+Shyris+y+El+Universo,Quito',
    isMain: true,
  },
  {
    id: '2',
    name: 'Eloy Alfaro',
    address: 'Av. Eloy Alfaro y Checoslovaquia Local 2, Quito',
    hours: 'Lun-Vie 9:00 - 18:00, Sáb 9:00 - 17:00',
    mapUrl: 'https://maps.google.com/?q=Av.+Eloy+Alfaro+y+Checoslovaquia,Quito',
  },
  {
    id: '3',
    name: 'Riocentro Shopping',
    address: 'Al lado de Pharmacy\'s, Riocentro Shopping, Quito',
    hours: 'Dom-Jue 10:00 - 21:00, Vie-Sáb 10:00 - 22:00',
    mapUrl: 'https://maps.google.com/?q=Riocentro+Shopping,Quito',
  },
  {
    id: '4',
    name: 'C.C. El Bosque',
    address: 'Diagonal al Banco Pichincha, Local 260, Quito',
    hours: 'Lun-Sáb 10:00 - 20:00, Dom 10:00 - 19:00',
    mapUrl: 'https://maps.google.com/?q=CC+El+Bosque,Quito',
  },
  {
    id: '5',
    name: 'C.C. Villa Cumbayá',
    address: 'Local 34 (cerca de Supermaxi), Cumbayá',
    hours: 'Lun-Sáb 10:00 - 19:00, Dom 10:00 - 17:00',
    mapUrl: 'https://maps.google.com/?q=CC+Villa+Cumbaya',
  },
];

// ============================================
// HERO SLIDES
// ============================================

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: '1',
    image: '/images/hero-1.jpg',
    title: 'Uniformes que trabajan contigo',
    subtitle: 'Descubre la colección 2025 de las mejores marcas médicas',
    cta: 'Ver Colección',
    ctaLink: '/catalogo',
  },
  {
    id: '2',
    image: '/images/hero-2.jpg',
    title: 'FIGS: Tecnología en cada fibra',
    subtitle: 'La marca más innovadora del mundo médico ya en Ecuador',
    cta: 'Explorar FIGS',
    ctaLink: '/catalogo?brand=FIGS',
  },
  {
    id: '3',
    image: '/images/hero-3.jpg',
    title: 'Descuentos por volumen',
    subtitle: 'Ahorra hasta 15% en compras de 10+ unidades',
    cta: 'Cotizar Ahora',
    ctaLink: '/catalogo',
  },
];

// ============================================
// FUNCIONES AUXILIARES
// ============================================

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find(p => p.slug === slug);
}

export function getProductsByBrand(brand: string): Product[] {
  return PRODUCTS.filter(p => p.brand === brand);
}

export function getProductsByCategory(category: string): Product[] {
  return PRODUCTS.filter(p => p.category === category);
}

export function getFeaturedProducts(): Product[] {
  return PRODUCTS.filter(p => p.isBestSeller).slice(0, 8);
}

export function getNewProducts(): Product[] {
  return PRODUCTS.filter(p => p.isNew).slice(0, 4);
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
    
    // Search in fits
    const fitMatch = p.availableFits?.some(f => 
      f.toLowerCase().includes(lowerQuery)
    );
    if (fitMatch) return true;
    
    // Search in features
    const featureMatch = p.features.some(f => 
      f.toLowerCase().includes(lowerQuery)
    );
    if (featureMatch) return true;
    
    // Search in variants (SKU)
    const variantMatch = p.variants.some(v => 
      v.sku.toLowerCase().includes(lowerQuery) ||
      v.size.toLowerCase().includes(lowerQuery) ||
      (v.fit && v.fit.toLowerCase().includes(lowerQuery))
    );
    if (variantMatch) return true;
    
    return false;
  });
}

export function filterProducts(filters: {
  gender?: string;
  categories?: string[];
  brands?: string[];
  colors?: string[];
  sizes?: string[];
  fits?: string[];
  priceMin?: number;
  priceMax?: number;
}): Product[] {
  return PRODUCTS.filter(p => {
    if (filters.gender && p.gender !== filters.gender) return false;
    if (filters.categories?.length && !filters.categories.includes(p.category)) return false;
    if (filters.brands?.length && !filters.brands.includes(p.brand)) return false;
    if (filters.colors?.length && !p.colors.some(c => filters.colors?.includes(c.id))) return false;
    if (filters.sizes?.length && !p.availableSizes.some(s => filters.sizes?.includes(s))) return false;
    if (filters.fits?.length && !p.availableFits?.some(f => filters.fits?.includes(f))) return false;
    const price = p.priceSale || p.priceNormal;
    if (filters.priceMin !== undefined && price < filters.priceMin) return false;
    if (filters.priceMax !== undefined && price > filters.priceMax) return false;
    return true;
  });
}

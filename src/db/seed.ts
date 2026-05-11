import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

// ── Seed data ──

const brandsData = [
  { id: 'brand-figs', name: 'FIGS', slug: 'figs', description: 'Tecnología médica de vanguardia', logoUrl: '/images/brands/figs.png', sortOrder: 1 },
  { id: 'brand-cherokee', name: 'Cherokee', slug: 'cherokee', description: 'Tradición y calidad', logoUrl: '/images/brands/cherokee.png', sortOrder: 2 },
  { id: 'brand-greys', name: "Grey's Anatomy", slug: 'greys-anatomy', description: 'El clásico atemporal', logoUrl: '/images/brands/greys-anatomy.png', sortOrder: 3 },
  { id: 'brand-wonderwink', name: 'WonderWink', slug: 'wonderwink', description: 'Diseño moderno', logoUrl: '/images/brands/wonderwink.png', sortOrder: 4 },
  { id: 'brand-koi', name: 'Koi', slug: 'koi', description: 'Diseños únicos', logoUrl: '/images/brands/koi.png', sortOrder: 5 },
  { id: 'brand-dickies', name: 'Dickies', slug: 'dickies', description: 'Resistencia extrema', logoUrl: '/images/brands/dickies.png', sortOrder: 6 },
];

const colorsData = [
  { id: 'color-navy', name: 'Navy', code: 'NV', hex: '#1B365D' },
  { id: 'color-black', name: 'Black', code: 'BK', hex: '#000000' },
  { id: 'color-white', name: 'White', code: 'WH', hex: '#FFFFFF' },
  { id: 'color-ceil', name: 'Ceil Blue', code: 'CB', hex: '#89CFF0' },
  { id: 'color-wine', name: 'Wine', code: 'WN', hex: '#722F37' },
  { id: 'color-teal', name: 'Teal', code: 'TL', hex: '#008080' },
  { id: 'color-burgundy', name: 'Burgundy', code: 'BG', hex: '#800020' },
  { id: 'color-royal', name: 'Royal Blue', code: 'RB', hex: '#4169E1' },
];

const productsData = [
  {
    id: 'prod-figs-casma',
    slug: 'figs-casma-scrub-top',
    name: 'Casma Scrub Top',
    description: 'El Casma Scrub Top de FIGS combina estilo y funcionalidad. Con tejido elástico de cuatro direcciones y tecnología FIONx que repele líquidos.',
    sku: 'FIGS-CASMA',
    brandId: 'brand-figs',
    category: 'Camisas',
    gender: 'MUJER',
    priceNormal: '48.00',
    priceSale: '38.40',
    discountPct: 20,
    isNew: true,
    isBestSeller: true,
    features: ['Tejido FIONx elástico de 4 direcciones', 'Tecnología anti-microbiana', 'Bolsillos laterales profundos', 'Cuello en V moderno', 'Ajuste atlético'],
    careInstructions: ['Lavar en agua fría', 'No usar blanqueador', 'Secar a baja temperatura', 'Planchar a temperatura media'],
  },
  {
    id: 'prod-figs-yola',
    slug: 'figs-yola-scrub-pants',
    name: 'Yola Scrub Pants',
    description: 'Pantalones scrub Yola con cintura elástica y ajuste cómodo. Perfectos para largas jornadas de trabajo.',
    sku: 'FIGS-YOLA',
    brandId: 'brand-figs',
    category: 'Pantalones',
    gender: 'MUJER',
    priceNormal: '52.00',
    priceSale: null,
    discountPct: null,
    isNew: false,
    isBestSeller: true,
    features: ['Cintura elástica ajustable', 'Bolsillos cargo laterales', 'Tejido transpirable', 'Resistente a arrugas'],
    careInstructions: ['Lavar en ciclo suave', 'No usar suavizante', 'Secar al aire libre preferiblemente'],
  },
  {
    id: 'prod-cherokee-workwear',
    slug: 'cherokee-workwear-scrub-top',
    name: 'Workwear Scrub Top',
    description: 'El clásico scrub top de Cherokee Workwear. Duradero, cómodo y asequible.',
    sku: 'CHK-WW',
    brandId: 'brand-cherokee',
    category: 'Camisas',
    gender: 'UNISEX',
    priceNormal: '24.99',
    priceSale: '19.99',
    discountPct: 20,
    isNew: false,
    isBestSeller: true,
    features: ['Mezcla de poliéster y algodón', 'Dos bolsillos frontales', 'Cuello en V', 'Fácil cuidado'],
    careInstructions: ['Lavar a máquina', 'Secar en secadora', 'No necesita plancha'],
  },
  {
    id: 'prod-greys-lexie',
    slug: 'greys-anatomy-lexie-scrub-top',
    name: 'Lexie Scrub Top',
    description: 'Elegante scrub top con detalles de moda. Tejido suave que se siente increíble contra la piel.',
    sku: 'GA-LEXIE',
    brandId: 'brand-greys',
    category: 'Camisas',
    gender: 'MUJER',
    priceNormal: '38.00',
    priceSale: null,
    discountPct: null,
    isNew: true,
    isBestSeller: false,
    features: ['Tejido suave y elástico', 'Detalles de costuras decorativas', 'Bolsillos funcionales', 'Ajuste favorecedor'],
    careInstructions: ['Lavar en agua fría', 'Secar a baja temperatura'],
  },
  {
    id: 'prod-wonderwink-four',
    slug: 'wonderwink-four-stretch-scrub-top',
    name: 'Four-Stretch Scrub Top',
    description: 'Scrub top con elástico de cuatro direcciones para máxima comodidad y movimiento.',
    sku: 'WW-4ST',
    brandId: 'brand-wonderwink',
    category: 'Camisas',
    gender: 'MUJER',
    priceNormal: '32.00',
    priceSale: '25.60',
    discountPct: 20,
    isNew: false,
    isBestSeller: true,
    features: ['Elástico de 4 direcciones', 'Bolsillos múltiples', 'Cuello redondo', 'Colores vibrantes'],
    careInstructions: ['Lavar a máquina', 'No usar blanqueador'],
  },
  {
    id: 'prod-koi-lindsey',
    slug: 'koi-lindsey-scrub-pants',
    name: 'Lindsey Scrub Pants',
    description: 'Pantalones scrub Lindsey con estilo único y funcionalidad superior.',
    sku: 'KOI-LND',
    brandId: 'brand-koi',
    category: 'Pantalones',
    gender: 'MUJER',
    priceNormal: '42.00',
    priceSale: null,
    discountPct: null,
    isNew: true,
    isBestSeller: false,
    features: ['Diseño de carga con múltiples bolsillos', 'Cintura ajustable con cordón', 'Tejido duradero', 'Colores de moda'],
    careInstructions: ['Lavar en agua fría', 'Secar en secadora a baja temperatura'],
  },
  {
    id: 'prod-dickies-eds',
    slug: 'dickies-eds-scrub-top',
    name: 'EDS Scrub Top',
    description: 'El clásico EDS de Dickies. Confiabilidad y durabilidad desde 1922.',
    sku: 'DK-EDS',
    brandId: 'brand-dickies',
    category: 'Camisas',
    gender: 'UNISEX',
    priceNormal: '22.00',
    priceSale: '17.60',
    discountPct: 20,
    isNew: false,
    isBestSeller: true,
    features: ['Tejido resistente', 'Costuras reforzadas', 'Bolsillos funcionales', 'Fácil mantenimiento'],
    careInstructions: ['Lavar a máquina', 'Secar en secadora', 'No necesita plancha'],
  },
  {
    id: 'prod-figs-catarina',
    slug: 'figs-catarina-scrub-top',
    name: 'Catarina Scrub Top',
    description: 'Scrub top Catarina con diseño elegante y funcionalidad superior.',
    sku: 'FIGS-CAT',
    brandId: 'brand-figs',
    category: 'Camisas',
    gender: 'MUJER',
    priceNormal: '46.00',
    priceSale: null,
    discountPct: null,
    isNew: true,
    isBestSeller: true,
    features: ['Tejido FIONx premium', 'Diseño asimétrico moderno', 'Múltiples bolsillos', 'Ajuste favorecedor'],
    careInstructions: ['Lavar en agua fría', 'Secar a baja temperatura'],
  },
];

// Helper to generate variants
function generateVariants(productId: string, colorIds: string[], sizes: string[]) {
  const variants: Array<{
    id: string;
    productId: string;
    colorId: string;
    size: string;
    sku: string;
    status: string;
  }> = [];
  let statusIdx = 0;
  const statuses = ['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'BACKORDER', 'OUT_OF_STOCK'];
  for (const colorId of colorIds) {
    for (const size of sizes) {
      const sku = `${productId}-${colorId.toUpperCase().replace('COLOR-', '')}-${size}`;
      variants.push({
        id: `${productId}-var-${variants.length}`,
        productId,
        colorId,
        size,
        sku,
        status: statuses[statusIdx % statuses.length],
      });
      statusIdx++;
    }
  }
  return variants;
}

const variantsData = [
  ...generateVariants('prod-figs-casma', ['color-navy', 'color-black', 'color-ceil', 'color-burgundy'], ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
  ...generateVariants('prod-figs-yola', ['color-navy', 'color-black', 'color-wine'], ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
  ...generateVariants('prod-cherokee-workwear', ['color-navy', 'color-black', 'color-white', 'color-ceil'], ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']),
  ...generateVariants('prod-greys-lexie', ['color-navy', 'color-black', 'color-teal'], ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
  ...generateVariants('prod-wonderwink-four', ['color-navy', 'color-black', 'color-wine', 'color-burgundy'], ['XS', 'S', 'M', 'L', 'XL', '2XL']),
  ...generateVariants('prod-koi-lindsey', ['color-navy', 'color-black', 'color-ceil'], ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
  ...generateVariants('prod-dickies-eds', ['color-navy', 'color-black', 'color-white'], ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']),
  ...generateVariants('prod-figs-catarina', ['color-navy', 'color-black', 'color-burgundy', 'color-royal'], ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
];

// Image mapping from dummy-data
const productImageMap: Record<string, Record<string, string>> = {
  'prod-figs-casma': { navy: 'navy', black: 'black', ceil: 'ciel', burgundy: 'wine' },
  'prod-figs-yola': { navy: 'navy', black: 'black', wine: 'navy' },
  'prod-cherokee-workwear': { navy: 'navy', black: 'black', white: 'salt', ceil: 'teal' },
  'prod-greys-lexie': { navy: 'navy', black: 'black', teal: 'navy' },
  'prod-wonderwink-four': { navy: 'navy', black: 'black', wine: 'ciel', burgundy: 'coral' },
  'prod-koi-lindsey': { navy: 'navy', black: 'black', ceil: 'ciel' },
  'prod-dickies-eds': { navy: 'navy', black: 'black', white: 'pewter' },
  'prod-figs-catarina': { navy: 'navy', black: 'black', burgundy: 'navy', royal: 'navy' },
};

const productImageNum: Record<string, number> = {
  'prod-figs-casma': 1,
  'prod-figs-yola': 2,
  'prod-cherokee-workwear': 3,
  'prod-greys-lexie': 4,
  'prod-wonderwink-four': 5,
  'prod-koi-lindsey': 6,
  'prod-dickies-eds': 7,
  'prod-figs-catarina': 8,
};

function generateImages(productId: string, colorIds: string[]) {
  const imgNum = productImageNum[productId] || 1;
  const colorMap = productImageMap[productId] || {};
  const images: Array<{ id: string; productId: string; colorId: string | null; url: string; alt: string; sortOrder: number }> = [];
  let sortOrder = 0;
  for (const colorId of colorIds) {
    const colorName = colorId.replace('color-', '');
    const fileColor = colorMap[colorName] || 'navy';
    images.push({
      id: `${productId}-img-${sortOrder}`,
      productId,
      colorId,
      url: `/images/product-${imgNum}-${fileColor}-1.jpg`,
      alt: `${productId} ${colorName}`,
      sortOrder: sortOrder++,
    });
  }
  return images;
}

const imagesData = [
  ...generateImages('prod-figs-casma', ['color-navy', 'color-black', 'color-ceil', 'color-burgundy']),
  ...generateImages('prod-figs-yola', ['color-navy', 'color-black', 'color-wine']),
  ...generateImages('prod-cherokee-workwear', ['color-navy', 'color-black', 'color-white', 'color-ceil']),
  ...generateImages('prod-greys-lexie', ['color-navy', 'color-black', 'color-teal']),
  ...generateImages('prod-wonderwink-four', ['color-navy', 'color-black', 'color-wine', 'color-burgundy']),
  ...generateImages('prod-koi-lindsey', ['color-navy', 'color-black', 'color-ceil']),
  ...generateImages('prod-dickies-eds', ['color-navy', 'color-black', 'color-white']),
  ...generateImages('prod-figs-catarina', ['color-navy', 'color-black', 'color-burgundy', 'color-royal']),
];

const storesData = [
  { id: 'store-quito', name: 'AllMedic Quito - Matriz', address: 'Av. 6 de Diciembre N34-123, Quito, Ecuador', phone: '+593 2 123 4567', hours: 'Lun - Vie: 9:00 - 18:00, Sáb: 10:00 - 14:00', isMain: true, isActive: true, sortOrder: 1 },
  { id: 'store-gye', name: 'AllMedic Guayaquil', address: 'Av. 9 de Octubre 1234, Guayaquil, Ecuador', phone: '+593 4 234 5678', hours: 'Lun - Vie: 9:00 - 18:00, Sáb: 10:00 - 14:00', isMain: false, isActive: true, sortOrder: 2 },
  { id: 'store-cue', name: 'AllMedic Cuenca', address: 'Calle Larga 567, Cuenca, Ecuador', phone: '+593 7 345 6789', hours: 'Lun - Vie: 9:00 - 18:00, Sáb: 10:00 - 14:00', isMain: false, isActive: true, sortOrder: 3 },
];

const bannersData = [
  { id: 'banner-1', title: 'Uniformes médicos de alta calidad', subtitle: 'Descubre nuestra colección de scrubs premium diseñados para profesionales de la salud.', imageDesktop: '/images/hero-1.jpg', imageMobile: '/images/hero-1-mobile.jpg', ctaText: 'Ver catálogo', ctaLink: '/catalogo', sortOrder: 1, isActive: true },
  { id: 'banner-2', title: 'Nueva colección FIGS 2024', subtitle: 'Los scrubs más cómodos y estilosos del mercado. Tecnología FIONx de última generación.', imageDesktop: '/images/hero-2.jpg', imageMobile: '/images/hero-2-mobile.jpg', ctaText: 'Descubrir', ctaLink: '/catalogo?brand=FIGS', sortOrder: 2, isActive: true },
  { id: 'banner-3', title: 'Descuentos en Cherokee', subtitle: 'Hasta 20% de descuento en toda la línea Cherokee Workwear.', imageDesktop: '/images/hero-3.jpg', imageMobile: '/images/hero-3-mobile.jpg', ctaText: 'Ver ofertas', ctaLink: '/catalogo?brand=Cherokee', sortOrder: 3, isActive: true },
];

async function seed() {
  console.log('🌱 Starting seed...');

  // Clear existing data (respecting FK constraints)
  console.log('  Clearing existing data...');
  await db.delete(schema.productImages);
  await db.delete(schema.productVariants);
  await db.delete(schema.products);
  await db.delete(schema.collections);
  await db.delete(schema.colors);
  await db.delete(schema.brands);
  await db.delete(schema.banners);
  await db.delete(schema.stores);

  // Insert brands
  console.log('  Inserting brands...');
  for (const b of brandsData) {
    await db.insert(schema.brands).values(b);
  }

  // Insert colors
  console.log('  Inserting colors...');
  for (const c of colorsData) {
    await db.insert(schema.colors).values(c);
  }

  // Insert products
  console.log('  Inserting products...');
  for (const p of productsData) {
    await db.insert(schema.products).values(p as any);
  }

  // Insert variants
  console.log('  Inserting variants...');
  for (const v of variantsData) {
    await db.insert(schema.productVariants).values(v as any);
  }

  // Insert images
  console.log('  Inserting images...');
  for (const img of imagesData) {
    await db.insert(schema.productImages).values(img as any);
  }

  // Insert stores
  console.log('  Inserting stores...');
  for (const s of storesData) {
    await db.insert(schema.stores).values(s as any);
  }

  // Insert banners
  console.log('  Inserting banners...');
  for (const b of bannersData) {
    await db.insert(schema.banners).values(b as any);
  }

  console.log('✅ Seed completed successfully!');
  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

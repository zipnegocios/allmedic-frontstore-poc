#!/usr/bin/env tsx
/**
 * Seed Script: Inserta datos dummy en PostgreSQL
 * 
 * Uso:
 *   DATABASE_URL=postgres://... npx tsx scripts/seed-postgres.ts
 */

import { db } from '../src/db';
import {
  brands,
  colors,
  products,
  productVariants,
  productImages,
  stores,
  banners,
} from '../src/db/schema';
import { v4 as uuid } from 'uuid';

// ─── UUIDs fijos para consistencia ───
const BRAND_IDS = {
  figs: '11111111-1111-1111-1111-111111111111',
  cherokee: '22222222-2222-2222-2222-222222222222',
  greys: '33333333-3333-3333-3333-333333333333',
  wonderwink: '44444444-4444-4444-4444-444444444444',
  koi: '55555555-5555-5555-5555-555555555555',
  dickies: '66666666-6666-6666-6666-666666666666',
};

const COLOR_IDS = {
  navy: 'a1111111-1111-1111-1111-111111111111',
  black: 'a2222222-2222-2222-2222-222222222222',
  white: 'a3333333-3333-3333-3333-333333333333',
  ceil: 'a4444444-4444-4444-4444-444444444444',
  wine: 'a5555555-5555-5555-5555-555555555555',
  teal: 'a6666666-6666-6666-6666-666666666666',
  burgundy: 'a7777777-7777-7777-7777-777777777777',
  royal: 'a8888888-8888-8888-8888-888888888888',
};

const PRODUCT_IDS = {
  'figs-casma': 'b1111111-1111-1111-1111-111111111111',
  'figs-yola': 'b2222222-2222-2222-2222-222222222222',
  'cherokee-workwear': 'b3333333-3333-3333-3333-333333333333',
  'greys-lexie': 'b4444444-4444-4444-4444-444444444444',
  'wonderwink-four': 'b5555555-5555-5555-5555-555555555555',
  'koi-lindsey': 'b6666666-6666-6666-6666-666666666666',
  'dickies-eds': 'b7777777-7777-7777-7777-777777777777',
  'figs-catarina': 'b8888888-8888-8888-8888-888888888888',
};

// ─── Datos de seed ───

const SEED_BRANDS = [
  { id: BRAND_IDS.figs, name: 'FIGS', slug: 'figs', description: 'Scrubs premium con tecnología FIONx', logoUrl: '/images/brands/figs.png', isActive: true, sortOrder: 1 },
  { id: BRAND_IDS.cherokee, name: 'Cherokee', slug: 'cherokee', description: 'Clásicos duraderos y asequibles', logoUrl: '/images/brands/cherokee.png', isActive: true, sortOrder: 2 },
  { id: BRAND_IDS.greys, name: "Grey's Anatomy", slug: 'greys-anatomy', description: 'Elegancia y suavidad', logoUrl: '/images/brands/greys-anatomy.png', isActive: true, sortOrder: 3 },
  { id: BRAND_IDS.wonderwink, name: 'WonderWink', slug: 'wonderwink', description: 'Colores vibrantes y cómodos', logoUrl: '/images/brands/wonderwink.png', isActive: true, sortOrder: 4 },
  { id: BRAND_IDS.koi, name: 'Koi', slug: 'koi', description: 'Estilo único y funcionalidad', logoUrl: '/images/brands/koi.png', isActive: true, sortOrder: 5 },
  { id: BRAND_IDS.dickies, name: 'Dickies', slug: 'dickies', description: 'Confiabilidad desde 1922', logoUrl: '/images/brands/dickies.png', isActive: true, sortOrder: 6 },
];

const SEED_COLORS = [
  { id: COLOR_IDS.navy, name: 'Navy', code: 'NV', hex: '#1B365D' },
  { id: COLOR_IDS.black, name: 'Black', code: 'BK', hex: '#000000' },
  { id: COLOR_IDS.white, name: 'White', code: 'WH', hex: '#FFFFFF' },
  { id: COLOR_IDS.ceil, name: 'Ceil Blue', code: 'CB', hex: '#89CFF0' },
  { id: COLOR_IDS.wine, name: 'Wine', code: 'WN', hex: '#722F37' },
  { id: COLOR_IDS.teal, name: 'Teal', code: 'TL', hex: '#008080' },
  { id: COLOR_IDS.burgundy, name: 'Burgundy', code: 'BG', hex: '#800020' },
  { id: COLOR_IDS.royal, name: 'Royal Blue', code: 'RB', hex: '#4169E1' },
];

const SEED_PRODUCTS = [
  {
    id: PRODUCT_IDS['figs-casma'],
    slug: 'figs-casma-scrub-top',
    name: 'Casma Scrub Top',
    description: 'El Casma Scrub Top de FIGS combina estilo y funcionalidad. Con tejido elástico de cuatro direcciones y tecnología FIONx que repele líquidos.',
    sku: 'FIGS-CASMA',
    brandId: BRAND_IDS.figs,
    category: 'Camisas',
    gender: 'MUJER',
    priceNormal: '48.00',
    priceSale: '38.40',
    discountPct: 20,
    isNew: true,
    isBestSeller: true,
    isActive: true,
    features: ['Tejido FIONx elástico de 4 direcciones', 'Tecnología anti-microbiana', 'Bolsillos laterales profundos', 'Cuello en V moderno', 'Ajuste atlético'],
    careInstructions: ['Lavar en agua fría', 'No usar blanqueador', 'Secar a baja temperatura', 'Planchar a temperatura media'],
  },
  {
    id: PRODUCT_IDS['figs-yola'],
    slug: 'figs-yola-scrub-pants',
    name: 'Yola Scrub Pants',
    description: 'Pantalones scrub Yola con cintura elástica y ajuste cómodo. Perfectos para largas jornadas de trabajo.',
    sku: 'FIGS-YOLA',
    brandId: BRAND_IDS.figs,
    category: 'Pantalones',
    gender: 'MUJER',
    priceNormal: '52.00',
    priceSale: null,
    discountPct: null,
    isNew: false,
    isBestSeller: true,
    isActive: true,
    features: ['Cintura elástica ajustable', 'Bolsillos cargo laterales', 'Tejido transpirable', 'Resistente a arrugas'],
    careInstructions: ['Lavar en ciclo suave', 'No usar suavizante', 'Secar al aire libre preferiblemente'],
  },
  {
    id: PRODUCT_IDS['cherokee-workwear'],
    slug: 'cherokee-workwear-scrub-top',
    name: 'Workwear Scrub Top',
    description: 'El clásico scrub top de Cherokee Workwear. Duradero, cómodo y asequible.',
    sku: 'CHR-WW',
    brandId: BRAND_IDS.cherokee,
    category: 'Camisas',
    gender: 'UNISEX',
    priceNormal: '24.99',
    priceSale: '19.99',
    discountPct: 20,
    isNew: false,
    isBestSeller: true,
    isActive: true,
    features: ['Mezcla de poliéster y algodón', 'Dos bolsillos frontales', 'Cuello en V', 'Fácil cuidado'],
    careInstructions: ['Lavar a máquina', 'Secar en secadora', 'No necesita plancha'],
  },
  {
    id: PRODUCT_IDS['greys-lexie'],
    slug: 'greys-anatomy-lexie-scrub-top',
    name: 'Lexie Scrub Top',
    description: 'Elegante scrub top con detalles de moda. Tejido suave que se siente increíble contra la piel.',
    sku: 'GA-LEXIE',
    brandId: BRAND_IDS.greys,
    category: 'Camisas',
    gender: 'MUJER',
    priceNormal: '38.00',
    priceSale: null,
    discountPct: null,
    isNew: true,
    isBestSeller: false,
    isActive: true,
    features: ['Tejido suave y elástico', 'Detalles de costuras decorativas', 'Bolsillos funcionales', 'Ajuste favorecedor'],
    careInstructions: ['Lavar en agua fría', 'Secar a baja temperatura'],
  },
  {
    id: PRODUCT_IDS['wonderwink-four'],
    slug: 'wonderwink-four-stretch-scrub-top',
    name: 'Four-Stretch Scrub Top',
    description: 'Scrub top con elástico de cuatro direcciones para máxima comodidad y movimiento.',
    sku: 'WW-4ST',
    brandId: BRAND_IDS.wonderwink,
    category: 'Camisas',
    gender: 'MUJER',
    priceNormal: '32.00',
    priceSale: '25.60',
    discountPct: 20,
    isNew: false,
    isBestSeller: true,
    isActive: true,
    features: ['Elástico de 4 direcciones', 'Bolsillos múltiples', 'Cuello redondo', 'Colores vibrantes'],
    careInstructions: ['Lavar a máquina', 'No usar blanqueador'],
  },
  {
    id: PRODUCT_IDS['koi-lindsey'],
    slug: 'koi-lindsey-scrub-pants',
    name: 'Lindsey Scrub Pants',
    description: 'Pantalones scrub Lindsey con estilo único y funcionalidad superior.',
    sku: 'KOI-LIND',
    brandId: BRAND_IDS.koi,
    category: 'Pantalones',
    gender: 'MUJER',
    priceNormal: '42.00',
    priceSale: null,
    discountPct: null,
    isNew: true,
    isBestSeller: false,
    isActive: true,
    features: ['Diseño de carga con múltiples bolsillos', 'Cintura ajustable con cordón', 'Tejido duradero', 'Colores de moda'],
    careInstructions: ['Lavar en agua fría', 'Secar en secadora a baja temperatura'],
  },
  {
    id: PRODUCT_IDS['dickies-eds'],
    slug: 'dickies-eds-scrub-top',
    name: 'EDS Scrub Top',
    description: 'El clásico EDS de Dickies. Confiabilidad y durabilidad desde 1922.',
    sku: 'DIC-EDS',
    brandId: BRAND_IDS.dickies,
    category: 'Camisas',
    gender: 'UNISEX',
    priceNormal: '22.00',
    priceSale: '17.60',
    discountPct: 20,
    isNew: false,
    isBestSeller: true,
    isActive: true,
    features: ['Tejido resistente', 'Costuras reforzadas', 'Bolsillos funcionales', 'Fácil mantenimiento'],
    careInstructions: ['Lavar a máquina', 'Secar en secadora', 'No necesita plancha'],
  },
  {
    id: PRODUCT_IDS['figs-catarina'],
    slug: 'figs-catarina-scrub-top',
    name: 'Catarina Scrub Top',
    description: 'Scrub top Catarina con diseño elegante y funcionalidad superior.',
    sku: 'FIGS-CAT',
    brandId: BRAND_IDS.figs,
    category: 'Camisas',
    gender: 'MUJER',
    priceNormal: '46.00',
    priceSale: null,
    discountPct: null,
    isNew: true,
    isBestSeller: true,
    isActive: true,
    features: ['Tejido FIONx premium', 'Diseño asimétrico moderno', 'Múltiples bolsillos', 'Ajuste favorecedor'],
    careInstructions: ['Lavar en agua fría', 'Secar a baja temperatura'],
  },
];

// Generar variantes para cada producto
function generateVariants(productId: string, colorIds: string[], sizes: string[]) {
  const variants: any[] = [];
  const statuses = ['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'BACKORDER', 'OUT_OF_STOCK'];
  let statusIdx = 0;

  for (const colorId of colorIds) {
    for (const size of sizes) {
      const sku = `${productId}-${colorId.toUpperCase()}-${size}`;
      variants.push({
        id: uuid(),
        productId,
        colorId: COLOR_IDS[colorId as keyof typeof COLOR_IDS],
        size,
        sku,
        status: statuses[statusIdx % statuses.length],
      });
      statusIdx++;
    }
  }
  return variants;
}

const SEED_VARIANTS = [
  ...generateVariants(PRODUCT_IDS['figs-casma'], ['navy', 'black', 'ceil', 'burgundy'], ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
  ...generateVariants(PRODUCT_IDS['figs-yola'], ['navy', 'black', 'wine'], ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
  ...generateVariants(PRODUCT_IDS['cherokee-workwear'], ['navy', 'black', 'white', 'ceil'], ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']),
  ...generateVariants(PRODUCT_IDS['greys-lexie'], ['navy', 'black', 'teal'], ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
  ...generateVariants(PRODUCT_IDS['wonderwink-four'], ['navy', 'black', 'wine', 'burgundy'], ['XS', 'S', 'M', 'L', 'XL', '2XL']),
  ...generateVariants(PRODUCT_IDS['koi-lindsey'], ['navy', 'black', 'ceil'], ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
  ...generateVariants(PRODUCT_IDS['dickies-eds'], ['navy', 'black', 'white'], ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']),
  ...generateVariants(PRODUCT_IDS['figs-catarina'], ['navy', 'black', 'burgundy', 'royal'], ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
];

// Generar imágenes para cada producto
const PRODUCT_IMAGE_NUM: Record<string, number> = {
  [PRODUCT_IDS['figs-casma']]: 1,
  [PRODUCT_IDS['figs-yola']]: 2,
  [PRODUCT_IDS['cherokee-workwear']]: 3,
  [PRODUCT_IDS['greys-lexie']]: 4,
  [PRODUCT_IDS['wonderwink-four']]: 5,
  [PRODUCT_IDS['koi-lindsey']]: 6,
  [PRODUCT_IDS['dickies-eds']]: 7,
  [PRODUCT_IDS['figs-catarina']]: 8,
};

const PRODUCT_COLOR_IMAGES: Record<number, Record<string, string>> = {
  1: { navy: 'navy', black: 'black', ceil: 'ciel', burgundy: 'wine' },
  2: { navy: 'navy', black: 'black', wine: 'navy' },
  3: { navy: 'navy', black: 'black', white: 'salt', ceil: 'teal' },
  4: { navy: 'navy', black: 'black', teal: 'navy' },
  5: { navy: 'navy', black: 'black', wine: 'ciel', burgundy: 'coral' },
  6: { navy: 'navy', black: 'black', ceil: 'ciel' },
  7: { navy: 'navy', black: 'black', white: 'pewter' },
  8: { navy: 'navy', black: 'black', burgundy: 'navy', royal: 'navy' },
};

function generateImages(productId: string, colorIds: string[]) {
  const imgNum = PRODUCT_IMAGE_NUM[productId] || 1;
  const productColors = PRODUCT_COLOR_IMAGES[imgNum] || {};
  const images: any[] = [];

  for (const colorId of colorIds) {
    const colorFile = productColors[colorId] || 'navy';
    images.push({
      id: uuid(),
      productId,
      colorId: COLOR_IDS[colorId as keyof typeof COLOR_IDS],
      url: `/images/product-${imgNum}-${colorFile}-1.jpg`,
      alt: `${productId} - ${colorId}`,
      sortOrder: images.length,
    });
  }
  return images;
}

const SEED_IMAGES = [
  ...generateImages(PRODUCT_IDS['figs-casma'], ['navy', 'black', 'ceil', 'burgundy']),
  ...generateImages(PRODUCT_IDS['figs-yola'], ['navy', 'black', 'wine']),
  ...generateImages(PRODUCT_IDS['cherokee-workwear'], ['navy', 'black', 'white', 'ceil']),
  ...generateImages(PRODUCT_IDS['greys-lexie'], ['navy', 'black', 'teal']),
  ...generateImages(PRODUCT_IDS['wonderwink-four'], ['navy', 'black', 'wine', 'burgundy']),
  ...generateImages(PRODUCT_IDS['koi-lindsey'], ['navy', 'black', 'ceil']),
  ...generateImages(PRODUCT_IDS['dickies-eds'], ['navy', 'black', 'white']),
  ...generateImages(PRODUCT_IDS['figs-catarina'], ['navy', 'black', 'burgundy', 'royal']),
];

const SEED_STORES = [
  { id: uuid(), name: 'AllMedic Quito - Matriz', address: 'Av. 6 de Diciembre N34-123, Quito, Ecuador', phone: '+593 2 123 4567', hours: 'Lun - Vie: 9:00 - 18:00, Sáb: 10:00 - 14:00', mapUrl: 'https://maps.google.com/?q=quito', isMain: true, isActive: true, acceptsOnline: true, sortOrder: 1 },
  { id: uuid(), name: 'AllMedic Guayaquil', address: 'Av. 9 de Octubre 1234, Guayaquil, Ecuador', phone: '+593 4 234 5678', hours: 'Lun - Vie: 9:00 - 18:00, Sáb: 10:00 - 14:00', mapUrl: 'https://maps.google.com/?q=guayaquil', isMain: false, isActive: true, acceptsOnline: true, sortOrder: 2 },
  { id: uuid(), name: 'AllMedic Cuenca', address: 'Calle Larga 567, Cuenca, Ecuador', phone: '+593 7 345 6789', hours: 'Lun - Vie: 9:00 - 18:00, Sáb: 10:00 - 14:00', mapUrl: 'https://maps.google.com/?q=cuenca', isMain: false, isActive: true, acceptsOnline: true, sortOrder: 3 },
];

const SEED_BANNERS = [
  { id: uuid(), title: 'Uniformes médicos de alta calidad', subtitle: 'Descubre nuestra colección de scrubs premium diseñados para profesionales de la salud.', imageDesktop: '/images/hero-1.jpg', imageMobile: '/images/hero-1-mobile.jpg', ctaText: 'Ver catálogo', ctaLink: '/catalogo', sortOrder: 1, isActive: true },
  { id: uuid(), title: 'Nueva colección FIGS 2024', subtitle: 'Los scrubs más cómodos y estilosos del mercado. Tecnología FIONx de última generación.', imageDesktop: '/images/hero-2.jpg', imageMobile: '/images/hero-2-mobile.jpg', ctaText: 'Descubrir', ctaLink: '/catalogo?brand=FIGS', sortOrder: 2, isActive: true },
  { id: uuid(), title: 'Descuentos en Cherokee', subtitle: 'Hasta 20% de descuento en toda la línea Cherokee Workwear.', imageDesktop: '/images/hero-3.jpg', imageMobile: '/images/hero-3-mobile.jpg', ctaText: 'Ver ofertas', ctaLink: '/catalogo?brand=Cherokee', sortOrder: 3, isActive: true },
];

// ─── Main ───
async function main() {
  console.log('[SEED] Iniciando seed de PostgreSQL...');

  // Limpiar tablas en orden (hijos primero)
  console.log('[SEED] Limpiando tablas existentes...');
  await db.delete(productImages);
  await db.delete(productVariants);
  await db.delete(products);
  await db.delete(stores);
  await db.delete(banners);
  await db.delete(colors);
  await db.delete(brands);
  console.log('[SEED] Tablas limpiadas.');

  // Insertar marcas
  console.log('[SEED] Insertando marcas...');
  for (const brand of SEED_BRANDS) {
    await db.insert(brands).values(brand);
  }
  console.log(`[SEED] ${SEED_BRANDS.length} marcas insertadas.`);

  // Insertar colores
  console.log('[SEED] Insertando colores...');
  for (const color of SEED_COLORS) {
    await db.insert(colors).values(color);
  }
  console.log(`[SEED] ${SEED_COLORS.length} colores insertados.`);

  // Insertar productos
  console.log('[SEED] Insertando productos...');
  for (const product of SEED_PRODUCTS) {
    await db.insert(products).values(product);
  }
  console.log(`[SEED] ${SEED_PRODUCTS.length} productos insertados.`);

  // Insertar variantes
  console.log('[SEED] Insertando variantes...');
  for (const variant of SEED_VARIANTS) {
    await db.insert(productVariants).values(variant);
  }
  console.log(`[SEED] ${SEED_VARIANTS.length} variantes insertadas.`);

  // Insertar imágenes
  console.log('[SEED] Insertando imágenes...');
  for (const image of SEED_IMAGES) {
    await db.insert(productImages).values(image);
  }
  console.log(`[SEED] ${SEED_IMAGES.length} imágenes insertadas.`);

  // Insertar tiendas
  console.log('[SEED] Insertando tiendas...');
  for (const store of SEED_STORES) {
    await db.insert(stores).values(store);
  }
  console.log(`[SEED] ${SEED_STORES.length} tiendas insertadas.`);

  // Insertar banners
  console.log('[SEED] Insertando banners...');
  for (const banner of SEED_BANNERS) {
    await db.insert(banners).values(banner);
  }
  console.log(`[SEED] ${SEED_BANNERS.length} banners insertados.`);

  console.log('[SEED] ✅ Seed completado exitosamente!');
}

main().catch((err) => {
  console.error('[SEED] ❌ Error:', err);
  process.exit(1);
});

#!/usr/bin/env tsx
/**
 * Seed Script: Puebla PostgreSQL con datos de src/lib/dummy-data.ts
 * 
 * Uso:
 *   DATABASE_URL=postgres://... npx tsx scripts/seed-from-dummy.ts
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
import {
  COLORS as DUMMY_COLORS,
  BRANDS as DUMMY_BRANDS,
  PRODUCTS as DUMMY_PRODUCTS,
  STORES as DUMMY_STORES,
  HERO_SLIDES as DUMMY_HERO_SLIDES,
} from '../src/lib/dummy-data';
import { v5 as uuidv5 } from 'uuid';

// Namespace UUID para generar UUIDs deterministas
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function id(seed: string): string {
  return uuidv5(seed, NAMESPACE);
}

// ─── Mapeo de IDs del dummy data a UUIDs ───

const brandIdMap: Record<string, string> = {};
DUMMY_BRANDS.forEach((name, idx) => {
  brandIdMap[name] = id(`brand-${name}`);
});

const colorIdMap: Record<string, string> = {};
DUMMY_COLORS.forEach((c) => {
  colorIdMap[c.id] = id(`color-${c.id}`);
});

const productIdMap: Record<string, string> = {};
DUMMY_PRODUCTS.forEach((p) => {
  productIdMap[p.id] = id(`product-${p.id}`);
});

// ─── Transformar datos ───

const SEED_BRANDS = DUMMY_BRANDS.map((name, idx) => ({
  id: brandIdMap[name],
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-').replace(/'/g, ''),
  description: null as string | null,
  logoUrl: `/images/brands/${name.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '')}.png`,
  isActive: true,
  sortOrder: idx,
}));

const SEED_COLORS = DUMMY_COLORS.map((c) => ({
  id: colorIdMap[c.id],
  name: c.name,
  code: c.code,
  hex: c.hex,
}));

const genderMap: Record<string, string> = {
  'Mujer': 'MUJER',
  'Hombre': 'HOMBRE',
  'Unisex': 'UNISEX',
};

const SEED_PRODUCTS = DUMMY_PRODUCTS.map((p) => ({
  id: productIdMap[p.id],
  slug: p.slug,
  name: p.name,
  description: p.description,
  sku: p.sku || null,
  brandId: brandIdMap[p.brand],
  collectionId: null as string | null,
  category: p.category,
  productType: null as string | null,
  gender: genderMap[p.gender] || 'UNISEX',
  priceNormal: p.priceNormal.toFixed(2),
  priceSale: p.priceSale ? p.priceSale.toFixed(2) : null,
  discountPct: p.discountPct || null,
  discountEnd: p.discountEnd ? new Date(p.discountEnd) : null,
  isNew: p.isNew,
  isBestSeller: p.isBestSeller,
  isActive: true,
  crossSellId: p.complementaryProduct ? productIdMap[p.complementaryProduct] : null,
  features: p.features as string[],
  careInstructions: p.careInstructions as string[],
  styles: [] as string[],
}));

// Generar variantes desde los datos dummy
const SEED_VARIANTS: any[] = [];
DUMMY_PRODUCTS.forEach((p) => {
  p.variants.forEach((v) => {
    SEED_VARIANTS.push({
      id: id(`variant-${v.id}`),
      productId: productIdMap[p.id],
      colorId: colorIdMap[v.colorId],
      size: v.size,
      fit: v.fit || null,
      sku: v.sku,
      status: v.status,
      stock: Math.floor(Math.random() * 50),
      minStock: 5,
    });
  });
});

// Generar imágenes desde los datos dummy
const SEED_IMAGES: any[] = [];
DUMMY_PRODUCTS.forEach((p) => {
  // Agrupar imágenes por color
  const imagesByColor = new Map<string, string[]>();
  p.variants.forEach((v) => {
    if (!imagesByColor.has(v.colorId)) {
      imagesByColor.set(v.colorId, v.images);
    }
  });

  let sortOrder = 0;
  imagesByColor.forEach((imgs, colorId) => {
    imgs.forEach((url) => {
      SEED_IMAGES.push({
        id: id(`image-${p.id}-${colorId}-${sortOrder}`),
        productId: productIdMap[p.id],
        colorId: colorIdMap[colorId],
        url,
        alt: `${p.name} - ${colorId}`,
        sortOrder: sortOrder++,
      });
    });
  });
});

const SEED_STORES = DUMMY_STORES.map((s, idx) => ({
  id: id(`store-${s.id}`),
  name: s.name,
  address: s.address,
  phone: s.phone,
  hours: s.hours,
  mapUrl: s.mapUrl || null,
  isMain: s.isMain,
  isActive: true,
  acceptsOnline: true,
  sortOrder: idx,
}));

const SEED_BANNERS = DUMMY_HERO_SLIDES.map((h, idx) => ({
  id: id(`banner-${h.id}`),
  title: h.title,
  subtitle: h.subtitle || null,
  imageDesktop: h.image,
  imageMobile: h.image,
  ctaText: h.cta,
  ctaLink: h.ctaLink,
  sortOrder: idx,
  isActive: true,
}));

// ─── Main ───
async function main() {
  console.log('[SEED] Iniciando seed desde dummy-data.ts...');
  console.log(`[SEED] Productos dummy: ${DUMMY_PRODUCTS.length}`);
  console.log(`[SEED] Marcas dummy: ${DUMMY_BRANDS.length}`);
  console.log(`[SEED] Colores dummy: ${DUMMY_COLORS.length}`);

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
  console.log('');
  console.log('Resumen:');
  console.log(`  - Marcas: ${SEED_BRANDS.length}`);
  console.log(`  - Colores: ${SEED_COLORS.length}`);
  console.log(`  - Productos: ${SEED_PRODUCTS.length}`);
  console.log(`  - Variantes: ${SEED_VARIANTS.length}`);
  console.log(`  - Imágenes: ${SEED_IMAGES.length}`);
  console.log(`  - Tiendas: ${SEED_STORES.length}`);
  console.log(`  - Banners: ${SEED_BANNERS.length}`);
}

main().catch((err) => {
  console.error('[SEED] ❌ Error:', err);
  process.exit(1);
});

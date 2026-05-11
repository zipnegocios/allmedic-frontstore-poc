#!/usr/bin/env tsx
/**
 * ETL Script: MySQL → PostgreSQL Migration
 * 
 * Uso:
 *   npx tsx scripts/mysql-to-postgres-etl.ts
 * 
 * Requiere:
 *   - Variables de entorno: MYSQL_URL, POSTGRES_URL
 *   - Dependencias: mysql2, pg, drizzle-orm
 */

import { createConnection } from 'mysql2/promise';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';

// ─── Config ───
const MYSQL_URL = process.env.MYSQL_URL || 'mysql://u742656042_amuname:password@srv1505.hstgr.io:3306/u742656042_amudata';
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://user:password@localhost:5432/allmedic';

const BATCH_SIZE = 100;

// ─── Helpers ───
function log(step: string, msg: string) {
  console.log(`[${new Date().toISOString()}] [${step}] ${msg}`);
}

function booleanFromTinyInt(val: number | null): boolean | null {
  if (val === null) return null;
  return val === 1;
}

function safeJson(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

// ─── Main ───
async function main() {
  log('INIT', 'Conectando a MySQL...');
  const mysql = await createConnection(MYSQL_URL);

  log('INIT', 'Conectando a PostgreSQL...');
  const pgPool = new Pool({ connectionString: POSTGRES_URL });
  const db = drizzle(pgPool, { schema });

  // Verificar pgvector
  await pgPool.query('CREATE EXTENSION IF NOT EXISTS vector;');
  log('INIT', 'pgvector extension lista.');

  // ─── 1. Brands ───
  log('BRANDS', 'Migrando marcas...');
  const [brands] = await mysql.execute('SELECT * FROM brands');
  for (const row of brands as any[]) {
    await db.insert(schema.brands).values({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      logoUrl: row.logoUrl,
      isActive: booleanFromTinyInt(row.isActive),
      sortOrder: row.sortOrder,
    }).onConflictDoNothing();
  }
  log('BRANDS', `${brands.length} marcas migradas.`);

  // ─── 2. Colors ───
  log('COLORS', 'Migrando colores...');
  const [colors] = await mysql.execute('SELECT * FROM colors');
  for (const row of colors as any[]) {
    await db.insert(schema.colors).values({
      id: row.id,
      name: row.name,
      code: row.code,
      hex: row.hex,
    }).onConflictDoNothing();
  }
  log('COLORS', `${colors.length} colores migrados.`);

  // ─── 3. Collections ───
  log('COLLECTIONS', 'Migrando colecciones...');
  const [collections] = await mysql.execute('SELECT * FROM collections');
  for (const row of collections as any[]) {
    await db.insert(schema.collections).values({
      id: row.id,
      name: row.name,
      slug: row.slug,
      brandId: row.brandId,
    }).onConflictDoNothing();
  }
  log('COLLECTIONS', `${collections.length} colecciones migradas.`);

  // ─── 4. Products ───
  log('PRODUCTS', 'Migrando productos...');
  const [products] = await mysql.execute('SELECT * FROM products');
  for (const row of products as any[]) {
    await db.insert(schema.products).values({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      sku: row.sku,
      brandId: row.brandId,
      collectionId: row.collectionId,
      category: row.category,
      productType: row.productType,
      gender: row.gender,
      priceNormal: row.priceNormal?.toString(),
      priceSale: row.priceSale?.toString(),
      discountPct: row.discountPct,
      discountEnd: row.discountEnd,
      isNew: booleanFromTinyInt(row.isNew),
      isBestSeller: booleanFromTinyInt(row.isBestSeller),
      isActive: booleanFromTinyInt(row.isActive),
      crossSellId: row.crossSellId,
      features: safeJson(row.features),
      careInstructions: safeJson(row.careInstructions),
      styles: safeJson(row.styles),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }).onConflictDoNothing();
  }
  log('PRODUCTS', `${products.length} productos migrados.`);

  // ─── 5. Product Variants ───
  log('VARIANTS', 'Migrando variantes...');
  const [variants] = await mysql.execute('SELECT * FROM product_variants');
  for (const row of variants as any[]) {
    await db.insert(schema.productVariants).values({
      id: row.id,
      productId: row.productId,
      colorId: row.colorId,
      size: row.size,
      fit: row.fit,
      sku: row.sku,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }).onConflictDoNothing();
  }
  log('VARIANTS', `${variants.length} variantes migradas.`);

  // ─── 6. Product Images ───
  log('IMAGES', 'Migrando imágenes...');
  const [images] = await mysql.execute('SELECT * FROM product_images');
  for (const row of images as any[]) {
    await db.insert(schema.productImages).values({
      id: row.id,
      productId: row.productId,
      colorId: row.colorId,
      url: row.url,
      alt: row.alt,
      sortOrder: row.sortOrder,
    }).onConflictDoNothing();
  }
  log('IMAGES', `${images.length} imágenes migradas.`);

  // ─── 7. Stores ───
  log('STORES', 'Migrando tiendas...');
  const [stores] = await mysql.execute('SELECT * FROM stores');
  for (const row of stores as any[]) {
    await db.insert(schema.stores).values({
      id: row.id,
      name: row.name,
      address: row.address,
      phone: row.phone,
      hours: row.hours,
      mapUrl: row.mapUrl,
      isMain: booleanFromTinyInt(row.isMain),
      isActive: booleanFromTinyInt(row.isActive),
      acceptsOnline: booleanFromTinyInt(row.acceptsOnline),
      sortOrder: row.sortOrder,
    }).onConflictDoNothing();
  }
  log('STORES', `${stores.length} tiendas migradas.`);

  // ─── 8. Leads ───
  log('LEADS', 'Migrando leads...');
  const [leads] = await mysql.execute('SELECT * FROM leads');
  for (const row of leads as any[]) {
    await db.insert(schema.leads).values({
      id: row.id,
      customerName: row.customerName,
      customerCity: row.customerCity,
      customerPhone: row.customerPhone,
      items: safeJson(row.items),
      totalItems: row.totalItems,
      subtotal: row.subtotal?.toString(),
      status: row.status,
      createdAt: row.createdAt,
    }).onConflictDoNothing();
  }
  log('LEADS', `${leads.length} leads migrados.`);

  // ─── 9. Banners ───
  log('BANNERS', 'Migrando banners...');
  const [banners] = await mysql.execute('SELECT * FROM banners');
  for (const row of banners as any[]) {
    await db.insert(schema.banners).values({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      imageDesktop: row.imageDesktop,
      imageMobile: row.imageMobile,
      ctaText: row.ctaText,
      ctaLink: row.ctaLink,
      sortOrder: row.sortOrder,
      isActive: booleanFromTinyInt(row.isActive),
    }).onConflictDoNothing();
  }
  log('BANNERS', `${banners.length} banners migrados.`);

  // ─── 10. Search Logs ───
  log('SEARCH_LOGS', 'Migrando logs de búsqueda...');
  const [searchLogs] = await mysql.execute('SELECT * FROM search_logs');
  for (const row of searchLogs as any[]) {
    await db.insert(schema.searchLogs).values({
      id: row.id,
      query: row.query,
      results: row.results,
      createdAt: row.createdAt,
    }).onConflictDoNothing();
  }
  log('SEARCH_LOGS', `${searchLogs.length} logs migrados.`);

  // ─── 11. WhatsApp Clicks ───
  log('WA_CLICKS', 'Migrando clicks de WhatsApp...');
  const [waClicks] = await mysql.execute('SELECT * FROM whatsapp_clicks');
  for (const row of waClicks as any[]) {
    await db.insert(schema.whatsappClicks).values({
      id: row.id,
      productId: row.productId,
      createdAt: row.createdAt,
    }).onConflictDoNothing();
  }
  log('WA_CLICKS', `${waClicks.length} clicks migrados.`);

  // ─── 12. Users ───
  log('USERS', 'Migrando usuarios...');
  const [users] = await mysql.execute('SELECT * FROM users');
  for (const row of users as any[]) {
    await db.insert(schema.users).values({
      id: row.id,
      email: row.email,
      name: row.name,
      password: row.password, // Ya debería estar hasheado
      role: row.role,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }).onConflictDoNothing();
  }
  log('USERS', `${users.length} usuarios migrados.`);

  // ─── Cleanup ───
  log('DONE', 'Migración completada exitosamente.');
  await mysql.end();
  await pgPool.end();
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});

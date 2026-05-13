#!/usr/bin/env tsx
/**
 * Generate Embeddings for Existing Products
 * 
 * Uso:
 *   npx tsx scripts/generate-embeddings.ts
 * 
 * Requiere:
 *   - OPENAI_API_KEY en .env.local
 *   - PostgreSQL conectado (DATABASE_URL)
 *   - Tabla products con columna embedding vector(1536)
 */

import { Pool } from 'pg';
import OpenAI from 'openai';
import { drizzle } from 'drizzle-orm/node-postgres';
import { products } from '../src/db/schema/products';
import { sql } from 'drizzle-orm';

// ─── Config ───
const DATABASE_URL = process.env.DATABASE_URL!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const BATCH_SIZE = 50; // OpenAI permite hasta 2048 en una llamada, pero usamos 50 por seguridad
const MODEL = 'text-embedding-3-small';
const DIMENSIONS = 1536;

// ─── Init ───
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

/**
 * Genera embedding para un texto usando OpenAI
 */
async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: MODEL,
    input: text,
    dimensions: DIMENSIONS,
  });
  return response.data[0].embedding;
}

/**
 * Construye el texto para embedding de un producto
 */
function buildProductText(product: {
  name: string;
  description: string | null;
  brand: string | null;
  category: string;
  features: unknown;
  careInstructions: unknown;
  styles: unknown;
}): string {
  const parts = [
    product.name,
    product.brand,
    product.category,
    product.description,
  ];

  // Añadir features como texto
  if (Array.isArray(product.features)) {
    parts.push(...product.features);
  }

  // Añadir care instructions
  if (Array.isArray(product.careInstructions)) {
    parts.push(...product.careInstructions);
  }

  // Añadir styles
  if (Array.isArray(product.styles)) {
    parts.push(...product.styles);
  }

  return parts.filter(Boolean).join(' \n');
}

/**
 * Obtiene productos sin embedding
 */
async function getProductsWithoutEmbedding(limit: number) {
  const result = await db.execute(sql`
    SELECT id, name, description, category, features, care_instructions, styles,
      (SELECT name FROM brands WHERE brands.id = products.brand_id) as brand
    FROM products
    WHERE embedding IS NULL
    LIMIT ${limit}
  `);
  return result.rows;
}

/**
 * Actualiza el embedding de un producto
 */
async function updateProductEmbedding(productId: string, embedding: number[]) {
  const vectorStr = `[${embedding.join(',')}]`;
  await db.execute(
    sql`UPDATE products SET embedding = ${vectorStr}::vector WHERE id = ${productId}`
  );
}

/**
 * Procesa un batch de productos
 */
async function processBatch(productRows: any[]) {
  const texts = productRows.map(p => buildProductText(p));

  // Llamada batch a OpenAI
  const response = await openai.embeddings.create({
    model: MODEL,
    input: texts,
    dimensions: DIMENSIONS,
  });

  // Actualizar cada producto
  for (let i = 0; i < productRows.length; i++) {
    const embedding = response.data[i].embedding;
    await updateProductEmbedding(productRows[i].id, embedding);
  }
}

// ─── Main ───
async function main() {
  if (!DATABASE_URL || !OPENAI_API_KEY) {
    console.error('Faltan variables de entorno: DATABASE_URL, OPENAI_API_KEY');
    process.exit(1);
  }

  log('Iniciando generación de embeddings...');

  let totalProcessed = 0;
  let batch: any[];

  do {
    batch = await getProductsWithoutEmbedding(BATCH_SIZE);
    if (batch.length === 0) break;

    log(`Procesando batch de ${batch.length} productos...`);
    await processBatch(batch);

    totalProcessed += batch.length;
    log(`Total procesados: ${totalProcessed}`);

    // Rate limiting: esperar 100ms entre batches
    await new Promise(r => setTimeout(r, 100));
  } while (batch.length === BATCH_SIZE);

  log(`Completado. ${totalProcessed} productos con embeddings generados.`);
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

# RAG_VECTOR_SEARCH.md — Búsqueda Semántica con pgvector

> Guía para implementar embeddings, búsqueda vectorial con cosineDistance, y RAG
> (Retrieval-Augmented Generation) para respuestas inteligentes en Allmedic.

---

## 1. Conceptos Clave

| Concepto | Definición |
|----------|------------|
| **Embedding** | Vector numérico que representa el significado semántico de un texto (1536 dims para OpenAI) |
| **Cosine Similarity** | Medida de qué tan similares son dos vectores (1 = idénticos, 0 = ortogonales) |
| **pgvector** | Extensión de PostgreSQL para almacenar y buscar vectores eficientemente |
| **RAG** | Recuperar contexto relevante de la DB y pasarlo al LLM para generar respuestas precisas |

---

## 2. Instalación de pgvector

### En PostgreSQL local/Docker

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### En EasyPanel (PostgreSQL managed)

1. Ir a la consola SQL de la base de datos
2. Ejecutar: `CREATE EXTENSION vector;`
3. Verificar: `SELECT * FROM pg_extension WHERE extname = 'vector';`

---

## 3. Schema para Vectores en Drizzle

### `src/db/schema/products.ts` (fragmento)

```typescript
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// pgvector no tiene tipo nativo en drizzle-orm/pg-core aún.
// Usar custom type o raw SQL.

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  // ... otros campos
  embedding: text("embedding"), // Guardar como JSON string temporalmente
});

// Alternativa: usar raw SQL para columna vector
// En migration SQL:
// ALTER TABLE products ADD COLUMN embedding vector(1536);
```

### Función helper para cosine distance

```typescript
// src/lib/vector-search.ts
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema/products";

/**
 * Convierte array de números a formato vector de PostgreSQL
 */
export function toVector(arr: number[]): string {
  return `[${arr.join(',')}]`;
}

/**
 * Busca productos por similitud semántica usando cosine distance
 */
export async function searchProductsSemantic(
  queryEmbedding: number[],
  limit: number = 10
) {
  const vectorStr = toVector(queryEmbedding);

  const results = await db.execute(sql`
    SELECT 
      id, name, description, price_normal, price_sale,
      1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM products
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `);

  return results.rows;
}

/**
 * Busca respuestas históricas similares en mensajes
 */
export async function searchSimilarMessages(
  queryEmbedding: number[],
  limit: number = 5
) {
  const vectorStr = toVector(queryEmbedding);

  const results = await db.execute(sql`
    SELECT 
      m.id, m.content, m.source, m.direction,
      c.customer_name, c.channel,
      1 - (m.embedding <=> ${vectorStr}::vector) AS similarity
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE m.embedding IS NOT NULL
      AND m.direction = 'outbound'  -- Solo respuestas de agentes
    ORDER BY m.embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `);

  return results.rows;
}
```

---

## 4. Generación de Embeddings con OpenAI

### `src/lib/embeddings.ts`

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = 'text-embedding-3-small';
const DIMENSIONS = 1536;

/**
 * Genera embedding para un texto
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: DIMENSIONS,
  });

  return response.data[0].embedding;
}

/**
 * Genera embedding para un producto (nombre + descripción + features)
 */
export async function generateProductEmbedding(product: {
  name: string;
  description?: string | null;
  features?: string[] | null;
  brand?: string;
  category?: string;
}): Promise<number[]> {
  const text = [
    product.name,
    product.brand,
    product.category,
    product.description,
    ...(product.features || []),
  ].filter(Boolean).join(' \n');

  return generateEmbedding(text);
}

/**
 * Genera embedding para un mensaje de cliente
 */
export async function generateMessageEmbedding(content: string): Promise<number[]> {
  return generateEmbedding(content);
}
```

---

## 5. Middleware de Auto-Embedding

### Trigger automático en insert/update

```typescript
// src/lib/db-hooks.ts
import { db } from "@/db";
import { products } from "@/db/schema/products";
import { generateProductEmbedding } from "./embeddings";
import { eq } from "drizzle-orm";

/**
 * Inserta un producto y genera su embedding automáticamente
 */
export async function insertProductWithEmbedding(productData: {
  name: string;
  description?: string;
  features?: string[];
  brand?: string;
  category?: string;
  // ... otros campos
}) {
  // Insertar producto sin embedding
  const [product] = await db.insert(products)
    .values({ ...productData, embedding: null })
    .returning();

  // Generar embedding en background
  generateProductEmbedding(productData)
    .then(async (embedding) => {
      const vectorStr = `[${embedding.join(',')}]`;
      await db.execute(
        `UPDATE products SET embedding = $1::vector WHERE id = $2`,
        [vectorStr, product.id]
      );
    })
    .catch(console.error);

  return product;
}
```

---

## 6. RAG para Respuestas de ATC

### Flujo completo de RAG

```
1. Cliente pregunta: "¿Tienen scrubs azules talla M?"
   │
   ▼
2. Generar embedding de la pregunta
   │
   ▼
3. Buscar en products (similitud semántica)
   → Productos azules, scrubs, talla M
   │
   ▼
4. Buscar en messages (respuestas históricas similares)
   → "Tenemos scrubs azules en varias marcas..."
   │
   ▼
5. Componer prompt con contexto recuperado
   │
   ▼
6. Llamar a LLM (OpenAI GPT-4o-mini / Claude)
   │
   ▼
7. Responder al cliente con info precisa
```

### `src/lib/rag-service.ts`

```typescript
import { generateEmbedding, generateMessageEmbedding } from './embeddings';
import { searchProductsSemantic, searchSimilarMessages } from './vector-search';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface RAGContext {
  products: Array<{
    name: string;
    description: string;
    price_normal: string;
    similarity: number;
  }>;
  similarResponses: Array<{
    content: string;
    similarity: number;
  }>;
}

/**
 * Recupera contexto relevante para una pregunta de cliente
 */
export async function retrieveContext(question: string): Promise<RAGContext> {
  const embedding = await generateEmbedding(question);

  const [products, similarResponses] = await Promise.all([
    searchProductsSemantic(embedding, 5),
    searchSimilarMessages(embedding, 3),
  ]);

  return { products, similarResponses };
}

/**
 * Genera respuesta sugerida usando RAG
 */
export async function generateAIResponse(
  question: string,
  context: RAGContext
): Promise<string> {
  const productContext = context.products
    .map(p => `- ${p.name}: ${p.description} ($${p.price_normal})`)
    .join('\n');

  const historyContext = context.similarResponses
    .map(r => `- Respuesta previa: ${r.content}`)
    .join('\n');

  const prompt = `Eres un asistente de ventas de Allmedic, una tienda de uniformes médicos en Ecuador.
Responde en español de manera amable, profesional y concisa.

CONTEXTO DE PRODUCTOS RELEVANTES:
${productContext}

RESPUESTAS HISTÓRICAS SIMILARES:
${historyContext}

PREGUNTA DEL CLIENTE:
${question}

INSTRUCCIONES:
- Si hay productos relevantes, menciona nombres, precios y disponibilidad.
- Si no tienes la información exacta, sugiere que el cliente visite la tienda o escriba por WhatsApp.
- No inventes precios ni disponibilidad que no estén en el contexto.
- Sé breve (máximo 3-4 oraciones).`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 300,
  });

  return response.choices[0].message.content || 'Lo siento, no pude procesar tu pregunta.';
}

/**
 * Pipeline completo: pregunta → respuesta IA
 */
export async function answerCustomerQuestion(question: string): Promise<string> {
  const context = await retrieveContext(question);
  return generateAIResponse(question, context);
}
```

---

## 7. Indexación de PDFs para RAG

### Procesar PDFs de catálogo médico

```typescript
// src/lib/pdf-processor.ts
import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import { generateEmbedding } from './embeddings';
import { db } from '@/db';

/**
 * Extrae texto de un PDF y lo divide en chunks
 */
export async function extractPdfChunks(filePath: string, chunkSize: number = 1000): Promise<string[]> {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  const text = data.text;

  // Dividir en chunks de ~1000 caracteres
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  return chunks;
}

/**
 * Indexa chunks de PDF en la base de datos
 */
export async function indexPdfDocument(filePath: string, documentName: string) {
  const chunks = await extractPdfChunks(filePath);

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i]);
    const vectorStr = `[${embedding.join(',')}]`;

    await db.execute(
      `INSERT INTO pdf_chunks (document_name, chunk_index, content, embedding)
       VALUES ($1, $2, $3, $4::vector)`,
      [documentName, i, chunks[i], vectorStr]
    );
  }
}
```

### Tabla para chunks de PDF

```sql
CREATE TABLE pdf_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_name TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pdf_chunks_embedding ON pdf_chunks USING ivfflat (embedding vector_cosine_ops);
```

---

## 8. API Route para Búsqueda Semántica

### `src/app/api/search/semantic/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding } from '@/lib/embeddings';
import { searchProductsSemantic } from '@/lib/vector-search';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'Query too short' }, { status: 400 });
  }

  try {
    const embedding = await generateEmbedding(query);
    const results = await searchProductsSemantic(embedding, 20);

    return NextResponse.json({
      query,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error('[Semantic Search] Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
```

---

## 9. Optimización de pgvector

### Índices recomendados

```sql
-- Índice IVFFlat para búsqueda aproximada (rápida, buena para >10k vectores)
CREATE INDEX idx_products_embedding_ivf ON products
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Índice HNSW para búsqueda exacta más rápida (más memoria, mejor precisión)
CREATE INDEX idx_products_embedding_hnsw ON products
  USING hnsw (embedding vector_cosine_ops);

-- Índice para mensajes
CREATE INDEX idx_messages_embedding ON messages
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);
```

| Índice | Pros | Contras | Cuándo usar |
|--------|------|---------|-------------|
| `ivfflat` | Menos memoria, buen balance | Menos preciso con pocos lists | >10k vectores, RAM limitada |
| `hnsw` | Más rápido, más preciso | Más memoria | <100k vectores, RAM suficiente |

---

## 10. Dependencias

```bash
npm install openai
npm install -D @types/pdf-parse
npm install pdf-parse  # Opcional: para procesar PDFs
```

Variables de entorno necesarias:
```bash
OPENAI_API_KEY=sk-...
```

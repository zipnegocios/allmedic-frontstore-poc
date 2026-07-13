/**
 * Database schema synchronization script.
 * Ensures all tables and columns from the Drizzle schema exist in the database.
 * Run with: npx tsx src/db/migrate.ts
 */

import { Pool } from "pg";

function getDatabaseUrl(): string {
  const rawUrl = process.env.DATABASE_URL;
  if (rawUrl?.startsWith('postgresql://') || rawUrl?.startsWith('postgres://')) {
    try {
      const match = rawUrl.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@(.+)$/);
      if (match) {
        const [, user, password, rest] = match;
        return `postgresql://${user}:${encodeURIComponent(password)}@${rest}`;
      }
    } catch {
      // fallback to raw URL
    }
    return rawUrl;
  }

  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME;

  if (!user || !password || !host || !database) {
    throw new Error("Database configuration missing");
  }

  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

const pool = new Pool({ connectionString: getDatabaseUrl() });

async function migrate() {
  console.log('🔧 Starting schema synchronization...');

  const client = await pool.connect();

  try {
    // ── 1. Ensure users table has correct columns ──
    console.log('  Checking users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT NOT NULL UNIQUE,
        email_verified TIMESTAMPTZ,
        image TEXT,
        password TEXT,
        role TEXT NOT NULL DEFAULT 'CATALOG_MANAGER',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── 2. Ensure auth tables exist ──
    console.log('  Checking auth tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        refresh_token TEXT,
        access_token TEXT,
        expires_at INTEGER,
        token_type TEXT,
        scope TEXT,
        id_token TEXT,
        session_state TEXT,
        PRIMARY KEY (provider, provider_account_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires TIMESTAMPTZ NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        identifier TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (identifier, token)
      )
    `);

    // ── 3. Ensure product_variants has stock columns ──
    console.log('  Checking product_variants columns...');
    const variantColumns = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'product_variants'
    `);
    const existingVariantCols = new Set(variantColumns.rows.map(r => r.column_name));

    if (!existingVariantCols.has('stock')) {
      console.log('    Adding stock column...');
      await client.query(`ALTER TABLE product_variants ADD COLUMN stock INTEGER DEFAULT 0`);
    }
    if (!existingVariantCols.has('location')) {
      console.log('    Adding location column...');
      await client.query(`ALTER TABLE product_variants ADD COLUMN location TEXT`);
    }
    if (!existingVariantCols.has('min_stock')) {
      console.log('    Adding min_stock column...');
      await client.query(`ALTER TABLE product_variants ADD COLUMN min_stock INTEGER DEFAULT 5`);
    }

    // ── 4. Ensure all core tables exist ──
    console.log('  Checking core tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS brands (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        logo_url TEXT,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        brand_id TEXT NOT NULL REFERENCES brands(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS colors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        code TEXT NOT NULL UNIQUE,
        hex TEXT NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        sku TEXT,
        brand_id TEXT NOT NULL REFERENCES brands(id),
        collection_id TEXT REFERENCES collections(id),
        category TEXT NOT NULL,
        product_type TEXT,
        gender TEXT NOT NULL,
        price_normal DECIMAL(10,2) NOT NULL,
        price_sale DECIMAL(10,2),
        discount_pct INTEGER,
        discount_end TIMESTAMPTZ,
        is_new BOOLEAN DEFAULT false,
        is_best_seller BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        cross_sell_id TEXT,
        features JSONB,
        care_instructions JSONB,
        styles JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        color_id TEXT NOT NULL REFERENCES colors(id),
        size TEXT NOT NULL,
        fit TEXT,
        sku TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'AVAILABLE',
        stock INTEGER DEFAULT 0,
        location TEXT,
        min_stock INTEGER DEFAULT 5,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Nota: la tabla legacy `product_images` (product_id TEXT) ya no se crea aquí —
    // fue reemplazada por la Media Library (`media_assets`/`media_links`, ver src/db/schema/media.ts)
    // y su definición chocaba con `products.id` (uuid en la base real), abortando el resto
    // de esta migración en cada arranque.

    await client.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT,
        hours TEXT,
        map_url TEXT,
        is_main BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        accepts_online BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_city TEXT NOT NULL,
        customer_phone TEXT,
        items JSONB NOT NULL,
        total_items INTEGER NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        discount_pct INTEGER DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'SENT',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const leadColumns = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'leads'
    `);
    const existingLeadCols = new Set(leadColumns.rows.map(r => r.column_name));

    if (!existingLeadCols.has('discount_pct')) {
      console.log('    Adding discount_pct column to leads...');
      await client.query(`ALTER TABLE leads ADD COLUMN discount_pct INTEGER DEFAULT 0`);
    }
    if (!existingLeadCols.has('discount_amount')) {
      console.log('    Adding discount_amount column to leads...');
      await client.query(`ALTER TABLE leads ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0`);
    }
    if (!existingLeadCols.has('total')) {
      console.log('    Adding total column to leads...');
      await client.query(`ALTER TABLE leads ADD COLUMN total DECIMAL(10,2) NOT NULL DEFAULT 0`);
      await client.query(`UPDATE leads SET total = subtotal WHERE total = 0`);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        subtitle TEXT,
        image_desktop TEXT NOT NULL,
        image_mobile TEXT,
        cta_text TEXT,
        cta_link TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS search_logs (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        results INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_clicks (
        id TEXT PRIMARY KEY,
        product_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        external_id TEXT NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        customer_ig_handle TEXT,
        status TEXT NOT NULL DEFAULT 'OPEN',
        assigned_to TEXT,
        last_message_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        source TEXT NOT NULL,
        direction TEXT NOT NULL,
        content TEXT NOT NULL,
        media_url TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_documents (
        id TEXT PRIMARY KEY,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        content TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_embeddings (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES product_documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding VECTOR(1536) NOT NULL
      )
    `);

    // ── 5. Create indexes ──
    console.log('  Creating indexes...');
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id)`,
      `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`,
      `CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender)`,
      `CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id)`,
      `CREATE INDEX IF NOT EXISTS idx_variants_color ON product_variants(color_id)`,
      `CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`,
      `CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_conversations_channel_external ON conversations(channel, external_id)`,
      `CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)`,
      `CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_to)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_embeddings_document ON product_embeddings(document_id)`,
    ];

    for (const idx of indexes) {
      try {
        await client.query(idx);
      } catch (err: any) {
        if (!err.message?.includes('already exists')) {
          console.warn(`    Warning: ${err.message}`);
        }
      }
    }

    // ── 6. Create HNSW index for vector search (if pgvector is available) ──
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_embeddings_vector
        ON product_embeddings
        USING hnsw (embedding vector_cosine_ops)
      `);
      console.log('  HNSW vector index created/verified');
    } catch (err: any) {
      console.log('  HNSW index skipped (pgvector may not be available):', err.message);
    }

    // ── 7. Ensure admin user exists ──
    console.log('  Checking admin user...');
    const { hash } = await import('bcryptjs');
    const adminPassword = await hash('AMU.master26', 12);

    await client.query(`
      INSERT INTO users (id, name, email, password, role, created_at)
      VALUES (
        gen_random_uuid(),
        'masteradmin',
        'allmedicuniforms@gmail.com',
        $1,
        'ADMIN',
        NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        role = EXCLUDED.role,
        name = EXCLUDED.name
    `, [adminPassword]);

    console.log('✅ Schema synchronization completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Database schema synchronization — ESM runtime version
 * Runs directly with Node.js ESM + pg
 */

import { Pool } from 'pg';
import bcryptjs from 'bcryptjs';

function getDatabaseUrl() {
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
    console.warn('⚠️  Database configuration missing. Skipping migrations.');
    process.exit(0);
  }

  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

async function migrate() {
  let pool;
  try {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      connectionTimeoutMillis: 10000,
      // Robustez para entornos Docker/Easypanel: reintentos y keepalive
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      // Manejo de errores inesperados en el pool
      idleTimeoutMillis: 30000,
      max: 10,
    });

    // Manejar errores de clientes inactivos para evitar crash del proceso
    pool.on('error', (err) => {
      console.warn('⚠️  Unexpected Postgres pool error:', err.message);
    });
  } catch (err) {
    console.warn('⚠️  Could not create DB pool:', err.message);
    console.warn('   Skipping migrations — app will use fallback data if configured.');
    process.exit(0);
  }

  const client = await pool.connect();

  try {
    console.log('  Checking database connection...');
    const testResult = await client.query('SELECT NOW() as time');
    console.log('  Connected:', testResult.rows[0].time);

    // ── 1. Ensure users table ──
    console.log('  Ensuring users table...');
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

    // ── 2. Auth tables ──
    console.log('  Ensuring auth tables...');
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

    // ── 3. Core tables ──
    console.log('  Ensuring core tables...');

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        color_id TEXT,
        url TEXT NOT NULL,
        alt TEXT,
        sort_order INTEGER DEFAULT 0
      )
    `);

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
        status TEXT NOT NULL DEFAULT 'SENT',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

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
        product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
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

    // ── 4. Add missing columns to existing tables ──
    console.log('  Checking for missing columns...');
    const variantColumns = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'product_variants'
    `);
    const existingVariantCols = new Set(variantColumns.rows.map(r => r.column_name));

    if (!existingVariantCols.has('stock')) {
      console.log('    Adding stock column to product_variants...');
      await client.query(`ALTER TABLE product_variants ADD COLUMN stock INTEGER DEFAULT 0`);
    }
    if (!existingVariantCols.has('location')) {
      console.log('    Adding location column to product_variants...');
      await client.query(`ALTER TABLE product_variants ADD COLUMN location TEXT`);
    }
    if (!existingVariantCols.has('min_stock')) {
      console.log('    Adding min_stock column to product_variants...');
      await client.query(`ALTER TABLE product_variants ADD COLUMN min_stock INTEGER DEFAULT 5`);
    }

    // ── 5. Create indexes ──
    console.log('  Ensuring indexes...');
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id)`,
      `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`,
      `CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender)`,
      `CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id)`,
      `CREATE INDEX IF NOT EXISTS idx_variants_color ON product_variants(color_id)`,
      `CREATE INDEX IF NOT EXISTS idx_images_product ON product_images(product_id)`,
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
      } catch (err) {
        if (!err.message?.includes('already exists')) {
          console.warn(`    Warning: ${err.message}`);
        }
      }
    }

    // HNSW vector index (optional)
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_embeddings_vector
        ON product_embeddings
        USING hnsw (embedding vector_cosine_ops)
      `);
      console.log('  HNSW vector index verified');
    } catch (err) {
      console.log('  HNSW index skipped (pgvector may not be available)');
    }

    // ── 6. Ensure admin user ──
    console.log('  Ensuring admin user...');
    const adminPassword = await bcryptjs.hash('AMU.master26', 12);

    await client.query(`
      INSERT INTO users (id, name, email, password, role, created_at)
      VALUES (
        'usr-masteradmin',
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

    console.log('✅ Database migrations completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    // Don't exit with error — let the app start anyway with fallback data
    console.warn('   App will start but may use fallback data.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().then(() => process.exit(0)).catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(0); // Don't block startup
});

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://amuUser:AllMedic2026ProjectNtte@31.220.56.1:5435/amuData?sslmode=disable',
});

async function main() {
  try {
    console.log('=== CONECTANDO A LA BASE DE DATOS ===');
    console.log('Host: 31.220.56.1:5435');
    console.log('Database: amuData');
    console.log('');

    // 1. Verificar tablas existentes
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('=== TABLAS ENCONTRADAS ===');
    console.log('Total:', tablesResult.rows.length);
    tablesResult.rows.forEach(r => console.log('  -', r.table_name));
    console.log('');

    // 2. Contar productos
    const productsResult = await pool.query('SELECT COUNT(*) as count FROM products');
    console.log('=== PRODUCTOS ===');
    console.log('Total:', productsResult.rows[0].count);
    console.log('');

    // 3. Contar marcas
    const brandsResult = await pool.query('SELECT COUNT(*) as count FROM brands');
    console.log('=== MARCAS ===');
    console.log('Total:', brandsResult.rows[0].count);
    console.log('');

    // 4. Contar colores
    const colorsResult = await pool.query('SELECT COUNT(*) as count FROM colors');
    console.log('=== COLORES ===');
    console.log('Total:', colorsResult.rows[0].count);
    console.log('');

    // 5. Contar variantes
    const variantsResult = await pool.query('SELECT COUNT(*) as count FROM product_variants');
    console.log('=== VARIANTES ===');
    console.log('Total:', variantsResult.rows[0].count);
    console.log('');

    // 6. Contar imágenes
    const imagesResult = await pool.query('SELECT COUNT(*) as count FROM product_images');
    console.log('=== IMÁGENES ===');
    console.log('Total:', imagesResult.rows[0].count);
    console.log('');

    // 7. Mostrar primeros 3 productos
    const sampleProducts = await pool.query(`
      SELECT id, slug, name, sku, brand_id, category, gender, price_normal, is_active 
      FROM products 
      LIMIT 3
    `);
    console.log('=== MUESTRA DE PRODUCTOS ===');
    sampleProducts.rows.forEach(p => {
      console.log(JSON.stringify(p, null, 2));
    });
    console.log('');

    // 8. Mostrar primeras 3 marcas
    const sampleBrands = await pool.query('SELECT id, name, slug FROM brands LIMIT 3');
    console.log('=== MUESTRA DE MARCAS ===');
    sampleBrands.rows.forEach(b => console.log(JSON.stringify(b)));
    console.log('');

    // 9. Mostrar primeros 3 colores
    const sampleColors = await pool.query('SELECT id, name, code, hex FROM colors LIMIT 3');
    console.log('=== MUESTRA DE COLORES ===');
    sampleColors.rows.forEach(c => console.log(JSON.stringify(c)));
    console.log('');

    // 10. Verificar variantes e imágenes de un producto
    if (sampleProducts.rows.length > 0) {
      const productId = sampleProducts.rows[0].id;
      const productVariants = await pool.query(
        'SELECT * FROM product_variants WHERE product_id = $1',
        [productId]
      );
      const productImages = await pool.query(
        'SELECT * FROM product_images WHERE product_id = $1',
        [productId]
      );
      console.log('=== VARIANTES DEL PRIMER PRODUCTO ===');
      console.log('Total:', productVariants.rows.length);
      productVariants.rows.forEach(v => console.log(JSON.stringify(v)));
      console.log('');
      console.log('=== IMÁGENES DEL PRIMER PRODUCTO ===');
      console.log('Total:', productImages.rows.length);
      productImages.rows.forEach(i => console.log(JSON.stringify(i)));
    }

  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}

main();

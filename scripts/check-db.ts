import { db } from '../src/db';
import { products, productVariants, productImages, brands, colors } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('=== Checking Database ===');
  
  const productCount = await db.select({ count: products.id }).from(products);
  console.log('Total products:', productCount.length);
  
  const prods = await db.select({ 
    id: products.id, 
    name: products.name,
    slug: products.slug,
    brandId: products.brandId,
  }).from(products).limit(3);
  
  console.log('\nFirst 3 products:');
  for (const p of prods) {
    console.log(`  - ${p.name} (${p.id})`);
    const variants = await db.select().from(productVariants).where(eq(productVariants.productId, p.id));
    const images = await db.select().from(productImages).where(eq(productImages.productId, p.id));
    console.log(`    Variants: ${variants.length}`);
    console.log(`    Images: ${images.length}`);
    if (variants.length > 0) {
      console.log(`    First variant:`, JSON.stringify(variants[0], null, 2).substring(0, 200));
    }
    if (images.length > 0) {
      console.log(`    First image:`, JSON.stringify(images[0], null, 2).substring(0, 200));
    }
  }
  
  const allBrands = await db.select({ id: brands.id, name: brands.name }).from(brands);
  console.log(`\nTotal brands: ${allBrands.length}`);
  
  const allColors = await db.select({ id: colors.id, name: colors.name }).from(colors);
  console.log(`Total colors: ${allColors.length}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

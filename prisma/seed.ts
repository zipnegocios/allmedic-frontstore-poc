import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create brands
  const brands = await Promise.all([
    prisma.brand.upsert({
      where: { slug: 'mediclife' },
      update: {},
      create: {
        name: 'MedicLife',
        slug: 'mediclife',
        description: 'Equipos médicos de calidad premium',
        logoUrl: '/images/brands/mediclife.png',
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.brand.upsert({
      where: { slug: 'cardiotech' },
      update: {},
      create: {
        name: 'CardioTech',
        slug: 'cardiotech',
        description: 'Soluciones cardiovasculares avanzadas',
        logoUrl: '/images/brands/cardiotech.png',
        isActive: true,
        sortOrder: 2,
      },
    }),
  ]);

  console.log(`✅ Created ${brands.length} brands`);

  // Create colors
  const colors = await Promise.all([
    prisma.color.upsert({
      where: { code: 'white' },
      update: {},
      create: {
        name: 'Blanco',
        code: 'white',
        hex: '#FFFFFF',
      },
    }),
    prisma.color.upsert({
      where: { code: 'blue' },
      update: {},
      create: {
        name: 'Azul Médico',
        code: 'blue',
        hex: '#0066CC',
      },
    }),
    prisma.color.upsert({
      where: { code: 'green' },
      update: {},
      create: {
        name: 'Verde Clínico',
        code: 'green',
        hex: '#00AA00',
      },
    }),
  ]);

  console.log(`✅ Created ${colors.length} colors`);

  // Create sample products
  const sampleProducts = [
    {
      slug: 'bata-medica-blanca-premium',
      name: 'Bata Médica Blanca Premium',
      description: 'Bata médica de algodón 100% con bolsillos funcionales',
      sku: 'BATA-001',
      brandId: brands[0].id,
      category: 'Batas',
      gender: 'UNISEX' as const,
      priceNormal: 45.99,
      priceSale: null,
      isActive: true,
    },
    {
      slug: 'estetoscopio-digital-cardiax',
      name: 'Estetoscopio Digital CardiAX',
      description: 'Estetoscopio digital con tecnología de cancelación de ruido',
      sku: 'ESTET-001',
      brandId: brands[1].id,
      category: 'Accesorios',
      gender: 'UNISEX' as const,
      priceNormal: 299.99,
      priceSale: 249.99,
      isActive: true,
    },
  ];

  const products = await Promise.all(
    sampleProducts.map(p =>
      prisma.product.upsert({
        where: { slug: p.slug },
        update: {},
        create: {
          ...p,
          priceNormal: new Prisma.Decimal(p.priceNormal),
          priceSale: p.priceSale ? new Prisma.Decimal(p.priceSale) : null,
        },
      })
    )
  );

  console.log(`✅ Created ${products.length} products`);

  // Create product variants
  for (const product of products) {
    const sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL'];

    for (const color of colors.slice(0, 2)) {
      for (const size of sizes) {
        await prisma.productVariant.upsert({
          where: {
            sku: `${product.sku}-${color.code}-${size}`,
          },
          update: {},
          create: {
            productId: product.id,
            colorId: color.id,
            size,
            sku: `${product.sku}-${color.code}-${size}`,
            status: 'AVAILABLE',
          },
        });
      }
    }
  }

  console.log(`✅ Created product variants`);

  // Create product images
  for (const product of products) {
    const imageCount = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < imageCount; i++) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: `/images/products/${product.slug}-${i + 1}.jpg`,
          alt: `${product.name} - Imagen ${i + 1}`,
          sortOrder: i,
        },
      });
    }
  }

  console.log(`✅ Created product images`);

  // Create stores
  const stores = await Promise.all([
    prisma.store.upsert({
      where: { name: 'Sucursal Centro Quito' },
      update: {},
      create: {
        name: 'Sucursal Centro Quito',
        address: 'Av. Amazonas 123, Quito',
        phone: '(02) 2555-0123',
        hours: 'Lunes - Viernes: 9:00 - 18:00',
        isMain: true,
        isActive: true,
        acceptsOnline: true,
        sortOrder: 1,
      },
    }),
  ]);

  console.log(`✅ Created ${stores.length} stores`);

  console.log('\n✨ Seed completed successfully!');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// Add Prisma import
import { Prisma } from '@prisma/client';

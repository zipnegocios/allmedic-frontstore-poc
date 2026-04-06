import { PrismaClient, Gender, VariantStatus } from '@prisma/client';

const prisma = new PrismaClient();

// ── Color data ──
const COLORS = [
  { id: 'navy', name: 'Navy', code: 'NV', hex: '#1B365D' },
  { id: 'black', name: 'Black', code: 'BK', hex: '#000000' },
  { id: 'white', name: 'White', code: 'WH', hex: '#FFFFFF' },
  { id: 'ceil', name: 'Ceil Blue', code: 'CB', hex: '#89CFF0' },
  { id: 'wine', name: 'Wine', code: 'WN', hex: '#722F37' },
  { id: 'teal', name: 'Teal', code: 'TL', hex: '#008080' },
  { id: 'burgundy', name: 'Burgundy', code: 'BG', hex: '#800020' },
  { id: 'royal', name: 'Royal Blue', code: 'RB', hex: '#4169E1' },
];

// ── Brand data ──
const BRANDS = [
  { name: 'FIGS', slug: 'figs', description: 'Tecnología FIONx premium para profesionales médicos', logoUrl: '/images/brands/figs.png' },
  { name: 'Cherokee', slug: 'cherokee', description: 'Uniformes médicos clásicos y duraderos', logoUrl: null },
  { name: "Grey's Anatomy", slug: 'greys-anatomy', description: 'Elegancia y comodidad para el profesional de salud', logoUrl: '/images/brands/greys-anatomy.png' },
  { name: 'WonderWink', slug: 'wonderwink', description: 'Scrubs coloridos con elasticidad superior', logoUrl: '/images/brands/wonderwink.png' },
  { name: 'Koi', slug: 'koi', description: 'Diseño único y funcionalidad para enfermería', logoUrl: '/images/brands/koi.png' },
  { name: 'Dickies', slug: 'dickies', description: 'Durabilidad y confiabilidad desde 1922', logoUrl: null },
  { name: 'Skechers', slug: 'skechers', description: 'Comodidad inspirada en calzado deportivo', logoUrl: '/images/brands/skechers.png' },
  { name: 'Healing Hands', slug: 'healing-hands', description: 'Scrubs premium con tecnología antimicrobiana', logoUrl: '/images/brands/healing-hands.png' },
  { name: 'Infinity', slug: 'infinity', description: 'Línea premium de Cherokee con tecnología Certainty', logoUrl: '/images/brands/infinity.png' },
  { name: 'Heartsoul', slug: 'heartsoul', description: 'Uniformes juveniles y llenos de energía', logoUrl: '/images/brands/heartsoul.png' },
  { name: 'Med Couture', slug: 'med-couture', description: 'Alta costura médica con tejidos premium', logoUrl: '/images/brands/med-couture.png' },
  { name: 'Landau', slug: 'landau', description: 'Uniformes médicos con herencia americana', logoUrl: '/images/brands/landau.png' },
  { name: 'Jaanuu', slug: 'jaanuu', description: 'Scrubs modernos con diseño minimalista', logoUrl: '/images/brands/jaanuu.png' },
  { name: 'Adar', slug: 'adar', description: 'Uniformes accesibles de alta calidad', logoUrl: '/images/brands/adar.png' },
  { name: 'Carhartt Liberty', slug: 'carhartt-liberty', description: 'Resistencia industrial para el entorno médico', logoUrl: '/images/brands/carhartt-liberty.png' },
  { name: 'Maevn', slug: 'maevn', description: 'Innovación en diseño y comodidad', logoUrl: '/images/brands/maevn.png' },
  { name: 'Mandala', slug: 'mandala', description: 'Diseño ecuatoriano para profesionales de salud', logoUrl: '/images/brands/mandala.png' },
];

// ── Gender mapping ──
const genderMap: Record<string, Gender> = {
  'Mujer': Gender.MUJER,
  'Hombre': Gender.HOMBRE,
  'Unisex': Gender.UNISEX,
};

// ── Image mapping ──
const PRODUCT_IMAGE_NUM: Record<string, number> = {
  'figs-casma': 1, 'figs-yola': 2, 'cherokee-workwear': 3, 'greys-anatomy-lexie': 4,
  'wonderwink-four-stretch': 5, 'koi-lindsey': 6, 'dickies-eds': 7, 'figs-catarina': 8,
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

function getImageUrl(productId: string, colorId: string): string {
  const imgNum = PRODUCT_IMAGE_NUM[productId] || 1;
  const productColors = PRODUCT_COLOR_IMAGES[imgNum] || {};
  const colorFile = productColors[colorId] || 'navy';
  return `/images/product-${imgNum}-${colorFile}-1.jpg`;
}

// ── Product data ──
const PRODUCTS = [
  {
    id: 'figs-casma', slug: 'figs-casma-scrub-top', name: 'Casma Scrub Top',
    brand: 'FIGS', category: 'Camisas', gender: 'Mujer',
    description: 'El Casma Scrub Top de FIGS combina estilo y funcionalidad. Con tejido elástico de cuatro direcciones y tecnología FIONx que repele líquidos.',
    features: ['Tejido FIONx elástico de 4 direcciones', 'Tecnología anti-microbiana', 'Bolsillos laterales profundos', 'Cuello en V moderno', 'Ajuste atlético'],
    careInstructions: ['Lavar en agua fría', 'No usar blanqueador', 'Secar a baja temperatura', 'Planchar a temperatura media'],
    priceNormal: 48.00, priceSale: 38.40, discountPct: 20,
    discountEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    colorIds: ['navy', 'black', 'ceil', 'burgundy'],
    sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
    isNew: true, isBestSeller: true, complementary: 'figs-yola',
  },
  {
    id: 'figs-yola', slug: 'figs-yola-scrub-pants', name: 'Yola Scrub Pants',
    brand: 'FIGS', category: 'Pantalones', gender: 'Mujer',
    description: 'Pantalones scrub Yola con cintura elástica y ajuste cómodo.',
    features: ['Cintura elástica ajustable', 'Bolsillos cargo laterales', 'Tejido transpirable', 'Resistente a arrugas'],
    careInstructions: ['Lavar en ciclo suave', 'No usar suavizante', 'Secar al aire libre preferiblemente'],
    priceNormal: 52.00, colorIds: ['navy', 'black', 'wine'],
    sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
    isNew: false, isBestSeller: true, complementary: 'figs-casma',
  },
  {
    id: 'cherokee-workwear', slug: 'cherokee-workwear-scrub-top', name: 'Workwear Scrub Top',
    brand: 'Cherokee', category: 'Camisas', gender: 'Unisex',
    description: 'El clásico scrub top de Cherokee Workwear. Duradero, cómodo y asequible.',
    features: ['Mezcla de poliéster y algodón', 'Dos bolsillos frontales', 'Cuello en V', 'Fácil cuidado'],
    careInstructions: ['Lavar a máquina', 'Secar en secadora', 'No necesita plancha'],
    priceNormal: 24.99, priceSale: 19.99, discountPct: 20,
    colorIds: ['navy', 'black', 'white', 'ceil'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    isNew: false, isBestSeller: true,
  },
  {
    id: 'greys-anatomy-lexie', slug: 'greys-anatomy-lexie-scrub-top', name: 'Lexie Scrub Top',
    brand: "Grey's Anatomy", category: 'Camisas', gender: 'Mujer',
    description: 'Elegante scrub top con detalles de moda. Tejido suave.',
    features: ['Tejido suave y elástico', 'Detalles de costuras decorativas', 'Bolsillos funcionales', 'Ajuste favorecedor'],
    careInstructions: ['Lavar en agua fría', 'Secar a baja temperatura'],
    priceNormal: 38.00, colorIds: ['navy', 'black', 'teal'],
    sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
    isNew: true, isBestSeller: false,
  },
  {
    id: 'wonderwink-four-stretch', slug: 'wonderwink-four-stretch-scrub-top', name: 'Four-Stretch Scrub Top',
    brand: 'WonderWink', category: 'Camisas', gender: 'Mujer',
    description: 'Scrub top con elástico de cuatro direcciones para máxima comodidad.',
    features: ['Elástico de 4 direcciones', 'Bolsillos múltiples', 'Cuello redondo', 'Colores vibrantes'],
    careInstructions: ['Lavar a máquina', 'No usar blanqueador'],
    priceNormal: 32.00, priceSale: 25.60, discountPct: 20,
    discountEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    colorIds: ['navy', 'black', 'wine', 'burgundy'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    isNew: false, isBestSeller: true,
  },
  {
    id: 'koi-lindsey', slug: 'koi-lindsey-scrub-pants', name: 'Lindsey Scrub Pants',
    brand: 'Koi', category: 'Pantalones', gender: 'Mujer',
    description: 'Pantalones scrub Lindsey con estilo único y funcionalidad superior.',
    features: ['Diseño de carga con múltiples bolsillos', 'Cintura ajustable con cordón', 'Tejido duradero', 'Colores de moda'],
    careInstructions: ['Lavar en agua fría', 'Secar en secadora a baja temperatura'],
    priceNormal: 42.00, colorIds: ['navy', 'black', 'ceil'],
    sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
    isNew: true, isBestSeller: false,
  },
  {
    id: 'dickies-eds', slug: 'dickies-eds-scrub-top', name: 'EDS Scrub Top',
    brand: 'Dickies', category: 'Camisas', gender: 'Unisex',
    description: 'El clásico EDS de Dickies. Confiabilidad y durabilidad desde 1922.',
    features: ['Tejido resistente', 'Costuras reforzadas', 'Bolsillos funcionales', 'Fácil mantenimiento'],
    careInstructions: ['Lavar a máquina', 'Secar en secadora', 'No necesita plancha'],
    priceNormal: 22.00, priceSale: 17.60, discountPct: 20,
    colorIds: ['navy', 'black', 'white'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    isNew: false, isBestSeller: true,
  },
  {
    id: 'figs-catarina', slug: 'figs-catarina-scrub-top', name: 'Catarina Scrub Top',
    brand: 'FIGS', category: 'Camisas', gender: 'Mujer',
    description: 'Scrub top Catarina con diseño elegante y funcionalidad superior.',
    features: ['Tejido FIONx premium', 'Diseño asimétrico moderno', 'Múltiples bolsillos', 'Ajuste favorecedor'],
    careInstructions: ['Lavar en agua fría', 'Secar a baja temperatura'],
    priceNormal: 46.00, colorIds: ['navy', 'black', 'burgundy', 'royal'],
    sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
    isNew: true, isBestSeller: true,
  },
];

// ── Stores ──
const STORES = [
  { name: 'AllMedic Quito - Matriz', address: 'Av. 6 de Diciembre N34-123, Quito, Ecuador', phone: '+593 2 123 4567', hours: 'Lun - Vie: 9:00 - 18:00, Sáb: 10:00 - 14:00', isMain: true },
  { name: 'AllMedic Guayaquil', address: 'Av. 9 de Octubre 1234, Guayaquil, Ecuador', phone: '+593 4 234 5678', hours: 'Lun - Vie: 9:00 - 18:00, Sáb: 10:00 - 14:00', isMain: false },
  { name: 'AllMedic Cuenca', address: 'Calle Larga 567, Cuenca, Ecuador', phone: '+593 7 345 6789', hours: 'Lun - Vie: 9:00 - 18:00, Sáb: 10:00 - 14:00', isMain: false },
];

// ── Banners ──
const BANNERS = [
  { title: 'Uniformes médicos de alta calidad', subtitle: 'Descubre nuestra colección de scrubs premium diseñados para profesionales de la salud.', imageDesktop: '/images/hero-1.jpg', ctaText: 'Ver catálogo', ctaLink: '/catalogo' },
  { title: 'Nueva colección FIGS 2024', subtitle: 'Los scrubs más cómodos y estilosos del mercado. Tecnología FIONx de última generación.', imageDesktop: '/images/hero-2.jpg', ctaText: 'Descubrir', ctaLink: '/catalogo?brand=FIGS' },
  { title: 'Descuentos en Cherokee', subtitle: 'Hasta 20% de descuento en toda la línea Cherokee Workwear.', imageDesktop: '/images/hero-3.jpg', ctaText: 'Ver ofertas', ctaLink: '/catalogo?brand=Cherokee' },
];

async function main() {
  console.log('🌱 Starting seed...\n');

  // Clean existing data
  console.log('🗑️  Cleaning existing data...');
  await prisma.whatsAppClick.deleteMany();
  await prisma.searchLog.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.store.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.color.deleteMany();
  await prisma.brand.deleteMany();
  console.log('   Done.\n');

  // 1. Colors
  console.log('🎨 Seeding colors...');
  for (const color of COLORS) {
    await prisma.color.create({ data: { id: color.id, name: color.name, code: color.code, hex: color.hex } });
  }
  console.log(`   ✓ ${COLORS.length} colors\n`);

  // 2. Brands
  console.log('🏷️  Seeding brands...');
  const brandMap: Record<string, string> = {};
  for (let i = 0; i < BRANDS.length; i++) {
    const b = BRANDS[i];
    const created = await prisma.brand.create({ data: { name: b.name, slug: b.slug, description: b.description, logoUrl: b.logoUrl, sortOrder: i } });
    brandMap[b.name] = created.id;
  }
  console.log(`   ✓ ${BRANDS.length} brands\n`);

  // 3. Products + Variants + Images
  console.log('📦 Seeding products...');
  let totalVariants = 0;
  let totalImages = 0;

  for (const p of PRODUCTS) {
    const brandId = brandMap[p.brand];
    if (!brandId) { console.error(`   ✗ Brand not found: ${p.brand}`); continue; }

    const created = await prisma.product.create({
      data: {
        slug: p.slug, name: p.name, description: p.description, brandId,
        category: p.category, gender: genderMap[p.gender],
        priceNormal: p.priceNormal, priceSale: p.priceSale ?? null,
        discountPct: p.discountPct ?? null, discountEnd: p.discountEnd ?? null,
        isNew: p.isNew ?? false, isBestSeller: p.isBestSeller ?? false,
        crossSellId: p.complementary ?? null,
        features: p.features, careInstructions: p.careInstructions,
      },
    });

    const statuses: VariantStatus[] = [VariantStatus.AVAILABLE, VariantStatus.AVAILABLE, VariantStatus.AVAILABLE, VariantStatus.BACKORDER, VariantStatus.OUT_OF_STOCK];
    let idx = 0;
    const seenImages = new Set<string>();

    for (const colorId of p.colorIds) {
      for (const size of p.sizes) {
        await prisma.productVariant.create({
          data: { productId: created.id, colorId, size, sku: `${p.id}-${colorId.toUpperCase()}-${size}`, status: statuses[idx++ % statuses.length] },
        });
        totalVariants++;
      }

      const imageUrl = getImageUrl(p.id, colorId);
      if (!seenImages.has(imageUrl)) {
        seenImages.add(imageUrl);
        await prisma.productImage.create({
          data: { productId: created.id, colorId, url: imageUrl, alt: `${p.name} - ${colorId}`, sortOrder: totalImages },
        });
        totalImages++;
      }
    }
    console.log(`   ✓ ${p.name} (${p.colorIds.length} colors × ${p.sizes.length} sizes)`);
  }
  console.log(`   Total: ${PRODUCTS.length} products, ${totalVariants} variants, ${totalImages} images\n`);

  // 4. Stores
  console.log('🏪 Seeding stores...');
  for (let i = 0; i < STORES.length; i++) {
    await prisma.store.create({ data: { ...STORES[i], sortOrder: i } });
  }
  console.log(`   ✓ ${STORES.length} stores\n`);

  // 5. Banners
  console.log('🖼️  Seeding banners...');
  for (let i = 0; i < BANNERS.length; i++) {
    await prisma.banner.create({ data: { ...BANNERS[i], sortOrder: i } });
  }
  console.log(`   ✓ ${BANNERS.length} banners\n`);

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

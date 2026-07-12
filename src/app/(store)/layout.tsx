import { CartProvider } from '@/context/CartContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { PriceVisibilityProvider } from '@/context/PriceVisibilityContext';
import { AppShell } from '@/components/layout/AppShell';
import { getAllProducts, getBrandsForNav, getStores } from '@/lib/data-service';
import { getAllBusinessRules } from '@/lib/corporate-data-service';
import { resolveRules } from '@/lib/rules-engine';

// Fuerza renderizado dinámico en toda la tienda: la base de datos no está disponible
// durante `docker build` (solo en runtime vía EasyPanel), así que un prerender estático
// aquí horneraría los datos de prueba de dummy-data.ts en el HTML servido en producción.
export const dynamic = 'force-dynamic';

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [products, brands, stores, rules] = await Promise.all([
    getAllProducts(),
    getBrandsForNav(),
    getStores(),
    getAllBusinessRules(),
  ]);

  const resolved = resolveRules(rules, {});
  const showPrices = resolved.priceVisibility.showPrices &&
    (resolved.priceVisibility.catalog === 'INDIVIDUAL' || resolved.priceVisibility.catalog === 'BOTH');

  return (
    <NotificationProvider>
      <PriceVisibilityProvider showPrices={showPrices}>
        <CartProvider>
          <AppShell products={products} brands={brands} stores={stores}>
            {children}
          </AppShell>
        </CartProvider>
      </PriceVisibilityProvider>
    </NotificationProvider>
  );
}

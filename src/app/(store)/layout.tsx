import { CartProvider } from '@/context/CartContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { PriceVisibilityProvider } from '@/context/PriceVisibilityContext';
import { AppShell } from '@/components/layout/AppShell';
import { getAllProducts, getBrandsForNav, getStores } from '@/lib/data-service';
import { getAllBusinessRules } from '@/lib/corporate-data-service';

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

  // Solo las reglas PRICE_VISIBILITY viajan al cliente — se resuelven por ítem (marca/producto)
  // en cada componente que las consulta, no una sola vez de forma global.
  const priceVisibilityRules = rules.filter((r) => r.ruleType === 'PRICE_VISIBILITY');

  return (
    <NotificationProvider>
      <PriceVisibilityProvider rules={priceVisibilityRules}>
        <CartProvider>
          <AppShell products={products} brands={brands} stores={stores}>
            {children}
          </AppShell>
        </CartProvider>
      </PriceVisibilityProvider>
    </NotificationProvider>
  );
}

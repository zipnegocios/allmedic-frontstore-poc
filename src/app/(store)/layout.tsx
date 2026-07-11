import { CartProvider } from '@/context/CartContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { AppShell } from '@/components/layout/AppShell';
import { getAllProducts, getBrandNames, getStores } from '@/lib/data-service';

// Fuerza renderizado dinámico en toda la tienda: la base de datos no está disponible
// durante `docker build` (solo en runtime vía EasyPanel), así que un prerender estático
// aquí horneraría los datos de prueba de dummy-data.ts en el HTML servido en producción.
export const dynamic = 'force-dynamic';

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [products, brands, stores] = await Promise.all([
    getAllProducts(),
    getBrandNames(),
    getStores(),
  ]);

  return (
    <NotificationProvider>
      <CartProvider>
        <AppShell products={products} brands={brands} stores={stores}>
          {children}
        </AppShell>
      </CartProvider>
    </NotificationProvider>
  );
}

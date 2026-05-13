import { CartProvider } from '@/context/CartContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { AppShell } from '@/components/layout/AppShell';
import { getAllProducts, getBrandNames, getStores } from '@/lib/data-service';

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

import type { Metadata } from 'next';
import { CartProvider } from '@/context/CartContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { AppShell } from '@/components/layout/AppShell';
import { getAllProducts, getBrandNames, getStores } from '@/lib/data-service';
import '@/index.css';

export const metadata: Metadata = {
  title: 'Allmedic Frontstore',
  description: 'Catálogo de productos médicos Allmedic',
  icons: '/favicon.ico',
};

export default async function RootLayout({
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
    <html lang="es">
      <body>
        <NotificationProvider>
          <CartProvider>
            <AppShell products={products} brands={brands} stores={stores}>
              {children}
            </AppShell>
          </CartProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}

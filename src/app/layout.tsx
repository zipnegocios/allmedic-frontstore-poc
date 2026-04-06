import type { Metadata } from 'next';
import { CartProvider } from '@/context/CartContext';
import { NotificationProvider } from '@/context/NotificationContext';
import '@/index.css';

export const metadata: Metadata = {
  title: 'Allmedic Frontstore',
  description: 'Catálogo de productos médicos Allmedic',
  icons: '/favicon.ico',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <NotificationProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}

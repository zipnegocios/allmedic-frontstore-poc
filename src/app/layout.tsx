import type { Metadata } from 'next';
import '@/index.css';
import { SessionProvider } from '@/components/providers/SessionProvider';

export const metadata: Metadata = {
  title: 'All Medic - Uniformes Médicos Americanos | Ecuador',
  description: 'Catálogo de productos médicos Allmedic',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

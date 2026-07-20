import type { Metadata } from 'next';
import { Anton, Inter } from 'next/font/google';
import '@/index.css';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { Toaster } from '@/components/ui/sonner';

// Fuente display (headings): Anton — peso único 400, impacto visual por mayúsculas + line-height 1
const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

// Fuente primaria (body / UI): Inter — pesos 400, 500, 600
const inter = Inter({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'All Medic - Uniformes Médicos Americanos | Ecuador',
  description: 'Catálogo de productos médicos Allmedic',
  icons: {
    icon: [
      { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/favicon/favicon-180x180.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${anton.variable} ${inter.variable}`}>
      <body>
        <SessionProvider>{children}</SessionProvider>
        <Toaster />
      </body>
    </html>
  );
}

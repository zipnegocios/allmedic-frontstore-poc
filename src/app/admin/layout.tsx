import type { Metadata } from 'next';

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: '/favicon/dashboard/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon/dashboard/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon/dashboard/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon/dashboard/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon/dashboard/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/favicon/dashboard/favicon-180x180.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React 19 with Next.js
  reactStrictMode: true,

  // Image optimization — transformaciones vía Cloudflare Images (edge), no el optimizador de Next.
  images: {
    loader: 'custom',
    loaderFile: './src/lib/cloudflare-image-loader.ts',
  },

  // Environment variables expuestas en build time
  env: {
    NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.VITE_WHATSAPP_NUMBER,
    NEXT_PUBLIC_R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
  },

  // Use Turbopack (Next.js 16 default)
  turbopack: {},

  // Security headers
  poweredByHeader: false,

  // ─── Configuración CRÍTICA para Docker standalone ───
  // Genera server.js para ejecutar sin next start
  output: 'standalone',

  // Deshabilitar el trailing slash para evitar redirecciones 308
  trailingSlash: false,

  // Redirects 301 de compatibilidad — rutas del panel admin en inglés (legacy)
  // hacia sus equivalentes en español. Protege bookmarks y enlaces guardados.
  async redirects() {
    return [
      { source: '/admin/products/new', destination: '/admin/productos/nuevo', permanent: true },
      { source: '/admin/products/:id', destination: '/admin/productos/:id', permanent: true },
      { source: '/admin/products', destination: '/admin/productos', permanent: true },
      { source: '/admin/media', destination: '/admin/biblioteca', permanent: true },
      { source: '/admin/leads', destination: '/admin/prospectos', permanent: true },
      { source: '/admin/brands', destination: '/admin/marcas', permanent: true },
      { source: '/admin/colors', destination: '/admin/colores', permanent: true },
      { source: '/admin/stores', destination: '/admin/sucursales', permanent: true },
      { source: '/admin/sets/new', destination: '/admin/sets/nuevo', permanent: true },
      { source: '/admin/set-groups', destination: '/admin/grupos-de-sets', permanent: true },
      { source: '/admin/corporate-accounts', destination: '/admin/cuentas-corporativas', permanent: true },
      { source: '/admin/quotes/:id', destination: '/admin/cotizaciones/:id', permanent: true },
      { source: '/admin/quotes', destination: '/admin/cotizaciones', permanent: true },
      { source: '/admin/rules/new', destination: '/admin/reglas/nueva', permanent: true },
      { source: '/admin/rules/:id', destination: '/admin/reglas/:id', permanent: true },
      { source: '/admin/rules', destination: '/admin/reglas', permanent: true },
    ];
  },

  // Headers de seguridad para producción
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

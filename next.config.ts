import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React 19 with Next.js
  reactStrictMode: true,

  // Image optimization
  images: {
    unoptimized: true, // For Hostinger/EasyPanel compatibility
  },

  // Environment variables expuestas en build time
  env: {
    NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.VITE_WHATSAPP_NUMBER,
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

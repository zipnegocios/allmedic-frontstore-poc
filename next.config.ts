import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React 19 with Next.js
  reactStrictMode: true,

  // Image optimization
  images: {
    unoptimized: true, // For Hostinger compatibility
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.VITE_WHATSAPP_NUMBER,
  },

  // Use Turbopack (Next.js 16 default)
  turbopack: {},

  // Security headers
  poweredByHeader: false,
};

export default nextConfig;

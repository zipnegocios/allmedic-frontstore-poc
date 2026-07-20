/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/legacy-pages/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // ── Sistema tipográfico Allmedic ──────────────────────────────────────
      fontFamily: {
        display: ['var(--font-display)', 'Impact', 'sans-serif'], // Anton
        sans:    ['var(--font-sans)', 'Helvetica Neue', 'Arial', 'sans-serif'], // Inter
      },
      fontSize: {
        'body-xs': ['0.625rem', { lineHeight: '1.6' }],           // 10px — badges
        'body-sm': ['0.75rem',  { lineHeight: '1.6' }],           // 12px — captions, SKU, vendor
        'body-md': ['0.875rem', { lineHeight: '1.6' }],           // 14px — body, cards, precios
        'body-lg': ['1rem',     { lineHeight: '1.6' }],           // 16px — navegación
        'h1-pdp':  ['1.25rem',  { lineHeight: '1.4', fontWeight: '500' }], // 20px — título PDP
        'h2':      ['1.5rem',   { lineHeight: '1' }],             // 24px — H2 sección desktop
        'h2-mobile': ['1.125rem', { lineHeight: '1' }],           // 18px — H2 sección móvil
        'h1-col':  ['2.5rem',   { lineHeight: '1' }],             // 40px — H1 colección/catálogo
        'h1-hero': ['5rem',     { lineHeight: '1' }],             // 80px — H1 hero desktop
      },
      letterSpacing: {
        badge: '0.04em',
      },
      // ── Token de proporción de imagen de producto (650 × 1000 px nativos) ─
      aspectRatio: {
        product: '650 / 1000',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "shimmer-fast": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 3s linear infinite",
        "shimmer-fast": "shimmer 1.5s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

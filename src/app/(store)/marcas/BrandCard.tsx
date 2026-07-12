'use client';

import Link from 'next/link';
import { ArrowRight, Package } from 'lucide-react';

interface BrandCardProps {
  brand: {
    slug: string;
    name: string;
    productCount: number;
    logoUrl: string | null;
  };
}

export function BrandCard({ brand }: BrandCardProps) {
  return (
    <Link
      href={`/catalogo?brand=${encodeURIComponent(brand.name)}`}
      className="group bg-[#F5F5F7] rounded-xl p-6 sm:p-8 hover:bg-[#111111] transition-all duration-300"
    >
      <div className="aspect-square max-w-[80px] sm:max-w-[100px] mx-auto mb-4 flex items-center justify-center">
        {brand.logoUrl ? (
          <img
            src={brand.logoUrl}
            alt={brand.name}
            className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                const fallback = document.createElement('div');
                fallback.className = 'text-lg sm:text-xl font-bold text-[#111111] group-hover:text-white text-center transition-colors';
                fallback.textContent = brand.name;
                parent.appendChild(fallback);
              }
            }}
          />
        ) : (
          <span className="text-lg sm:text-xl font-bold text-[#111111] group-hover:text-white text-center transition-colors">
            {brand.name}
          </span>
        )}
      </div>

      <h3 className="text-base sm:text-lg font-semibold text-[#111111] group-hover:text-white text-center mb-2 transition-colors">
        {brand.name}
      </h3>

      <div className="flex items-center justify-center gap-1 text-sm text-gray-500 group-hover:text-gray-300 transition-colors">
        <Package className="w-4 h-4" strokeWidth={1.5} />
        <span>{brand.productCount} productos</span>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1 text-sm font-medium text-[#111111] group-hover:text-white opacity-0 group-hover:opacity-100 transition-all">
        <span>Ver productos</span>
        <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
      </div>
    </Link>
  );
}

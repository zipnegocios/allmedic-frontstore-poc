'use client';

import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { useAlternatingText } from '@/hooks/useAlternatingText';
import { cn } from '@/lib/utils';

const ALTERNATING_TEXTS = ['Ventas al Mayor', 'Compras Corporativas'];

export function CorporateNavCTA({ className }: { className?: string }) {
  const { text, fade } = useAlternatingText(ALTERNATING_TEXTS);

  return (
    <Link
      href="/corporativo"
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full',
        'bg-[#111111] text-white hover:opacity-90 transition-opacity',
        className
      )}
    >
      <Building2 className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
      <span
        aria-live="polite"
        className={cn('transition-opacity duration-300 motion-reduce:transition-none', fade ? 'opacity-100' : 'opacity-0')}
      >
        {text}
        <span className="sr-only"> — Ventas al Mayor y Compras Corporativas</span>
      </span>
    </Link>
  );
}

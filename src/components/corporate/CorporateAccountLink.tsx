'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { UserCircle } from 'lucide-react';

export function CorporateAccountLink() {
  const { data: session, status } = useSession();

  if (status === 'loading') return null;

  return (
    <Link
      href={session?.user ? '/corporativo/mi-cuenta' : '/corporativo/login'}
      className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors"
      aria-label={session?.user ? 'Mi cuenta' : 'Iniciar sesión'}
    >
      <UserCircle className="w-5 h-5" strokeWidth={1.5} />
    </Link>
  );
}

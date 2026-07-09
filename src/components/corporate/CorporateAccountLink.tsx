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
      className="fixed bottom-24 right-6 z-40 flex items-center gap-2 px-4 py-2 bg-white border border-[#E5E5E5] text-[#111111] rounded-full shadow-md hover:shadow-lg transition-shadow text-sm font-medium"
    >
      <UserCircle className="w-4 h-4" strokeWidth={1.5} />
      {session?.user ? 'Mi Cuenta' : 'Iniciar sesión'}
    </Link>
  );
}

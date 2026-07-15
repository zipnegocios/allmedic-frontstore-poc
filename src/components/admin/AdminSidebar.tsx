'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ImageIcon,
  Tag,
  Palette,
  Store,
  LogOut,
  Boxes,
  Layers,
  Building2,
  FileText,
  Images,
  Settings2,
  Settings,
  Trash2,
} from 'lucide-react';
import { signOut } from 'next-auth/react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/productos', label: 'Productos', icon: Package },
  { href: '/admin/biblioteca', label: 'Biblioteca', icon: Images },
  { href: '/admin/prospectos', label: 'Pedidos', icon: ShoppingCart },
  { href: '/admin/banners', label: 'Banners', icon: ImageIcon },
  { href: '/admin/marcas', label: 'Marcas', icon: Tag },
  { href: '/admin/colores', label: 'Colores', icon: Palette },
  { href: '/admin/sucursales', label: 'Sucursales', icon: Store },
  { href: '/admin/sets', label: 'Sets Corporativos', icon: Boxes },
  { href: '/admin/grupos-de-sets', label: 'Grupos de Sets', icon: Layers },
  { href: '/admin/cuentas-corporativas', label: 'Cuentas Corporativas', icon: Building2 },
  { href: '/admin/cotizaciones', label: 'Cotizaciones', icon: FileText },
  { href: '/admin/reglas', label: 'Motor de Reglas', icon: Settings2 },
  { href: '/admin/papelera', label: 'Papelera', icon: Trash2 },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
];

export function AdminSidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside className={cn('w-64 bg-[#111111] text-white min-h-screen flex-col', className)}>
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold">AllMedic Admin</h1>
        <p className="text-xs text-gray-400 mt-1">Panel de administración</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white text-[#111111]'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={async () => {
            await signOut({ redirect: false });
            window.location.href = '/admin/login';
          }}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors w-full"
        >
          <LogOut className="w-5 h-5" strokeWidth={1.5} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

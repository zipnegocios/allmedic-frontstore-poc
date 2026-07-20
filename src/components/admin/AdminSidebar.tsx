'use client';

import { useState, useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight,
  ListTree,
  Shirt,
} from 'lucide-react';
import { signOut } from 'next-auth/react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/productos', label: 'Productos', icon: Package },
  { href: '/admin/biblioteca', label: 'Biblioteca', icon: Images },
  { href: '/admin/prospectos', label: 'Pedidos', icon: ShoppingCart },
  { href: '/admin/banners', label: 'Banners', icon: ImageIcon },
  { href: '/admin/marcas', label: 'Marcas', icon: Tag },
  { href: '/admin/tipos-producto', label: 'Tipos de Producto', icon: Shirt },
  { href: '/admin/atributos', label: 'Atributos', icon: ListTree },
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Carga el estado de colapsado desde localStorage
  useEffect(() => {
    const stored = localStorage.getItem('admin_sidebar_collapsed');
    if (stored !== null) {
      setIsCollapsed(stored === 'true');
    }
  }, []);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('admin_sidebar_collapsed', String(next));
  };

  return (
    <aside
      className={cn(
        'bg-[#111111] text-white min-h-screen flex flex-col transition-all duration-300 ease-in-out shrink-0',
        isCollapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Header with Logo and Collapse Toggle */}
      <div
        className={cn(
          'border-b border-white/10 flex items-center shrink-0 h-[77px] transition-all duration-300',
          isCollapsed ? 'justify-center p-4' : 'justify-between px-5 py-4'
        )}
      >
        {!isCollapsed && (
          <div className="flex flex-col min-w-0">
            <img
              src="/images/allmedic_logo_white.png"
              alt="AllMedic"
              className="h-6 object-contain self-start"
            />
            <p className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">
              Panel de administración
            </p>
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white shrink-0"
          title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation menu */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <div key={item.href} className="relative group">
              <Link
                href={item.href}
                className={cn(
                  'flex items-center rounded-lg text-sm font-medium transition-colors',
                  isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3',
                  isActive
                    ? 'bg-white text-[#111111]'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>

              {/* Tooltip when collapsed */}
              {isCollapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-black text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 delay-75 whitespace-nowrap z-50 shadow-md border border-white/10 flex items-center">
                  {item.label}
                  {/* Tooltip arrow */}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-black" />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Logout section */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <div className="relative group">
          <button
            onClick={async () => {
              await signOut({ redirect: false });
              window.location.href = '/admin/login';
            }}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors w-full',
              isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'
            )}
          >
            <LogOut className="w-5 h-5 shrink-0" strokeWidth={1.5} />
            {!isCollapsed && <span className="truncate">Cerrar sesión</span>}
          </button>

          {/* Tooltip when collapsed */}
          {isCollapsed && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-black text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 delay-75 whitespace-nowrap z-50 shadow-md border border-white/10 flex items-center">
              Cerrar sesión
              {/* Tooltip arrow */}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-black" />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

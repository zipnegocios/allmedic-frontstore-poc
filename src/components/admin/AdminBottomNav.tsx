'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
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
  Building2,
  FileText,
  Images,
  Settings2,
  Settings,
  Menu,
  Trash2,
  ListTree,
  Shirt,
  Users,
  ShieldCheck,
  Gauge,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { usePermissions } from '@/hooks/usePermissions';
import { resolveModuleForPath } from '@/lib/permissions/route-map';

/**
 * Determina si una ruta de navegación está activa, usando el mismo criterio
 * de coincidencia que `AdminSidebar`: coincidencia exacta o prefijo de segmento.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

/**
 * Variante de `isNavItemActive` para usar en listas de navegación que incluyen
 * la raíz del panel (`/admin`, Dashboard). A diferencia del resto de rutas,
 * `/admin` no debe coincidir por prefijo, ya que `/admin/` es prefijo de
 * absolutamente todas las demás rutas del admin (`/admin/productos`,
 * `/admin/cotizaciones`, etc.), lo que provocaría que el Dashboard (y por lo
 * tanto el tab "Más") se marque como activo en casi cualquier página.
 */
export function isNavItemActiveInList(pathname: string, href: string): boolean {
  if (href === '/admin') {
    return pathname === '/admin';
  }
  return isNavItemActive(pathname, href);
}

const primaryItems = [
  { href: '/admin/cotizaciones', label: 'Cotizaciones', icon: FileText },
  { href: '/admin/prospectos', label: 'Pedidos', icon: ShoppingCart },
  { href: '/admin/productos', label: 'Productos', icon: Package },
  { href: '/admin/cuentas-corporativas', label: 'Cuentas', icon: Building2 },
];

const moreItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/biblioteca', label: 'Biblioteca', icon: Images },
  { href: '/admin/banners', label: 'Banners', icon: ImageIcon },
  { href: '/admin/marcas', label: 'Marcas', icon: Tag },
  { href: '/admin/tipos-producto', label: 'Tipos de Producto', icon: Shirt },
  { href: '/admin/atributos', label: 'Atributos y Tallas', icon: ListTree },
  { href: '/admin/colores', label: 'Colores', icon: Palette },
  { href: '/admin/sucursales', label: 'Sucursales', icon: Store },
  { href: '/admin/sets', label: 'Sets Corporativos', icon: Boxes },
  { href: '/admin/reglas', label: 'Motor de Reglas', icon: Settings2 },
  { href: '/admin/papelera', label: 'Papelera', icon: Trash2 },
  { href: '/admin/productividad', label: 'Productividad', icon: Gauge },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { href: '/admin/permisos', label: 'Permisos', icon: ShieldCheck },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
];

export function AdminBottomNav() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { loading, canRead } = usePermissions();

  // Fase 5 del plan RBAC: mismo criterio que AdminSidebar — ocultar por completo, no
  // deshabilitar, los módulos sin permiso `read`.
  const isVisible = (href: string) => {
    if (loading) return false;
    const module = resolveModuleForPath(href);
    return module ? canRead(module) : false;
  };
  const visiblePrimaryItems = primaryItems.filter((item) => isVisible(item.href));
  const visibleMoreItems = moreItems.filter((item) => isVisible(item.href));

  const isMoreActive = visibleMoreItems.some((item) => isNavItemActiveInList(pathname, item.href));

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#111111] border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
        aria-label="Navegación principal"
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${visiblePrimaryItems.length + 1}, minmax(0, 1fr))` }}>
          {visiblePrimaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 min-h-[44px] py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset',
                  isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-5 h-5" strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 min-h-[44px] py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset',
              isMoreActive ? 'text-white' : 'text-gray-400 hover:text-white'
            )}
            aria-haspopup="dialog"
            aria-expanded={isMoreOpen}
          >
            <Menu className="w-5 h-5" strokeWidth={1.5} />
            Más
          </button>
        </div>
      </nav>

      <Drawer open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <DrawerContent className="md:hidden bg-[#111111] text-white border-white/10">
          <DrawerHeader>
            <DrawerTitle className="text-white">Más módulos</DrawerTitle>
          </DrawerHeader>
          <div className="grid grid-cols-3 gap-2 p-4 pt-0">
            {visibleMoreItems.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActiveInList(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMoreOpen(false)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 min-h-[44px] rounded-lg p-3 text-center text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                    isActive
                      ? 'bg-white text-[#111111]'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={async () => {
                setIsMoreOpen(false);
                await signOut({ redirect: false });
                window.location.href = '/admin/login';
              }}
              className="flex flex-col items-center justify-center gap-2 min-h-[44px] rounded-lg p-3 text-center text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <LogOut className="w-5 h-5" strokeWidth={1.5} />
              Cerrar sesión
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

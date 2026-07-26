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
import { FileText, ShoppingCart, Package, Building2, LogOut, Menu } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotifications } from '@/hooks/useNotifications';
import { resolveModuleForPath } from '@/lib/permissions/route-map';
import { isNavItemActive, isNavItemActiveInList } from '@/lib/nav-active';
import { ADMIN_NAV, type AdminNavItem } from '@/lib/admin-nav';

export { isNavItemActive, isNavItemActiveInList };

const primaryItems = [
  { href: '/admin/cotizaciones', label: 'Cotizaciones', icon: FileText },
  { href: '/admin/prospectos', label: 'Pedidos', icon: ShoppingCart },
  { href: '/admin/productos', label: 'Productos', icon: Package },
  { href: '/admin/cuentas-corporativas', label: 'Cuentas', icon: Building2 },
];

function filterVisibleItems(items: AdminNavItem[], canRead: (module: string) => boolean): AdminNavItem[] {
  return items.filter((item) => {
    const module = resolveModuleForPath(item.href);
    return module ? canRead(module) : false;
  });
}

/** Grupos con sus ítems filtrados por permiso — mismo criterio recursivo que `AdminSidebar`,
 * aplanando subGroups (el drawer "Más" no anida secciones, a diferencia del sidebar). */
function getVisibleSections(canRead: (module: string) => boolean): Array<{ label: string; items: AdminNavItem[] }> {
  const sections: Array<{ label: string; items: AdminNavItem[] }> = [];
  for (const group of ADMIN_NAV) {
    if (group.label === null) {
      // Dashboard suelto — se muestra como su propia "sección" sin encabezado en el drawer.
      const items = filterVisibleItems(group.items, canRead);
      if (items.length > 0) sections.push({ label: '', items });
      continue;
    }
    const items = filterVisibleItems(group.items, canRead);
    const subItems = (group.subGroups ?? []).flatMap((sg) => filterVisibleItems(sg.items, canRead));
    const allItems = [...items, ...subItems];
    if (allItems.length > 0) sections.push({ label: group.label, items: allItems });
  }
  return sections;
}

export function AdminBottomNav() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { loading, canRead } = usePermissions();
  const { unreadCount } = useNotifications();

  // Fase 5 del plan RBAC: mismo criterio que AdminSidebar — ocultar por completo, no
  // deshabilitar, los módulos sin permiso `read`.
  const isVisible = (href: string) => {
    if (loading) return false;
    const module = resolveModuleForPath(href);
    return module ? canRead(module) : false;
  };
  const visiblePrimaryItems = primaryItems.filter((item) => isVisible(item.href));
  const sections: Array<{ label: string; items: AdminNavItem[] }> = loading ? [] : getVisibleSections(canRead);
  const allMoreItems = sections.flatMap((s) => s.items);

  const isMoreActive = allMoreItems.some((item) => isNavItemActiveInList(pathname, item.href));

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
        <DrawerContent className="md:hidden bg-[#111111] text-white border-white/10 max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="text-white">Más módulos</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto p-4 pt-0 space-y-4">
            {sections.map((section, sIndex) => (
              <div key={`${section.label}-${sIndex}`}>
                {section.label && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 px-1">{section.label}</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {section.items.map((item, iIndex) => {
                    const Icon = item.icon;
                    const isActive = isNavItemActiveInList(pathname, item.href);
                    return (
                      <Link
                        key={`${item.href}-${iIndex}`}
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
                        <span className="relative">
                          <Icon className="w-5 h-5" strokeWidth={1.5} />
                          {item.href === '/admin/tareas' && unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1.5 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] px-0.5">
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                          )}
                        </span>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={async () => {
                setIsMoreOpen(false);
                await signOut({ redirect: false });
                window.location.href = '/admin/login';
              }}
              className="flex items-center justify-center gap-2 min-h-[44px] w-full rounded-lg p-3 text-center text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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

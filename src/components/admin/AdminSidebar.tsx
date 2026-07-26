'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LogOut, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotifications } from '@/hooks/useNotifications';
import { resolveModuleForPath } from '@/lib/permissions/route-map';
import { isNavItemActiveInList } from '@/lib/nav-active';
import { ADMIN_NAV, type AdminNavGroup, type AdminNavItem } from '@/lib/admin-nav';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

function filterVisibleItems(items: AdminNavItem[], canRead: (module: string) => boolean): AdminNavItem[] {
  return items.filter((item) => {
    const module = resolveModuleForPath(item.href);
    return module ? canRead(module) : false;
  });
}

/** Filtra recursivamente un grupo — se descarta por completo (separador incluido) si queda
 * sin ítems visibles ni subgrupos con ítems visibles (Fase 5 del plan RBAC: ocultar, no
 * deshabilitar). */
function filterVisibleGroup(group: AdminNavGroup, canRead: (module: string) => boolean): AdminNavGroup | null {
  const items = filterVisibleItems(group.items, canRead);
  const subGroups = (group.subGroups ?? [])
    .map((sg) => filterVisibleGroup(sg, canRead))
    .filter((sg): sg is AdminNavGroup => sg !== null);
  if (items.length === 0 && subGroups.length === 0) return null;
  return { ...group, items, subGroups: subGroups.length > 0 ? subGroups : undefined };
}

/** Determina qué grupo (por id) debe abrirse por defecto en un nivel de navegación — el
 * primero cuyo `collapsedByDefault` no esté marcado, o `null` si todos empiezan colapsados. */
function defaultOpenId(groups: AdminNavGroup[]): string | null {
  return groups.find((g) => !g.collapsedByDefault)?.id ?? null;
}

export function AdminSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('admin_sidebar_collapsed') === 'true';
  });
  const { loading, canRead } = usePermissions();
  const { unreadCount } = useNotifications();

  const visibleGroups = loading
    ? []
    : ADMIN_NAV.map((g) => filterVisibleGroup(g, canRead)).filter((g): g is AdminNavGroup => g !== null);

  // Acordeón: solo un grupo de nivel raíz puede estar expandido a la vez — al abrir uno se
  // cierran los demás. Persistido en localStorage para recordar la sección abierta.
  const [openGroupId, setOpenGroupId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return defaultOpenId(visibleGroups);
    const stored = window.localStorage.getItem('admin_nav_open_group');
    return stored !== null ? (stored || null) : defaultOpenId(visibleGroups);
  });

  function handleGroupOpenChange(groupId: string, open: boolean) {
    const next = open ? groupId : null;
    setOpenGroupId(next);
    localStorage.setItem('admin_nav_open_group', next ?? '');
  }

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('admin_sidebar_collapsed', String(next));
  };

  function renderItem(item: AdminNavItem, index: number) {
    const Icon = item.icon;
    const isActive = isNavItemActiveInList(pathname, item.href);
    return (
      <div key={`${item.href}-${index}`} className="relative group">
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
          {item.href === '/admin/tareas' && unreadCount > 0 && (
            <span className={cn(
              'flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1',
              isCollapsed ? 'absolute top-1 right-1' : 'ml-auto'
            )}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        {isCollapsed && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-black text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 delay-75 whitespace-nowrap z-50 shadow-md border border-white/10 flex items-center">
            {item.label}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-black" />
          </div>
        )}
      </div>
    );
  }

  function renderGroup(group: AdminNavGroup) {
    // Ítems sueltos (label null, ej. Dashboard) se renderizan sin separador ni collapsible.
    if (group.label === null) {
      return <div key={group.id}>{group.items.map(renderItem)}</div>;
    }

    // El sidebar colapsado (modo íconos) ignora la agrupación visual — separadores/labels de
    // texto no caben en 64px; se listan los ítems planos, igual que antes.
    if (isCollapsed) {
      return (
        <div key={group.id}>
          {group.items.map(renderItem)}
          {group.subGroups?.map((sg) => sg.items.map(renderItem))}
        </div>
      );
    }

    return (
      <NavSection
        key={group.id}
        group={group}
        renderItem={renderItem}
        open={openGroupId === group.id}
        onOpenChange={(open) => handleGroupOpenChange(group.id, open)}
      />
    );
  }

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
        {visibleGroups.map(renderGroup)}
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

/** Sección con separador + label + toggle colapsable. El nivel raíz recibe `open`/
 * `onOpenChange` controlados desde `AdminSidebar` (acordeón: solo un grupo raíz abierto a la
 * vez). Los subgrupos anidados (ej. "Propiedades Catálogo" dentro de "Catálogo") mantienen su
 * propio estado independiente, persistido en localStorage — no forman acordeón entre sí
 * porque hoy ningún grupo tiene más de un subgrupo. */
function NavSection({ group, renderItem, open, onOpenChange }: {
  group: AdminNavGroup;
  renderItem: (item: AdminNavItem, index: number) => React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="pt-2">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-300 transition-colors">
        <span>{group.label}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open ? '' : '-rotate-90')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 mt-1">
        {group.items.map(renderItem)}
        {group.subGroups?.map((sg) => (
          <NavSubSection key={sg.id} group={sg} renderItem={renderItem} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Subgrupo anidado (ej. "Propiedades Catálogo") — estado propio, persistido en localStorage,
 * independiente del acordeón de nivel raíz. */
function NavSubSection({ group, renderItem }: {
  group: AdminNavGroup;
  renderItem: (item: AdminNavItem, index: number) => React.ReactNode;
}) {
  const storageKey = `admin_nav_group_${group.id}`;
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return !group.collapsedByDefault;
    const stored = window.localStorage.getItem(storageKey);
    return stored !== null ? stored === 'true' : !group.collapsedByDefault;
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    localStorage.setItem(storageKey, String(next));
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className="pt-2">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-300 transition-colors">
        <span>{group.label}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open ? '' : '-rotate-90')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 mt-1">
        {group.items.map(renderItem)}
      </CollapsibleContent>
    </Collapsible>
  );
}

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Package, Images, Boxes, Shirt, ListTree, Palette, Tag,
  FileText, ShoppingCart, Building2, Mail,
  Truck, Tags, MapPinned,
  MessageCircle, Instagram, Facebook, Music2,
  ClipboardList, Gauge, Users, ShieldCheck, Wallet,
  ImageIcon, Store, Settings2, Trash2, Settings,
} from 'lucide-react';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface AdminNavGroup {
  id: string;
  /** `null` = ítem(s) sueltos sin separador visible (ej. Dashboard). */
  label: string | null;
  collapsedByDefault?: boolean;
  items: AdminNavItem[];
  subGroups?: AdminNavGroup[];
}

/**
 * Estructura de navegación del admin (reorganización 2026-07-26) — única fuente de verdad
 * consumida por `AdminSidebar` (desktop) y `AdminBottomNav` (drawer "Más" en mobile), para no
 * mantener dos listas planas duplicadas como antes.
 *
 * "Despachos" y "Marketing" son secciones reservadas (sin funcionalidad real todavía) — sus
 * ítems enlazan a las páginas de visión ya construidas (Fase 9 del plan RBAC original) y
 * quedan colapsadas por defecto para no llamar la atención sobre módulos inexistentes.
 */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: 'dashboard',
    label: null,
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    id: 'catalogo',
    label: 'Catálogo',
    items: [
      { href: '/admin/productos', label: 'Productos', icon: Package },
      { href: '/admin/sets', label: 'Sets Corporativos', icon: Boxes },
      { href: '/admin/biblioteca', label: 'Biblioteca', icon: Images },
    ],
    subGroups: [
      {
        id: 'propiedades-catalogo',
        label: 'Propiedades Catálogo',
        collapsedByDefault: true,
        items: [
          { href: '/admin/tipos-producto', label: 'Tipos de Producto', icon: Shirt },
          { href: '/admin/atributos', label: 'Atributos y Tallas', icon: ListTree },
          { href: '/admin/colores', label: 'Colores', icon: Palette },
          { href: '/admin/marcas', label: 'Marcas', icon: Tag },
        ],
      },
    ],
  },
  {
    id: 'ventas',
    label: 'Ventas',
    items: [
      { href: '/admin/cotizaciones', label: 'Cotizaciones', icon: FileText },
      { href: '/admin/prospectos', label: 'Pedidos', icon: ShoppingCart },
      { href: '/admin/cuentas-corporativas', label: 'Cuentas Corporativas', icon: Building2 },
      { href: '/admin/correos', label: 'Resend Visor', icon: Mail },
    ],
  },
  {
    id: 'despachos',
    label: 'Despachos',
    collapsedByDefault: true,
    items: [
      { href: '/admin/vision-despacho', label: 'Pedidos - estados', icon: Truck },
      { href: '/admin/vision-despacho', label: 'Etiquetas de despacho', icon: Tags },
      { href: '/admin/vision-despacho', label: 'Tracking', icon: MapPinned },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    collapsedByDefault: true,
    items: [
      { href: '/admin/vision-marketing', label: 'WhatsApp', icon: MessageCircle },
      { href: '/admin/vision-marketing', label: 'Instagram', icon: Instagram },
      { href: '/admin/vision-marketing', label: 'Facebook', icon: Facebook },
      { href: '/admin/vision-marketing', label: 'TikTok', icon: Music2 },
      { href: '/admin/vision-marketing', label: 'Correo', icon: Mail },
    ],
  },
  {
    id: 'staff',
    label: 'Staff',
    items: [
      { href: '/admin/tareas', label: 'Tareas', icon: ClipboardList },
      { href: '/admin/productividad', label: 'Productividad', icon: Gauge },
      { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
      { href: '/admin/permisos', label: 'Permisos', icon: ShieldCheck },
      { href: '/admin/honorarios-staff', label: 'Honorarios Staff', icon: Wallet },
    ],
  },
  {
    id: 'ajustes-sitio',
    label: 'Ajustes del Sitio',
    items: [
      { href: '/admin/banners', label: 'Banners', icon: ImageIcon },
      { href: '/admin/sucursales', label: 'Sucursales', icon: Store },
      { href: '/admin/reglas', label: 'Motor de Reglas', icon: Settings2 },
      { href: '/admin/papelera', label: 'Papelera', icon: Trash2 },
      { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
    ],
  },
];

/** Aplana todos los grupos (incluidos subGroups) en una sola lista de ítems — usado para
 * construir vistas planas (ej. el drawer "Más" en mobile) sin duplicar el árbol a mano. */
export function flattenAdminNav(groups: AdminNavGroup[] = ADMIN_NAV): AdminNavItem[] {
  const items: AdminNavItem[] = [];
  for (const group of groups) {
    items.push(...group.items);
    if (group.subGroups) items.push(...flattenAdminNav(group.subGroups));
  }
  return items;
}

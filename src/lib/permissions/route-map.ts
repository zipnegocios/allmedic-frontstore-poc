/**
 * Mapa ruta → módulo, puro (sin `@/db` ni ninguna dependencia server-only) para poder
 * importarse tanto desde `@/lib/permissions` (servidor: `proxy.ts`, guards de rutas API)
 * como desde componentes cliente (Fase 5: `AdminSidebar`/`AdminBottomNav` vía
 * `usePermissions()`, que necesitan resolver el módulo de cada `href` sin arrastrar `pg`
 * al bundle del navegador).
 *
 * Calcado del inventario de Fase 0 (AdminSidebar/AdminBottomNav) + quote-config/
 * corporate-carts (endpoints activos sin ítem de menú).
 */
export const ROUTE_MODULE_MAP: Array<{ prefix: string; module: string }> = [
  // Coincidencia exacta — sin esta entrada, `/admin` (dashboard) no calzaba con ningún
  // prefijo de la lista y quedaba restringido por defecto a solo ADMIN (bug detectado
  // en Fase 5: CATALOG_MANAGER ya tenía `dashboard:read` sembrado desde Fase 1, pero
  // nunca se resolvía el módulo para poder usarlo).
  { prefix: '/admin', module: 'dashboard' },
  { prefix: '/admin/usuarios', module: 'usuarios' },
  { prefix: '/admin/permisos', module: 'permisos' },
  { prefix: '/admin/productividad', module: 'productividad' },
  { prefix: '/admin/productos', module: 'productos' },
  { prefix: '/admin/biblioteca', module: 'biblioteca' },
  { prefix: '/admin/prospectos', module: 'prospectos' },
  { prefix: '/admin/banners', module: 'banners' },
  { prefix: '/admin/marcas', module: 'marcas' },
  { prefix: '/admin/tipos-producto', module: 'tipos-producto' },
  { prefix: '/admin/atributos', module: 'atributos' },
  { prefix: '/admin/colores', module: 'colores' },
  { prefix: '/admin/sucursales', module: 'sucursales' },
  { prefix: '/admin/sets', module: 'sets' },
  { prefix: '/admin/cuentas-corporativas', module: 'cuentas-corporativas' },
  { prefix: '/admin/cotizaciones', module: 'cotizaciones' },
  { prefix: '/admin/reglas', module: 'reglas' },
  { prefix: '/admin/papelera', module: 'papelera' },
  { prefix: '/admin/configuracion', module: 'configuracion' },
  { prefix: '/admin/vision-despacho', module: '*' }, // solo ADMIN (Fase 9, ver plan)
  { prefix: '/admin/vision-marketing', module: '*' }, // solo ADMIN (Fase 9, ver plan)
  { prefix: '/api/admin/attribute-values', module: 'atributos' },
  { prefix: '/api/admin/attributes', module: 'atributos' },
  { prefix: '/api/admin/sizes', module: 'atributos' },
  { prefix: '/api/admin/banners', module: 'banners' },
  { prefix: '/api/admin/brands', module: 'marcas' },
  { prefix: '/api/admin/collections', module: 'marcas' },
  { prefix: '/api/admin/colors', module: 'colores' },
  { prefix: '/api/admin/corporate-accounts', module: 'cuentas-corporativas' },
  { prefix: '/api/admin/leads', module: 'prospectos' },
  { prefix: '/api/admin/media', module: 'biblioteca' },
  { prefix: '/api/admin/product-types', module: 'tipos-producto' },
  { prefix: '/api/admin/products', module: 'productos' },
  { prefix: '/api/admin/quote-config', module: 'quote-config' },
  { prefix: '/api/admin/quotes', module: 'cotizaciones' },
  { prefix: '/api/admin/rules', module: 'reglas' },
  { prefix: '/api/admin/sets', module: 'sets' },
  { prefix: '/api/admin/stores', module: 'sucursales' },
  { prefix: '/api/admin/trash', module: 'papelera' },
  { prefix: '/api/admin/activity', module: 'productividad' },
  { prefix: '/api/admin/productivity', module: 'productividad' },
  { prefix: '/api/admin/users', module: 'usuarios' },
  { prefix: '/api/admin/permissions', module: 'permisos' },
  { prefix: '/admin/tareas', module: 'tareas' },
  { prefix: '/api/admin/tasks', module: 'tareas' },
  { prefix: '/api/admin/entity-comments', module: 'comentarios' },
  { prefix: '/admin/pagos', module: 'pagos' },
  { prefix: '/api/admin/payment-settings', module: 'pagos' },
  { prefix: '/api/admin/payment-tiers', module: 'pagos' },
  { prefix: '/api/admin/payment-periods', module: 'pagos' },
  { prefix: '/api/admin/email-events', module: 'configuracion' },
  { prefix: '/admin/correos', module: 'correos' },
  { prefix: '/api/admin/email-log', module: 'correos' },
  { prefix: '/api/admin/email-webhook-events', module: 'correos' },
  // Nota: /api/admin/users/[id]/payment-tier queda cubierto por el prefijo /api/admin/users
  // (módulo `usuarios`, línea de arriba) — el handler exige `pagos:write` explícito además,
  // mismo criterio de doble capa que /api/admin/tasks/[id]/comments (Fase 4).
];

export function resolveModuleForPath(pathname: string): string | null {
  // Más largo primero: evita que un prefijo corto (ej. /admin/sets) capture
  // por error una ruta más específica que debería mapear a otro módulo.
  const sorted = [...ROUTE_MODULE_MAP].sort((a, b) => b.prefix.length - a.prefix.length);
  const match = sorted.find((entry) => pathname.startsWith(entry.prefix));
  return match?.module ?? null;
}

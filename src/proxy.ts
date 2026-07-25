import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth-config';
import { hasPermission, resolveModuleForPath } from '@/lib/permissions';

const { auth } = NextAuth(authConfig);

export default auth(async (req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth?.user;
  const isAdminRoute = nextUrl.pathname.startsWith('/admin') && !nextUrl.pathname.startsWith('/admin/login');
  const isApiAdminRoute = nextUrl.pathname.startsWith('/api/admin');

  if (isAdminRoute || isApiAdminRoute) {
    if (!isLoggedIn) {
      // Usuario no autenticado: redirigir a login sin error=forbidden
      if (isApiAdminRoute) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return Response.redirect(new URL('/admin/login', nextUrl));
    }

    const role = (req.auth?.user as { role?: string } | undefined)?.role;
    const module = resolveModuleForPath(nextUrl.pathname);
    // Rutas sin módulo mapeado (ej. /admin/vision-*, todavía sin permiso propio) quedan
    // reservadas a ADMIN — mismo criterio conservador que el gate binario anterior.
    const allowed = module && module !== '*'
      ? await hasPermission(role ?? '', module, 'read')
      : role === 'ADMIN';

    if (!allowed) {
      if (isApiAdminRoute) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      // Usuario autenticado pero sin permisos: mostrar error=forbidden
      return Response.redirect(new URL('/admin/login?error=forbidden', nextUrl));
    }
  }
});

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
  ],
};

import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth-config';
import { hasPermission, resolveModuleForPath, isSessionStillValid } from '@/lib/permissions';

const { auth } = NextAuth(authConfig);

const CHANGE_PASSWORD_PATH = '/admin/cambiar-password';

export default auth(async (req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth?.user;
  const isAdminRoute = nextUrl.pathname.startsWith('/admin') && !nextUrl.pathname.startsWith('/admin/login');
  const isApiAdminRoute = nextUrl.pathname.startsWith('/api/admin');
  const isChangePasswordRoute = nextUrl.pathname === CHANGE_PASSWORD_PATH
    || nextUrl.pathname === '/api/admin/change-password';
  // Endpoint base del que depende `usePermissions()` (y por lo tanto todo el filtrado de
  // navegación) — cualquier usuario autenticado debe poder consultar sus propios permisos,
  // sin exigir un permiso de módulo previo (sería circular: necesita esto para saber qué
  // puede ver). El propio handler ya solo devuelve los permisos de la sesión actual.
  const isMyPermissionsRoute = nextUrl.pathname === '/api/admin/my-permissions';
  // Notificaciones propias (Fase 8 del plan tareas/comentarios/pagos) — mismo criterio que
  // `my-permissions`: cualquier usuario autenticado consulta/marca sus propias
  // notificaciones sin depender de un permiso de módulo (no hay un módulo "notificaciones"
  // en la matriz, son un badge transversal a tareas/comentarios).
  const isNotificationsRoute = nextUrl.pathname.startsWith('/api/admin/notifications');

  if (isAdminRoute || isApiAdminRoute) {
    if (!isLoggedIn) {
      // Usuario no autenticado: redirigir a login sin error=forbidden
      if (isApiAdminRoute) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return Response.redirect(new URL('/admin/login', nextUrl));
    }

    const sessionUser = req.auth?.user as
      | { id?: string; role?: string; sessionVersion?: number; mustChangePassword?: boolean }
      | undefined;

    // Decisión 14 del plan RBAC: un cambio de rol o desactivación de ESTE usuario debe
    // cerrar su sesión casi de inmediato, sin esperar a que expire el JWT (30 días) —
    // se compara el sessionVersion que el JWT llevaba al login contra el valor vigente
    // en BD (a través de la caché versionada, no en cada request contra BD directo... la
    // consulta puntual aquí sí toca BD, pero es una sola fila por request, no el árbol
    // completo de permisos).
    if (sessionUser?.id && sessionUser.sessionVersion !== undefined) {
      const stillValid = await isSessionStillValid(sessionUser.id, sessionUser.sessionVersion);
      if (!stillValid) {
        if (isApiAdminRoute) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return Response.redirect(new URL('/admin/login?error=session_expired', nextUrl));
      }
    }

    // Pantalla obligatoria de cambio de contraseña en primer login (decisión 8 del plan) —
    // bloquea cualquier otra ruta admin hasta que la cambie, salvo la propia pantalla.
    if (sessionUser?.mustChangePassword && !isChangePasswordRoute && !isMyPermissionsRoute && !isNotificationsRoute) {
      if (isApiAdminRoute) {
        return Response.json({ error: 'PasswordChangeRequired' }, { status: 403 });
      }
      return Response.redirect(new URL(CHANGE_PASSWORD_PATH, nextUrl));
    }

    const role = sessionUser?.role;
    const module = resolveModuleForPath(nextUrl.pathname);
    // Rutas sin módulo mapeado (ej. /admin/vision-*, todavía sin permiso propio) quedan
    // reservadas a ADMIN — mismo criterio conservador que el gate binario anterior.
    const allowed = isChangePasswordRoute || isMyPermissionsRoute || isNotificationsRoute
      ? true
      : module && module !== '*'
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

import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth-config';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth?.user;
  const isAdminRoute = nextUrl.pathname.startsWith('/admin') && !nextUrl.pathname.startsWith('/admin/login');
  const isApiAdminRoute = nextUrl.pathname.startsWith('/api/admin');

  if (isAdminRoute || isApiAdminRoute) {
    if (!isLoggedIn) {
      // For API routes, return 401. For pages, let NextAuth handle redirect via pages config
      if (isApiAdminRoute) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // For page routes, returning a Response triggers the error page
      // But NextAuth v5 with pages.signIn config handles redirect automatically
      // when authorized() returns false. So we just return nothing here.
    }

    const role = (req.auth?.user as any)?.role;
    if (role !== 'CATALOG_MANAGER' && role !== 'ADMIN') {
      if (isApiAdminRoute) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      // Redirect forbidden users to login with error param
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

/**
 * Auth configuration that can be imported by the middleware.
 * This file must NOT import any Node.js-only modules (bcryptjs, pg, etc.)
 * because it runs in the Edge Runtime.
 */

import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },
  providers: [], // populated in auth.ts
  callbacks: {
    jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }: any) {
      if (token?.role) {
        session.user.role = token.role;
      }
      return session;
    },
    authorized({ auth, request }: any) {
      const { nextUrl } = request;
      const isLoggedIn = !!auth?.user;
      const isAdminRoute = nextUrl.pathname.startsWith('/admin') && !nextUrl.pathname.startsWith('/admin/login');
      const isApiAdminRoute = nextUrl.pathname.startsWith('/api/admin');

      if (isAdminRoute || isApiAdminRoute) {
        if (!isLoggedIn) return false;
        const role = auth?.user?.role;
        if (role !== 'CATALOG_MANAGER' && role !== 'ADMIN') return false;
      }

      return true;
    },
  },
};

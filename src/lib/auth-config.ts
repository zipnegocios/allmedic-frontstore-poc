/**
 * Auth configuration that can be imported by the middleware.
 * This file must NOT import any Node.js-only modules (bcryptjs, pg, etc.)
 * because it runs in the Edge Runtime.
 */

import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  trustHost: true,
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
        // Fase 3 del plan RBAC (decisión 14): el JWT lleva el sessionVersion vigente al
        // momento del login. `proxy.ts` lo compara contra el valor actual en BD (vía la
        // caché versionada de `@/lib/permissions`) para forzar cierre de sesión casi
        // inmediato si un Admin cambia el rol o desactiva a este usuario.
        token.sessionVersion = user.sessionVersion;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    session({ session, token }: any) {
      if (token?.role) {
        session.user.role = token.role;
      }
      if (token?.sub) {
        session.user.id = token.sub;
      }
      if (token?.sessionVersion !== undefined) {
        session.user.sessionVersion = token.sessionVersion;
      }
      if (token?.mustChangePassword !== undefined) {
        session.user.mustChangePassword = token.mustChangePassword;
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
        if (role !== 'CATALOG_MANAGER' && role !== 'ADMIN' && role !== 'SALES' && role !== 'DISPATCHER') return false;
      }

      return true;
    },
  },
};

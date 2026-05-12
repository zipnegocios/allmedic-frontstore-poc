import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db, getDbInstance } from '@/db';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Adapter } from '@auth/core/adapters';

// Lazy adapter: only create the DrizzleAdapter when first used
// This prevents build-time failures when DB env vars are not available
let _adapter: Adapter | null = null;
function getAdapter(): Adapter {
  if (!_adapter) {
    _adapter = DrizzleAdapter(getDbInstance());
  }
  return _adapter;
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: {
    createUser: (data) => getAdapter().createUser!(data),
    getUser: (id) => getAdapter().getUser!(id),
    getUserByEmail: (email) => getAdapter().getUserByEmail!(email),
    getUserByAccount: (account) => getAdapter().getUserByAccount!(account),
    updateUser: (data) => getAdapter().updateUser!(data),
    deleteUser: (id) => getAdapter().deleteUser!(id) as Promise<void>,
    linkAccount: (data) => getAdapter().linkAccount!(data),
    unlinkAccount: (data) => getAdapter().unlinkAccount!(data),
    createSession: (data) => getAdapter().createSession!(data),
    getSessionAndUser: (token) => getAdapter().getSessionAndUser!(token),
    updateSession: (data) => getAdapter().updateSession!(data),
    deleteSession: (token) => getAdapter().deleteSession!(token),
    createVerificationToken: (data) => getAdapter().createVerificationToken!(data),
    useVerificationToken: (data) => getAdapter().useVerificationToken!(data),
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .limit(1);

        if (!user.length || !user[0].password) return null;

        const valid = await compare(credentials.password as string, user[0].password);
        if (!valid) return null;

        return {
          id: user[0].id,
          email: user[0].email,
          name: user[0].name,
          role: user[0].role,
        };
      },
    }),
  ],
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
  },
});

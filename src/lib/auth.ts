import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db, getDbInstance } from '@/db';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Adapter } from '@auth/core/adapters';
import { authConfig } from './auth-config';

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
  ...authConfig,
  trustHost: true,
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
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Usuario o Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const identifier = credentials.email as string;
        const isEmail = identifier.includes('@');

        // Search by email or name (username)
        const userQuery = isEmail
          ? db.select().from(users).where(eq(users.email, identifier)).limit(1)
          : db.select().from(users).where(eq(users.name, identifier)).limit(1);

        const userResult = await userQuery;

        if (!userResult.length || !userResult[0].password) return null;

        const valid = await compare(credentials.password as string, userResult[0].password);
        if (!valid) return null;

        return {
          id: userResult[0].id,
          email: userResult[0].email,
          name: userResult[0].name,
          role: userResult[0].role,
        };
      },
    }),
  ],
});

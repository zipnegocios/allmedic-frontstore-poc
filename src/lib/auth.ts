import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/db';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: DrizzleAdapter(db),
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

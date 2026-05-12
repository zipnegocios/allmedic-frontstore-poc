import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth-config';

const { auth } = NextAuth(authConfig);

export default auth((_req) => {
  // The authorized callback in authConfig handles all the logic
  // This middleware just needs to exist for the matcher to work
  return;
});

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};

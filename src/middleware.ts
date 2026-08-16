import { jwtVerify } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'sd_session';

const AUTH_PAGES = ['/login', '/signup', '/verify-email', '/forgot-password', '/reset-password'];

const ROLE_PREFIXES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: '/admin', roles: ['ADMIN'] },
  { prefix: '/staff', roles: ['STAFF', 'ADMIN'] },
  { prefix: '/member', roles: ['MEMBER', 'STAFF', 'ADMIN'] },
];

function homeForRole(role: string) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'STAFF') return '/staff';
  return '/member';
}

/**
 * Edge middleware guarding every dashboard route.
 * It only verifies the signed session token — authorisation that needs the
 * database (deactivated accounts, role changes) is re-checked server-side in
 * `requireUser`, so a stale token can never grant real access.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  let role: string | null = null;
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? '');
      const { payload } = await jwtVerify(token, secret, { issuer: 'member-support-desk' });
      role = typeof payload.role === 'string' ? payload.role : null;
    } catch {
      role = null;
    }
  }

  // Signed-in users should not sit on the auth screens.
  if (role && AUTH_PAGES.some((page) => pathname === page)) {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  const guarded = ROLE_PREFIXES.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  );
  if (!guarded) return NextResponse.next();

  if (!role) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    const response = NextResponse.redirect(loginUrl);
    if (token) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (!guarded.roles.includes(role)) {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/staff/:path*',
    '/member/:path*',
    '/login',
    '/signup',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
  ],
};

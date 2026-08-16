import 'server-only';

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { Role } from '@prisma/client';

import { env } from './env';
import { ApiError } from './http';
import { prisma } from './prisma';

export const SESSION_COOKIE = 'sd_session';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
  avatarColor: string;
};

function secretKey() {
  return new TextEncoder().encode(env.authSecret);
}

// --- password hashing ------------------------------------------------------

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 11);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// --- OTP -------------------------------------------------------------------

/** Cryptographically-random 6-digit code, zero padded. */
export function generateOtp(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1_000_000).padStart(6, '0');
}

export async function hashOtp(code: string) {
  return bcrypt.hash(code, 8);
}

export async function verifyOtpHash(code: string, hash: string) {
  return bcrypt.compare(code, hash);
}

// --- session ---------------------------------------------------------------

export async function createSessionToken(user: {
  id: string;
  email: string;
  role: Role;
}): Promise<string> {
  const maxAgeSeconds = env.sessionDays * 24 * 60 * 60;
  return new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setIssuer('member-support-desk')
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secretKey());
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    maxAge: env.sessionDays * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

type TokenPayload = { sub: string; email: string; role: Role };

export async function readSessionToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: 'member-support-desk',
    });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ''),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves the signed-in user from the session cookie, re-reading the database
 * so role changes / deactivation take effect immediately.
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await readSessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      isActive: true,
      avatarColor: true,
    },
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
    avatarColor: user.avatarColor,
  };
}

/** Throws 401/403 unless a verified user with an allowed role is signed in. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw ApiError.unauthorized();
  if (!user.emailVerified) {
    throw new ApiError(403, 'Please verify your email address first.', 'email_unverified');
  }
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    throw ApiError.forbidden();
  }
  return user;
}

export function isStaff(role: Role) {
  return role === 'STAFF' || role === 'ADMIN';
}

/** Default landing route for a role. */
export function homeForRole(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'STAFF':
      return '/staff';
    default:
      return '/member';
  }
}

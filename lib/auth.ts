import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const COOKIE_NAME = 'dr_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET not set');
  return new TextEncoder().encode(s);
}

export interface SessionPayload {
  sub: string;
  handle: string;
  isSysAdmin: boolean;
  isScotparlMod: boolean;
  tier: string;
  plan: string; // 'free' | 'paid'
  customerAdminTenants: number[]; // tenant IDs where this user is CustomerAdmin
  topicOwnerTenants: number[];    // tenant IDs where this user owns at least one topic
}

export const hashPassword  = (pw: string)   => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, h: string) => bcrypt.compare(pw, h);

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateAccessCode(): string {
  const rand = () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `${rand()}${rand()}${rand()}${rand()}-${rand()}${rand()}${rand()}${rand()}-${rand()}${rand()}${rand()}${rand()}-${rand()}${rand()}${rand()}${rand()}`;
}

export const hashAccessCode   = (code: string) => bcrypt.hash(code.replace(/-/g, ''), 12);
export const verifyAccessCode = (code: string, hash: string) => bcrypt.compare(code.replace(/-/g, ''), hash);

export async function createToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(jwtSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return Promise.resolve(null);
  return verifyToken(token);
}

export function sessionCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

export function clearCookie() {
  return {
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

// ── WebAuthn challenge cookie ─────────────────────────────────

export const CHALLENGE_COOKIE = 'dr_chal';

export interface ChallengePayload {
  challenge: string;
  userId: string;
  userHandle?: string;
  email?: string;
  tier?: string;
  plan?: string;
  displayName?: string;
  bio?: string;
  inviteToken?: string;
}

export async function signChallengeToken(payload: ChallengePayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .sign(jwtSecret());
}

export async function verifyChallengeToken(token: string): Promise<ChallengePayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    return payload as unknown as ChallengePayload;
  } catch {
    return null;
  }
}

export function challengeCookie(token: string) {
  return {
    name: CHALLENGE_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 300,
    path: '/',
  };
}

export function clearChallengeCookie() {
  return {
    name: CHALLENGE_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  };
}

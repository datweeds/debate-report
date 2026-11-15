import crypto from 'crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import pool from './db';

// Access Keys — SysAdmin-issued keys that let a named recipient view specific
// debates read-only without an account (see db/migrations/036_access_keys.sql).
// The raw key lives only in the recipient's link and their browser cookie; the
// database stores its SHA-256 hash. Every request re-checks the key, so
// revoking or expiry cuts access off immediately.

export const ACCESS_KEY_COOKIE = 'dr_access_key';
export const DEFAULT_EXPIRY_DAYS = 30;

export type ActiveAccessKey = {
  id: string;
  label: string;
  expiresAt: string | null;
  resolutionIds: Set<string>;
};

export function generateAccessKey(): string {
  return crypto.randomBytes(24).toString('base64url'); // 192 bits
}

export function hashAccessKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** A valid (not revoked, not expired) key, or null. Also stamps last_used_at, at most every 5 minutes. */
export async function lookupAccessKey(raw: string): Promise<ActiveAccessKey | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(raw)) return null;
  const { rows: [key] } = await pool.query(
    `SELECT id, label, expires_at FROM access_keys
     WHERE key_hash = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`,
    [hashAccessKey(raw)],
  );
  if (!key) return null;
  const { rows } = await pool.query(
    'SELECT resolution_id FROM access_key_debates WHERE key_id = $1',
    [key.id],
  );
  await pool.query(
    `UPDATE access_keys SET last_used_at = now()
     WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < now() - interval '5 minutes')`,
    [key.id],
  );
  return {
    id: key.id,
    label: key.label,
    expiresAt: key.expires_at ? new Date(key.expires_at).toISOString() : null,
    resolutionIds: new Set(rows.map(r => r.resolution_id as string)),
  };
}

/** The access key held in this request's cookie, if valid. Cached per request. */
export const getAccessKeyFromCookies = cache(async (): Promise<ActiveAccessKey | null> => {
  try {
    const raw = (await cookies()).get(ACCESS_KEY_COOKIE)?.value;
    return raw ? await lookupAccessKey(raw) : null;
  } catch {
    return null; // outside a request scope
  }
});

export function accessKeyCookie(raw: string, expiresAt: string | null) {
  const maxAge = expiresAt
    ? Math.max(60, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
    : 60 * 60 * 24 * 365;
  return {
    name: ACCESS_KEY_COOKIE,
    value: raw,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  };
}

export function clearAccessKeyCookie() {
  return { ...accessKeyCookie('', null), maxAge: 0 };
}

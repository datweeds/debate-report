// Site-wide settings changed by a Sys Admin in the app (site_settings table).
// Cached for 30 seconds per server process. Server-only.

import pool from './db';

const cache = new Map<string, { at: number; value: unknown }>();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const c = cache.get(key);
  if (c && Date.now() - c.at < 30_000) return c.value as T;
  const { rows: [r] } = await pool.query('SELECT value FROM site_settings WHERE key = $1', [key]);
  const value = r ? (r.value as T) : fallback;
  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function setSetting(key: string, value: unknown, by: string | null): Promise<void> {
  await pool.query(
    `INSERT INTO site_settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, JSON.stringify(value), by]);
  cache.delete(key);
}

/**
 * Claim a once-only action, such as one alert email per day: true the first
 * time `stamp` is claimed for `key`, false after that. Safe across server
 * processes (a single atomic statement).
 */
export async function claimOnce(key: string, stamp: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO site_settings (key, value) VALUES ($1, to_jsonb($2::text))
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
     WHERE site_settings.value IS DISTINCT FROM EXCLUDED.value`, [key, stamp]);
  return rowCount === 1;
}

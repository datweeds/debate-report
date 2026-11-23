import pool from './db';
import type { AgeBand } from './ageBands';
export * from './ageBands';

/** A user's band; null for accounts made before bands existed (treated as adults). */
export async function ageBandOf(userId: string | null | undefined): Promise<AgeBand | null> {
  if (!userId) return null;
  const { rows: [u] } = await pool.query('SELECT age_band FROM users WHERE id::text = $1', [userId]);
  return (u?.age_band as AgeBand | null) ?? null;
}

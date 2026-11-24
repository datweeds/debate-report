// Areas (lib/areas): place search and Societies' Areas. Members' own areas are
// never sent here as such: "for my area" matching runs in the member's browser.
// Everything area-related is for adults only (age group 18+): 16 and 17-year-olds,
// and anyone whose age we don't know, get none of it. Server-only.
import pool from './db';
import type { SessionPayload } from './auth';

export const LEVEL_ORDER = ['town', 'city', 'state_county', 'country'] as const;   // most local first

/** Area features are for accounts in the 18+ age group only. */
export async function isAdult(session: SessionPayload | null): Promise<boolean> {
  if (!session) return false;
  const { rows: [u] } = await pool.query('SELECT age_band FROM users WHERE id = $1', [session.sub]);
  return u?.age_band === '18+';
}

export type AreaHit = { id: string; name: string; label: string; level: string; path: string; country: string;
  chain: { id: string; name: string; label: string; level: string; path: string }[] };

/** Places, counties, regions and countries whose name starts with the words typed. */
export async function searchAreas(q: string, limit = 10): Promise<AreaHit[]> {
  const t = q.trim().toLowerCase().slice(0, 80);
  if (t.length < 2) return [];
  const like = t.replace(/[\\%_]/g, m => '\\' + m) + '%';
  const { rows } = await pool.query(
    `SELECT id, name, label, level, path, country_code AS country FROM areas
     WHERE lower(name) LIKE $1 OR lower(ascii_name) LIKE $1
     ORDER BY (lower(name) = $2 OR lower(ascii_name) = $2) DESC,
              CASE level WHEN 'country' THEN 0 WHEN 'state_county' THEN 1 ELSE 2 END, population DESC, name
     LIMIT $3`, [like, t, Math.min(limit, 20)]);
  // Each hit's chain (country down to it), so a member can choose how precise to be
  const ids = [...new Set(rows.flatMap(r => r.path.split('/')))];
  const { rows: anc } = await pool.query('SELECT id, name, label, level, path FROM areas WHERE id = ANY($1)', [ids]);
  const byId = new Map(anc.map(a => [a.id, a]));
  return rows.map(r => ({ ...r, chain: r.path.split('/').map((i: string) => byId.get(i)).filter(Boolean) }));
}

/** One area, by id (for checking what an admin chose). */
export async function areaById(id: unknown) {
  if (typeof id !== 'string' || id.length > 40) return null;
  const { rows: [a] } = await pool.query('SELECT id, name, label, level, path FROM areas WHERE id = $1', [id]);
  return a ?? null;
}

/** Every listed Society with an Area that this adult may know of: id, path and level (for matching on the device). */
export async function societyAreaIndex(viewer: string) {
  const { rows } = await pool.query(
    `SELECT c.id, a.path, a.level FROM customers c JOIN areas a ON a.id = c.area_id
     WHERE (c.status = 'active' OR c.status IS NULL)
       AND (c.visibility <> 'invite'
            OR EXISTS (SELECT 1 FROM customer_members m WHERE m.customer_id = c.id AND m.user_id = $1)
            OR EXISTS (SELECT 1 FROM customer_roles r WHERE r.tenant_id = c.id AND r.user_id = $1 AND r.role = 'customer_admin'))`,
    [viewer]);
  return rows as { id: number; path: string; level: string }[];
}

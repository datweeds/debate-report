// Finding Societies: the ones a visitor may know exist. Public and Apply
// Societies are listed to everyone; Invite ones only to their members.
// Closed Societies are never listed. Server-only.
import pool from './db';
import { lastActivity, memberCounts } from './societyActivity';

export type SocietyCard = {
  id: number; name: string; slug: string | null; description: string | null;
  visibility: 'public' | 'apply' | 'invite'; isMember: boolean; topics: string[]; disabled: string[];
  members: number; lastActivity: string | null;
  area?: { label: string; level: string } | null;   // adults only
};

// Columns for a card; $1 is the viewer's id (or null)
const CARD = `c.id, c.name, c.subdomain AS slug, left(c.description, 400) AS description, c.visibility, c.topics,
  c.disabled_sections, c.area_id,
  (EXISTS (SELECT 1 FROM customer_members m WHERE m.customer_id = c.id AND m.user_id = $1)
   OR EXISTS (SELECT 1 FROM customer_roles r WHERE r.tenant_id = c.id AND r.user_id = $1 AND r.role = 'customer_admin')) AS is_member`;
const LISTED = `(c.status = 'active' OR c.status IS NULL)`;

type Row = { id: number; name: string; slug: string | null; description: string | null; visibility: SocietyCard['visibility'];
  topics: string[] | null; disabled_sections: string[] | null; is_member: boolean; area_id?: string | null; total?: string };
const card = (r: Row): SocietyCard => ({ id: r.id, name: r.name, slug: r.slug, description: r.description, visibility: r.visibility,
  isMember: r.is_member, topics: r.topics ?? [], disabled: r.disabled_sections ?? [], members: 0, lastActivity: null,
  area: r.area_id ? { label: r.area_id, level: '' } : null });

// Members and last activity, for a page of cards
// Area labels only for adults; nobody else learns a Society's Area
async function withStats(cards: SocietyCard[], adult = false): Promise<SocietyCard[]> {
  const ids = cards.map(c => c.id);
  const areaIds = adult ? cards.map(c => c.area?.label).filter((x): x is string => !!x) : [];
  const [members, active, areas] = await Promise.all([memberCounts(ids), lastActivity(ids),
    areaIds.length ? pool.query('SELECT id, label, level FROM areas WHERE id = ANY($1)', [areaIds]) : Promise.resolve({ rows: [] as { id: string; label: string; level: string }[] })]);
  const byArea = new Map(areas.rows.map(a => [a.id, a]));
  return cards.map(c => {
    const a = adult && c.area ? byArea.get(c.area.label) : undefined;
    return { ...c, members: members.get(c.id) ?? 0, lastActivity: active.get(c.id) ?? null, area: a ? { label: a.label, level: a.level } : null };
  });
}

/** How many Societies the visitor may know of in each topic. */
export async function topicCounts(viewer: string | null): Promise<Record<string, number>> {
  const { rows } = await pool.query(
    `SELECT t AS topic, count(*)::int AS n FROM (SELECT ${CARD} FROM customers c WHERE ${LISTED}) c, unnest(c.topics) t
     WHERE c.visibility <> 'invite' OR c.is_member GROUP BY 1`, [viewer]);
  return Object.fromEntries(rows.map(r => [r.topic, r.n]));
}

/** Search: by words in the name or description, a topic, and public or private. */
export async function browseSocieties(viewer: string | null, o: {
  q?: string; topic?: string | null; kind?: 'all' | 'public' | 'private'; offset?: number; limit?: number;
  ids?: number[] | null;   // only these, in this order (from area matching on the member's device)
  adult?: boolean;
}) {
  const q = (o.q ?? '').trim().slice(0, 100);
  const like = q ? `%${q.replace(/[\\%_]/g, m => '\\' + m)}%` : null;
  const prefix = q ? `${q.replace(/[\\%_]/g, m => '\\' + m)}%` : null;
  const limit = Math.min(Math.max(o.limit ?? 20, 1), 50), offset = Math.max(o.offset ?? 0, 0);
  const { rows } = await pool.query<Row>(
    `SELECT * FROM (SELECT ${CARD}, c.hero_text FROM customers c WHERE ${LISTED}) c
     WHERE (c.visibility <> 'invite' OR c.is_member)
       AND ($2 = 'all' OR ($2 = 'public' AND c.visibility = 'public') OR ($2 = 'private' AND c.visibility <> 'public'))
       AND ($3::text IS NULL OR $3 = ANY(c.topics))
       AND ($4::text IS NULL OR c.name ILIKE $4 OR c.description ILIKE $4 OR c.hero_text ILIKE $4)
       AND ($6::int[] IS NULL OR c.id = ANY($6))
     ORDER BY COALESCE(array_position($6, c.id), 0), (c.name ILIKE $5) DESC, c.is_member DESC, lower(c.name)
     LIMIT ${limit + 1} OFFSET ${offset}`,
    [viewer, o.kind ?? 'all', o.topic || null, like, prefix ?? '', o.ids ?? null],
  );
  return { societies: await withStats(rows.slice(0, limit).map(card), !!o.adult), more: rows.length > limit };
}

/**
 * For the home page: 4 public Societies at random, and 4 private ones: the
 * visitor's own first, then Apply ones at random. With the totals, for "browse all".
 */
export async function featuredSocieties(viewer: string | null, adult = false) {
  const [pub, priv, totals] = await Promise.all([
    pool.query<Row>(`SELECT ${CARD} FROM customers c WHERE ${LISTED} AND c.visibility = 'public' ORDER BY random() LIMIT 4`, [viewer]),
    pool.query<Row>(
      `SELECT * FROM (SELECT ${CARD} FROM customers c WHERE ${LISTED} AND c.visibility <> 'public') c
       WHERE c.is_member OR c.visibility = 'apply' ORDER BY c.is_member DESC, random() LIMIT 4`, [viewer]),
    pool.query(
      `SELECT count(*) FILTER (WHERE c.visibility = 'public')::int AS public,
              count(*) FILTER (WHERE c.visibility = 'apply' OR (c.visibility = 'invite' AND (
                EXISTS (SELECT 1 FROM customer_members m WHERE m.customer_id = c.id AND m.user_id = $1)
                OR EXISTS (SELECT 1 FROM customer_roles r WHERE r.tenant_id = c.id AND r.user_id = $1 AND r.role = 'customer_admin'))))::int AS private
       FROM customers c WHERE ${LISTED}`, [viewer]),
  ]);
  const [pubCards, privCards] = await Promise.all([withStats(pub.rows.map(card), adult), withStats(priv.rows.map(card), adult)]);
  return { public: pubCards, private: privCards, totals: totals.rows[0] as { public: number; private: number } };
}

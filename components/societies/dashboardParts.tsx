import Link from 'next/link';
// Building blocks of a Society's Debate dashboard (metrics, statement
// counts, the debates list), shared by the all-Societies overview and each
// Society's own page. Server-only.

import pool, { pq } from '@/lib/db';
import { STAT_LABEL } from '@/components/chamber/constants';
import { listableResolutionSql } from '@/lib/debateAccess';
import { openDeep } from '@/lib/societyCrypto';

const LOZENGE_TYPES = ['framework', 'claim', 'impact', 'rebuttal', 'warrant', 'evidence', 'turn'] as const;
export type LozengeCounts = Record<typeof LOZENGE_TYPES[number], number>;
export function emptyLozenges(): LozengeCounts {
  return Object.fromEntries(LOZENGE_TYPES.map(t => [t, 0])) as LozengeCounts;
}

// One Society's activity, counted for the Dashboard overview
const METRIC_KEYS = ['debatesPublic', 'debatesPrivate', 'votes', 'polls', 'discussions', 'documents', 'events', 'projects', 'principles', 'proposals', 'nspPrinciples'] as const;
export type Metrics = Record<typeof METRIC_KEYS[number], number>;
export function emptyMetrics(): Metrics {
  return Object.fromEntries(METRIC_KEYS.map(k => [k, 0])) as Metrics;
}
export function addMetrics(a: Metrics, b: Metrics): Metrics {
  return Object.fromEntries(METRIC_KEYS.map(k => [k, a[k] + b[k]])) as Metrics;
}

// Counts per Society, all-time or created since a date. Debates are split by
// their own visibility (Public, or Apply/Invite). ScotParl proposals and
// principles have their own tenant_id + RLS, so pq() (bypasses RLS) is used.
export async function getMetricsBySociety(since?: string): Promise<Map<number, Metrics>> {
  const bySociety = new Map<number, Metrics>();
  const ensure = (id: number) => {
    if (!bySociety.has(id)) bySociety.set(id, emptyMetrics());
    return bySociety.get(id)!;
  };
  const params = since ? [since] : [];
  const after = (col: string) => (since ? `AND ${col} >= $1` : '');
  const QUERIES: [keyof Metrics | 'debates', string, boolean?][] = [
    ['debates', `SELECT customer_id AS cid, (debate_visibility = 'public') AS pub, COUNT(*)::int AS n FROM statements
       WHERE stat_type = 'resolution' AND customer_id IS NOT NULL AND stat_status <> 'deleted' ${after('created_at')} GROUP BY 1, 2`],
    ['votes', `SELECT res.customer_id AS cid, COUNT(*)::int AS n FROM stat_votes sv JOIN statements st ON st.id = sv.statement_id
       JOIN statements res ON res.id = COALESCE(st.resolution_id, st.id) WHERE res.customer_id IS NOT NULL ${after('sv.created_at')} GROUP BY 1`],
    ['polls', `SELECT customer_id AS cid, COUNT(*)::int AS n FROM society_polls WHERE deleted_at IS NULL AND status <> 'draft' ${after('opened_at')} GROUP BY 1`],
    ['discussions', `SELECT customer_id AS cid, COUNT(*)::int AS n FROM discussion_threads WHERE deleted_at IS NULL ${after('created_at')} GROUP BY 1`],
    ['documents', `SELECT customer_id AS cid, COUNT(*)::int AS n FROM documents WHERE deleted_at IS NULL ${after('created_at')} GROUP BY 1`],
    ['events', `SELECT customer_id AS cid, COUNT(*)::int AS n FROM society_events WHERE deleted_at IS NULL ${after('created_at')} GROUP BY 1`],
    ['projects', `SELECT customer_id AS cid, COUNT(*)::int AS n FROM projects WHERE deleted_at IS NULL ${after('created_at')} GROUP BY 1`],
    ['principles', `SELECT v.customer_id AS cid, COUNT(*)::int AS n FROM society_principles p JOIN society_principle_versions v ON v.id = p.version_id
       WHERE v.is_current ${after('p.created_at')} GROUP BY 1`],
    ['proposals', `SELECT tenant_id AS cid, COUNT(*)::int AS n FROM proposals ${since ? 'WHERE updated_at >= $1' : ''} GROUP BY 1`, true],
    ['nspPrinciples', `SELECT nt.tenant_id AS cid, COUNT(np.*)::int AS n FROM nsp_principles np
       JOIN nsp_principle_sets nps ON nps.id = np.set_id JOIN nsp_topics nt ON nt.id = nps.topic_id
       ${since ? 'WHERE np.created_at >= $1' : ''} GROUP BY 1`, true],
  ];
  await Promise.all(QUERIES.map(async ([key, sql, rls]) => {
    try {
      const { rows } = await (rls ? pq(sql, params) : pool.query(sql, params));
      for (const r of rows) {
        if (r.cid == null) continue;
        if (key === 'debates') ensure(r.cid)[r.pub ? 'debatesPublic' : 'debatesPrivate'] += r.n;
        else ensure(r.cid)[key] = r.n;
      }
    } catch (err) { console.error(`[getMetricsBySociety:${key}]`, err); }
  }));
  return bySociety;
}

export async function getLozengesBySociety(): Promise<Map<number, LozengeCounts>> {
  const bySociety = new Map<number, LozengeCounts>();
  try {
    const { rows } = await pool.query<{ customer_id: number; stat_type: string; n: number }>(`
      SELECT res.customer_id, s.stat_type, COUNT(*)::int AS n
      FROM statements s
      JOIN statements res ON res.id = s.resolution_id
      WHERE s.stat_type IN ('framework','claim','warrant','evidence','impact','rebuttal','turn')
        AND s.retracted_at IS NULL
        AND res.stat_status = 'active'
        AND res.customer_id IS NOT NULL
      GROUP BY res.customer_id, s.stat_type
    `);
    for (const r of rows) {
      if (!bySociety.has(r.customer_id)) bySociety.set(r.customer_id, emptyLozenges());
      const l = bySociety.get(r.customer_id)!;
      if (r.stat_type in l) l[r.stat_type as keyof LozengeCounts] = r.n;
    }
  } catch (err) { console.error('[getLozengesBySociety]', err); }
  return bySociety;
}

export async function getLawsTotal(since?: string): Promise<number> {
  try {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM sp_bills ${since ? 'WHERE created_at >= $1' : ''}`, since ? [since] : []);
    return rows[0]?.n ?? 0;
  } catch (err) {
    console.error('[getLawsTotal]', err);
    return 0;
  }
}

export type SocietyDebate = { id: string; stat_title: string; vote_for: number; vote_against: number; child_count: number };

// For a single society's own dashboard — "select a debate to view". Only
// debates this viewer may see listed (Invite debates stay hidden from all but
// their invitees and staff).
export async function getSocietyDebates(customerId: number, userId: string | null, isSysAdmin: boolean): Promise<SocietyDebate[]> {
  try {
    const { rows } = await pool.query<SocietyDebate>(
      `SELECT s.id, s.stat_title, s.vote_for, s.vote_against,
              COUNT(ch.id)::int AS child_count
       FROM statements s
       LEFT JOIN statements ch ON ch.resolution_id = s.id
       WHERE s.stat_type = 'resolution' AND s.customer_id = $1 AND s.stat_hidden IS NOT TRUE
         ${isSysAdmin ? '' : `AND ${listableResolutionSql('s', '$2::text')}`}
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      isSysAdmin ? [customerId] : [customerId, userId]
    );
    return openDeep(rows);
  } catch (err) {
    console.error('[getSocietyDebates]', err);
    return [];
  }
}

const LOZENGE_STYLE: Record<typeof LOZENGE_TYPES[number], string> = {
  framework: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  claim:     'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  warrant:   'bg-violet-500/10 text-violet-300 border-violet-500/30',
  evidence:  'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  impact:    'bg-orange-500/10 text-orange-300 border-orange-500/30',
  rebuttal:  'bg-rose-500/10 text-rose-300 border-rose-500/30',
  turn:      'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30',
};

export function MetricBox({ label, value, colour, bg }: { label: string; value: number; colour: string; bg: string }) {
  return (
    <div className={`rounded-xl border px-3 py-2 text-center ${bg}`}>
      <p className={`font-bold text-xl ${colour}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

export function Lozenges({ counts }: { counts: LozengeCounts }) {
  return (
    <div className="flex flex-wrap gap-2">
      {LOZENGE_TYPES.map(t => (
        <span key={t} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${LOZENGE_STYLE[t]}`}>
          <span className="font-bold">{counts[t]}</span>
          {STAT_LABEL[t] ?? t}
        </span>
      ))}
    </div>
  );
}

export function SocietySection({
  title, metrics, lozenges, isSysAdmin, highlight, societyId, slug,
}: {
  slug?: string | null;   // the Society's web-address name
  title: string;
  metrics: Metrics;
  lozenges: LozengeCounts | null;
  isSysAdmin: boolean;
  highlight?: boolean;
  societyId: number | 'all';
}) {
  const base = typeof societyId === 'number' ? `/society/${slug || societyId}` : null;
  const rows: { label: string; value: number; href?: string }[] = [
    { label: 'Public debates', value: metrics.debatesPublic, href: base ?? undefined },
    { label: 'Private debates', value: metrics.debatesPrivate, href: base ?? undefined },
    { label: 'Votes', value: metrics.votes },
    { label: 'Polls', value: metrics.polls, href: base ? `${base}/polls` : undefined },
    { label: 'Discussions', value: metrics.discussions, href: base ? `${base}/discussions` : undefined },
    { label: 'Documents', value: metrics.documents, href: base ? `${base}/documents` : undefined },
    { label: 'Events', value: metrics.events, href: base ? `${base}/events` : undefined },
    { label: 'Projects', value: metrics.projects, href: base ? `${base}/projects` : undefined },
    { label: 'Principles', value: metrics.principles, href: base ? `${base}/principles` : undefined },
    ...(isSysAdmin ? [{ label: 'ScotParl proposals', value: metrics.proposals }, { label: 'ScotParl principles', value: metrics.nspPrinciples }] : []),
  ];
  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${highlight ? 'border-blue-800/40 bg-blue-500/5' : 'border-slate-800 bg-dr-card'}`}>
      {base ? <Link href={`${base}/about`} className="text-sm font-semibold text-slate-200 hover:text-blue-300">{title}</Link>
        : <p className="text-sm font-semibold text-slate-200">{title}</p>}
      <ul className="grid gap-x-6 sm:grid-cols-2">
        {rows.map(r => {
          const line = (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{r.label}</span>
              <span className="tabular-nums text-slate-100">{r.value}</span>
            </>
          );
          return (
            <li key={r.label} className="border-b border-slate-700/30">
              {r.href ? <Link href={r.href} className="flex items-baseline justify-between gap-3 py-1 text-sm hover:text-blue-300">{line}</Link>
                : <span className="flex items-baseline justify-between gap-3 py-1 text-sm">{line}</span>}
            </li>
          );
        })}
      </ul>
      {lozenges && <Lozenges counts={lozenges} />}
    </div>
  );
}


// One Society's debate totals, counting only the debates this viewer may see
// (so a private debate's size isn't revealed to visitors). Also how many
// debates exist that the viewer can't see.
export async function getVisibleSocietyTotals(customerId: number, userId: string | null, sysAdminSeesAll: boolean) {
  const visible = sysAdminSeesAll ? 'TRUE' : listableResolutionSql('res', '$2::text');
  const params = [customerId, userId];
  const metrics = { debates: 0, votes: 0 };
  const lozenges = emptyLozenges();
  let hidden = 0;
  try {
    const [{ rows: [d] }, { rows: [v] }, { rows: l }] = await Promise.all([
      pool.query(
        // (for logged-out visitors the visibility test is NULL, not false: count hidden as total minus visible)
        `SELECT count(*) FILTER (WHERE COALESCE((${visible}), false))::int AS visible, (count(*) - count(*) FILTER (WHERE COALESCE((${visible}), false)))::int AS hidden
         FROM statements res WHERE res.stat_type = 'resolution' AND res.customer_id = $1 AND res.stat_hidden IS NOT TRUE
           AND COALESCE($2::text, '') = COALESCE($2::text, '')`, params),
      pool.query(
        `SELECT count(*)::int AS n FROM stat_votes sv JOIN statements st ON st.id = sv.statement_id
         JOIN statements res ON res.id = COALESCE(st.resolution_id, st.id)
         WHERE res.customer_id = $1 AND ${visible} AND COALESCE($2::text, '') = COALESCE($2::text, '')`, params),
      pool.query(
        `SELECT s.stat_type, count(*)::int AS n FROM statements s JOIN statements res ON res.id = s.resolution_id
         WHERE s.stat_type IN ('framework','claim','warrant','evidence','impact','rebuttal','turn') AND s.retracted_at IS NULL
           AND res.stat_status = 'active' AND res.customer_id = $1 AND ${visible} AND COALESCE($2::text, '') = COALESCE($2::text, '')
         GROUP BY s.stat_type`, params),
    ]);
    metrics.debates = d.visible; hidden = d.hidden; metrics.votes = v.n;
    for (const r of l) if (r.stat_type in lozenges) lozenges[r.stat_type as keyof LozengeCounts] = r.n;
  } catch (err) { console.error('[getVisibleSocietyTotals]', err); }
  return { metrics, lozenges, hidden };
}


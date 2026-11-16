// Building blocks of a Society's Debate & Vote dashboard (metrics, statement
// counts, the debates list), shared by the all-Societies overview and each
// Society's own page. Server-only.

import pool, { pq } from '@/lib/db';
import DebatesMetricButton from '@/components/scotparl/DebatesMetricButton';
import { STAT_LABEL } from '@/components/chamber/constants';
import { listableResolutionSql } from '@/lib/debateAccess';
import { openDeep } from '@/lib/societyCrypto';

const LOZENGE_TYPES = ['framework', 'claim', 'impact', 'rebuttal', 'warrant', 'evidence', 'turn'] as const;
export type LozengeCounts = Record<typeof LOZENGE_TYPES[number], number>;
export function emptyLozenges(): LozengeCounts {
  return Object.fromEntries(LOZENGE_TYPES.map(t => [t, 0])) as LozengeCounts;
}

export type Metrics = { debates: number; votes: number; proposals: number; principles: number };
export function emptyMetrics(): Metrics {
  return { debates: 0, votes: 0, proposals: 0, principles: 0 };
}
export function addMetrics(a: Metrics, b: Metrics): Metrics {
  return { debates: a.debates + b.debates, votes: a.votes + b.votes, proposals: a.proposals + b.proposals, principles: a.principles + b.principles };
}

// Debates/votes live directly on statements.customer_id (real attribution).
// Proposals/principles already have real tenant_id + RLS, so pq() (bypasses
// RLS) with an explicit GROUP BY tenant_id gets every society's count in one
// query rather than one tq() call per society.
export async function getMetricsBySociety(since?: string): Promise<Map<number, Metrics>> {
  const bySociety = new Map<number, Metrics>();
  const ensure = (id: number) => {
    if (!bySociety.has(id)) bySociety.set(id, emptyMetrics());
    return bySociety.get(id)!;
  };
  const params = since ? [since] : [];

  try {
    const { rows } = await pool.query(
      `SELECT customer_id, COUNT(*)::int AS n FROM statements
       WHERE stat_type = 'resolution' AND customer_id IS NOT NULL ${since ? 'AND created_at >= $1' : ''}
       GROUP BY customer_id`,
      params
    );
    for (const r of rows) ensure(r.customer_id).debates = r.n;
  } catch (err) { console.error('[getMetricsBySociety:debates]', err); }

  try {
    const { rows } = await pool.query(
      `SELECT res.customer_id, COUNT(*)::int AS n
       FROM stat_votes sv
       JOIN statements st  ON st.id = sv.statement_id
       JOIN statements res ON res.id = COALESCE(st.resolution_id, st.id)
       WHERE res.customer_id IS NOT NULL ${since ? 'AND sv.created_at >= $1' : ''}
       GROUP BY res.customer_id`,
      params
    );
    for (const r of rows) ensure(r.customer_id).votes = r.n;
  } catch (err) { console.error('[getMetricsBySociety:votes]', err); }

  try {
    const { rows } = await pq(
      `SELECT tenant_id, COUNT(*)::int AS n FROM proposals ${since ? 'WHERE updated_at >= $1' : ''} GROUP BY tenant_id`,
      params
    );
    for (const r of rows) ensure(r.tenant_id).proposals = r.n;
  } catch (err) { console.error('[getMetricsBySociety:proposals]', err); }

  try {
    const { rows } = await pq(
      `SELECT nt.tenant_id, COUNT(np.*)::int AS n
       FROM nsp_principles np
       JOIN nsp_principle_sets nps ON nps.id = np.set_id
       JOIN nsp_topics nt          ON nt.id  = nps.topic_id
       ${since ? 'WHERE np.created_at >= $1' : ''}
       GROUP BY nt.tenant_id`,
      params
    );
    for (const r of rows) ensure(r.tenant_id).principles = r.n;
  } catch (err) { console.error('[getMetricsBySociety:principles]', err); }

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
    <div className={`rounded-xl border px-3 py-3 text-center ${bg}`}>
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
  title, metrics, lozenges, isSysAdmin, highlight, societyId,
}: {
  title: string;
  metrics: Metrics;
  lozenges: LozengeCounts | null;
  isSysAdmin: boolean;
  highlight?: boolean;
  societyId: number | 'all';
}) {
  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${highlight ? 'border-blue-800/40 bg-blue-500/5' : 'border-slate-800 bg-[#0c1322]'}`}>
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <div className={`grid gap-2.5 ${isSysAdmin ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'} max-w-md`}>
        <DebatesMetricButton value={metrics.debates} societyId={societyId} />
        <MetricBox label="Votes" value={metrics.votes} colour="text-emerald-400" bg="border-emerald-800/30 bg-emerald-500/5" />
        {isSysAdmin && <MetricBox label="Proposals" value={metrics.proposals} colour="text-violet-400" bg="border-violet-800/30 bg-violet-500/5" />}
        {isSysAdmin && <MetricBox label="Principles" value={metrics.principles} colour="text-rose-400" bg="border-rose-800/30 bg-rose-500/5" />}
      </div>
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
  const metrics = emptyMetrics();
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

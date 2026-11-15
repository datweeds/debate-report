import Link from 'next/link';
import JoinSocietyButton from '@/components/societies/JoinSocietyButton';
import { getSocietyAccess } from '@/lib/societies';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import pool, { pq } from '@/lib/db';
import DateFilter from '@/components/scotparl/DateFilter';
import ActivityList from '@/components/scotparl/ActivityList';
import DebatesMetricButton from '@/components/scotparl/DebatesMetricButton';
import { getSession } from '@/lib/auth';
import { STAT_LABEL } from '@/components/chamber/constants';
import { viewableResolutionSql, listableResolutionSql } from '@/lib/debateAccess';

export const metadata: Metadata = { title: 'Scottish Parliament' };
export const dynamic = 'force-dynamic';

// Open-debate statement-type lozenges — one count per Public Forum argument
// type, across every resolution that isn't closed.
const LOZENGE_TYPES = ['framework', 'claim', 'impact', 'rebuttal', 'warrant', 'evidence', 'turn'] as const;
type LozengeCounts = Record<typeof LOZENGE_TYPES[number], number>;
function emptyLozenges(): LozengeCounts {
  return Object.fromEntries(LOZENGE_TYPES.map(t => [t, 0])) as LozengeCounts;
}

type Metrics = { debates: number; votes: number; proposals: number; principles: number };
function emptyMetrics(): Metrics {
  return { debates: 0, votes: 0, proposals: 0, principles: 0 };
}
function addMetrics(a: Metrics, b: Metrics): Metrics {
  return { debates: a.debates + b.debates, votes: a.votes + b.votes, proposals: a.proposals + b.proposals, principles: a.principles + b.principles };
}

type Society = {
  id: number; name: string; is_public: boolean; visibility: 'public' | 'apply' | 'invite'; is_default: boolean;
  hero_text: string | null; hero_image: string | null; description: string | null;
};

async function getSocieties(): Promise<Society[]> {
  const { rows } = await pool.query('SELECT id, name, is_public, visibility, is_default, hero_text, hero_image, description FROM customers ORDER BY is_default DESC, name');
  return rows;
}

// Debates/votes live directly on statements.customer_id (real attribution).
// Proposals/principles already have real tenant_id + RLS, so pq() (bypasses
// RLS) with an explicit GROUP BY tenant_id gets every society's count in one
// query rather than one tq() call per society.
async function getMetricsBySociety(since?: string): Promise<Map<number, Metrics>> {
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

async function getLozengesBySociety(): Promise<Map<number, LozengeCounts>> {
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

async function getLawsTotal(since?: string): Promise<number> {
  try {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM sp_bills ${since ? 'WHERE created_at >= $1' : ''}`, since ? [since] : []);
    return rows[0]?.n ?? 0;
  } catch (err) {
    console.error('[getLawsTotal]', err);
    return 0;
  }
}

type SocietyDebate = { id: string; stat_title: string; vote_for: number; vote_against: number; child_count: number };

// For a single society's own dashboard — "select a debate to view". Only
// debates this viewer may see listed (Invite debates stay hidden from all but
// their invitees and staff).
async function getSocietyDebates(customerId: number, userId: string | null, isSysAdmin: boolean): Promise<SocietyDebate[]> {
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
    return rows;
  } catch (err) {
    console.error('[getSocietyDebates]', err);
    return [];
  }
}

export type UpdateItem = {
  item_type: string;
  name: string;
  url: string;
  created_at: string;
  changed_at: string;
  entity_id: string;
};

// Item types that live on pages now hidden from non-sysadmin users — their
// activity shouldn't surface in a feed that links somewhere the viewer can't
// actually open.
const SYSADMIN_ONLY_ITEM_TYPES = ['Proposal', 'Bill', 'Act', 'SSI', 'Principle'];

async function getRecentUpdates(since: string | null, limit: number, isSysAdmin: boolean, userId: string | null): Promise<UpdateItem[]> {
  // Viewer id (for debate access) only when it's used — SysAdmin skips the
  // filter, and Postgres rejects unused parameters. Then `since`, if given.
  const params: unknown[] = isSysAdmin ? [] : [userId];
  if (since) params.push(since);
  const sinceClause = since ? `AND changed_at >= $${params.length}` : '';
  const limitClause = since ? '' : `LIMIT ${limit}`;
  const typeClause = isSysAdmin ? '' : `AND item_type NOT IN ('${SYSADMIN_ONLY_ITEM_TYPES.join("','")}')`;
  // Debate content only from debates this viewer may open.
  const canView = (res: string) => (isSysAdmin ? 'TRUE' : viewableResolutionSql(res, '$1::text'));
  try {
    const { rows } = await pool.query<UpdateItem>(`
      SELECT item_type, name, url, created_at, changed_at, entity_id FROM (
        SELECT 'Proposal'  AS item_type, title AS name,
               '/scotparl/proposals/' || id    AS url,
               created_at, updated_at           AS changed_at,
               id::text                         AS entity_id
        FROM proposals
        UNION ALL
        SELECT 'Debate', s.stat_title,
               '/scotparl/debates',
               sbd.created_at, sbd.created_at,
               sbd.resolution_id::text
        FROM sp_bill_debates sbd
        JOIN statements s ON s.id = sbd.resolution_id
        WHERE ${canView('s')}
        UNION ALL
        SELECT 'Debate', s.stat_title,
               '/scotparl/debates',
               spd.created_at, spd.created_at,
               spd.resolution_id::text
        FROM sp_proposal_debates spd
        JOIN statements s ON s.id = spd.resolution_id
        WHERE ${canView('s')}
        UNION ALL
        SELECT 'Vote', b.short_name,
               '/scotparl/bills/' || p.sp_bill_id,
               p.created_at, p.created_at,
               p.sp_bill_id::text
        FROM sp_bill_pvc_polls p
        JOIN sp_bills b ON b.id = p.sp_bill_id
        UNION ALL
        SELECT 'Bill', b.short_name,
               '/scotparl/bills/' || b.id,
               bs.stage_date, bs.stage_date,
               b.id::text
        FROM sp_bills b
        JOIN LATERAL (
          SELECT stage_date FROM sp_bill_stages
          WHERE bill_id = b.id ORDER BY stage_date DESC NULLS LAST LIMIT 1
        ) bs ON bs.stage_date IS NOT NULL
        UNION ALL
        SELECT 'Act', a.title,
               a.url,
               a.created_at, a.created_at,
               a.id::text
        FROM sp_acts a
        UNION ALL
        SELECT 'SSI', s.title,
               s.url,
               s.created_at, s.created_at,
               s.id::text
        FROM sp_ssis s
        UNION ALL
        SELECT 'Principle', np.title,
               '/scotparl/principles',
               np.created_at, np.created_at,
               np.id::text
        FROM nsp_principles np
        JOIN nsp_principle_sets nps ON nps.id = np.set_id
        JOIN nsp_topics nt          ON nt.id  = nps.topic_id
        UNION ALL
        SELECT INITCAP(s.stat_type::text), s.stat_title,
               '/chamber?resolution=' || s.resolution_id,
               s.created_at, s.updated_at,
               s.id::text
        FROM statements s
        JOIN statements res ON res.id = s.resolution_id
        WHERE s.stat_type <> 'resolution' AND s.retracted_at IS NULL
          AND ${canView('res')}
      ) t
      WHERE changed_at IS NOT NULL ${sinceClause} ${typeClause}
      ORDER BY changed_at DESC
      ${limitClause}
    `, params);
    return rows;
  } catch (err) {
    console.error('[getRecentUpdates]', err);
    return [];
  }
}

function parseSince(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : raw;
}

// Lozenge styling mirrors components/chamber/constants.ts's STAT_BADGE colours
// so a type reads the same here as it does inside the Chamber graph.
const LOZENGE_STYLE: Record<typeof LOZENGE_TYPES[number], string> = {
  framework: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  claim:     'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  warrant:   'bg-violet-500/10 text-violet-300 border-violet-500/30',
  evidence:  'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  impact:    'bg-orange-500/10 text-orange-300 border-orange-500/30',
  rebuttal:  'bg-rose-500/10 text-rose-300 border-rose-500/30',
  turn:      'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30',
};

function MetricBox({ label, value, colour, bg }: { label: string; value: number; colour: string; bg: string }) {
  return (
    <div className={`rounded-xl border px-3 py-3 text-center ${bg}`}>
      <p className={`font-bold text-xl ${colour}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function Lozenges({ counts }: { counts: LozengeCounts }) {
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

function SocietySection({
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

export default async function ScotparlPage({
  searchParams,
}: {
  searchParams: Promise<{ since?: string; society?: string }>;
}) {
  const [{ since: rawSince, society: rawSociety }, session] = await Promise.all([
    searchParams,
    getSession().catch(() => null),
  ]);
  const since = parseSince(rawSince);
  const isLoggedIn = !!session;
  const isSysAdmin = !!session?.isSysAdmin;
  const societyId = rawSociety ? parseInt(rawSociety, 10) : null;

  const [societies, metricsBySociety, sinceMetricsBySociety, lozengesBySociety, updates, lawsTotal] = await Promise.all([
    getSocieties(),
    getMetricsBySociety(),
    since ? getMetricsBySociety(since) : Promise.resolve(null),
    getLozengesBySociety(),
    getRecentUpdates(since, 15, isSysAdmin, session?.sub ?? null),
    isSysAdmin ? getLawsTotal() : Promise.resolve(0),
  ]);

  const sinceLabel = since
    ? new Date(since).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const publicSocieties = societies.filter(s => s.is_public);
  const privateSocieties = societies.filter(s => !s.is_public);

  // Clicking a society in the nav lands here — a dashboard scoped to just
  // that one, with its own debates to pick from, instead of the all-societies
  // overview below.
  const activeSociety = societyId && !isNaN(societyId) ? societies.find(s => s.id === societyId) : null;
  if (activeSociety) {
    // Invite Societies don't exist for non-members. Apply Societies show
    // non-members a teaser (name, image, description) and a join button.
    const access = await getSocietyAccess(session, activeSociety.id);
    if (!access?.canSeeTeaser) notFound();
    const { hero_text, hero_image, description } = activeSociety;
    const hasAside = !!(hero_image || description);
    const visibilityLabel = activeSociety.visibility === 'public' ? 'Public society'
      : activeSociety.visibility === 'apply' ? 'Private society · members only' : 'Private society · by invitation';

    if (!access.canEnter) {
      return (
        <div className="space-y-8">
          <div>
            <Link href="/scotparl" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← All societies</Link>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-100 mt-2">{activeSociety.name}</h1>
            {hero_text && <p className="text-lg text-slate-300 mt-2 max-w-3xl leading-relaxed">{hero_text}</p>}
            <p className="text-slate-500 mt-2 text-xs uppercase tracking-wider font-semibold">{visibilityLabel}</p>
          </div>
          <div className={hasAside ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] items-start' : ''}>
            <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-6 space-y-4">
              <p className="text-sm text-slate-300">
                This Society&apos;s debates are open to its members. Ask to join and a moderator will review your request.
              </p>
              <JoinSocietyButton societyId={activeSociety.id} loggedIn={!!session} pending={access.pendingRequest} />
            </div>
            {hasAside && (
              <aside className="space-y-4 order-first lg:order-none">
                {hero_image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hero_image} alt={activeSociety.name} className="w-full max-h-[28rem] rounded-2xl border border-slate-800 object-cover" />
                )}
                {description && (
                  <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-5">
                    <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-line">{description}</p>
                  </div>
                )}
              </aside>
            )}
          </div>
        </div>
      );
    }

    const debates = await getSocietyDebates(activeSociety.id, session?.sub ?? null, isSysAdmin);
    return (
      <div className="space-y-8">
        {/* Society name + hero text */}
        <div>
          <div className="flex items-center justify-between gap-4">
            <Link href="/scotparl" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← All societies</Link>
            {access.isModerator && (
              <Link href={`/dashboard/societies?society=${activeSociety.id}`} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Manage society →</Link>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-100 mt-2">{activeSociety.name}</h1>
          {hero_text && <p className="text-lg text-slate-300 mt-2 max-w-3xl leading-relaxed">{hero_text}</p>}
          <p className="text-slate-500 mt-2 text-xs uppercase tracking-wider font-semibold">{visibilityLabel}</p>
        </div>

        {/* Left: metrics + debates. Right: image, then description. */}
        <div className={hasAside ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] items-start' : ''}>
          <div className="space-y-8 min-w-0">
            <SocietySection
              title="Totals"
              metrics={metricsBySociety.get(activeSociety.id) ?? emptyMetrics()}
              lozenges={lozengesBySociety.get(activeSociety.id) ?? emptyLozenges()}
              isSysAdmin={isSysAdmin}
              societyId={activeSociety.id}
            />

            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Select a debate</p>
              {debates.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No debates in this society yet.</p>
              ) : (
                <div className="divide-y divide-slate-800/60 rounded-2xl border border-slate-800 bg-[#0c1322] overflow-hidden">
                  {debates.map(d => (
                    <Link
                      key={d.id}
                      href={`/chamber?resolution=${d.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-800/40 transition-colors"
                    >
                      <span className="text-sm text-slate-200">{d.stat_title}</span>
                      <span className="flex items-center gap-3 text-xs text-slate-500 flex-shrink-0">
                        <span className="text-emerald-500">{d.vote_for}↑</span>
                        <span className="text-rose-500">{d.vote_against}↓</span>
                        <span>{d.child_count} statements</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {hasAside && (
            <aside className="space-y-4 order-first lg:order-none">
              {hero_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hero_image}
                  alt={activeSociety.name}
                  className="w-full max-h-[28rem] rounded-2xl border border-slate-800 object-cover"
                />
              )}
              {description && (
                <div className="rounded-2xl border border-slate-800 bg-[#0c1322] p-5">
                  <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-line">{description}</p>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    );
  }

  const renderGroup = (metricsMap: Map<number, Metrics> | null, label: string) => (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {publicSocieties.map(s => (
          <SocietySection
            key={s.id}
            title={s.name}
            metrics={metricsMap?.get(s.id) ?? emptyMetrics()}
            lozenges={lozengesBySociety.get(s.id) ?? emptyLozenges()}
            isSysAdmin={isSysAdmin}
            societyId={s.id}
          />
        ))}
      </div>
      <SocietySection
        title="All Public Societies"
        metrics={publicSocieties.reduce((acc, s) => addMetrics(acc, metricsMap?.get(s.id) ?? emptyMetrics()), emptyMetrics())}
        lozenges={null}
        isSysAdmin={isSysAdmin}
        highlight
        societyId="all"
      />
      {isSysAdmin && privateSocieties.length > 0 && (
        <SocietySection
          title="All Private Societies"
          metrics={privateSocieties.reduce((acc, s) => addMetrics(acc, metricsMap?.get(s.id) ?? emptyMetrics()), emptyMetrics())}
          lozenges={null}
          isSysAdmin={isSysAdmin}
          societyId="all"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Overview</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Activity across debates and votes, by society.
          </p>
        </div>
        <DateFilter since={since ?? undefined} pathname="/scotparl" isLoggedIn={isLoggedIn} />
      </div>

      {renderGroup(metricsBySociety, 'Totals')}

      {isSysAdmin && (
        <div className="max-w-[160px]">
          <MetricBox label="Laws" value={lawsTotal} colour="text-amber-400" bg="border-amber-800/30 bg-amber-500/5" />
          <p className="text-[10px] text-slate-600 mt-1">Shared Scottish Parliament data — not society-specific</p>
        </div>
      )}

      {sinceMetricsBySociety && sinceLabel && renderGroup(sinceMetricsBySociety, `Changes since ${sinceLabel}`)}

      {/* Recent updates */}
      <ActivityList
        updates={updates}
        since={since}
        sinceLabel={sinceLabel}
        isLoggedIn={isLoggedIn}
      />

    </div>
  );
}

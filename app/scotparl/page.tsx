import Link from 'next/link';
import JoinSocietyButton from '@/components/societies/JoinSocietyButton';
import { getSocietyAccess } from '@/lib/societies';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import pool from '@/lib/db';
import DateFilter from '@/components/scotparl/DateFilter';
import ActivityList from '@/components/scotparl/ActivityList';
import { getSession } from '@/lib/auth';
import { viewableResolutionSql } from '@/lib/debateAccess';
import {
  emptyLozenges, emptyMetrics, addMetrics, getMetricsBySociety, getLozengesBySociety, getLawsTotal,
  MetricBox, SocietySection, type Metrics,
} from '@/components/societies/dashboardParts';

export const metadata: Metadata = { title: 'Scottish Parliament' };
export const dynamic = 'force-dynamic';

// Open-debate statement-type lozenges — one count per Public Forum argument
// type, across every resolution that isn't closed.
type Society = {
  id: number; name: string; is_public: boolean; visibility: 'public' | 'apply' | 'invite'; is_default: boolean;
  hero_text: string | null; hero_image: string | null; description: string | null;
};

async function getSocieties(): Promise<Society[]> {
  const { rows } = await pool.query('SELECT id, name, is_public, visibility, is_default, hero_text, hero_image, description FROM customers ORDER BY is_default DESC, name');
  return rows;
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

    // Members and moderators go to the Society's own page (wider, with its tabs)
    redirect(`/society/${activeSociety.id}`);
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

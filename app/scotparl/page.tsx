import Link from 'next/link';
import type { Metadata } from 'next';
import pool, { tq } from '@/lib/db';
import DateFilter from '@/components/scotparl/DateFilter';

export const metadata: Metadata = { title: 'Scottish Parliament' };
export const dynamic = 'force-dynamic';

type Counts = {
  proposals: number;
  debates: number;
  votes: number;
  bills: number;
  principles: number;
};

async function getTotals(): Promise<Counts> {
  try {
    const { rows: [r] } = await tq(`
      SELECT
        (SELECT COUNT(*)::int FROM proposals)                                                       AS proposals,
        (SELECT COUNT(*)::int FROM sp_bill_debates) +
          (SELECT COUNT(*)::int FROM sp_proposal_debates)                                           AS debates,
        (SELECT COUNT(*)::int FROM sp_bill_pvc_polls)                                              AS votes,
        (SELECT COUNT(*)::int FROM sp_bills)                                                       AS bills,
        (SELECT COUNT(np.*)::int FROM nsp_principles np
         JOIN nsp_principle_sets nps ON nps.id = np.set_id
         JOIN nsp_topics nt          ON nt.id  = nps.topic_id)                                     AS principles
    `);
    return r as Counts;
  } catch {
    return { proposals: 0, debates: 0, votes: 0, bills: 0, principles: 0 };
  }
}

async function getSinceCounts(since: string): Promise<Counts> {
  try {
    const { rows: [r] } = await tq(`
      SELECT
        (SELECT COUNT(*)::int FROM proposals       WHERE updated_at  >= $1)                        AS proposals,
        (SELECT COUNT(*)::int FROM sp_bill_debates WHERE created_at  >= $1) +
          (SELECT COUNT(*)::int FROM sp_proposal_debates WHERE created_at >= $1)                   AS debates,
        (SELECT COUNT(*)::int FROM sp_bill_pvc_polls WHERE created_at >= $1)                       AS votes,
        (SELECT COUNT(*)::int FROM sp_bills         WHERE created_at >= $1)                        AS bills,
        (SELECT COUNT(np.*)::int FROM nsp_principles np
         JOIN nsp_principle_sets nps ON nps.id = np.set_id
         JOIN nsp_topics nt          ON nt.id  = nps.topic_id
         WHERE np.created_at >= $1)                                                                 AS principles
    `, [since]);
    return r as Counts;
  } catch {
    return { proposals: 0, debates: 0, votes: 0, bills: 0, principles: 0 };
  }
}

type UpdateItem = {
  item_type: string;
  name: string;
  url: string;
  created_at: string;
  changed_at: string;
};

async function getRecentUpdates(since: string | null, limit: number): Promise<UpdateItem[]> {
  const sinceClause = since ? `AND changed_at >= '${since.replace(/'/g, "''")}'` : '';
  const limitClause = since ? '' : `LIMIT ${limit}`;
  try {
    const { rows } = await tq<UpdateItem>(`
      SELECT item_type, name, url, created_at, changed_at FROM (
        SELECT 'Proposal'  AS item_type, title AS name,
               '/scotparl/proposals/' || id    AS url,
               created_at, updated_at           AS changed_at
        FROM proposals
        UNION ALL
        SELECT 'Debate', s.stat_title,
               '/scotparl/debates',
               sbd.created_at, sbd.created_at
        FROM sp_bill_debates sbd
        JOIN statements s ON s.id = sbd.resolution_id
        UNION ALL
        SELECT 'Debate', s.stat_title,
               '/scotparl/debates',
               spd.created_at, spd.created_at
        FROM sp_proposal_debates spd
        JOIN statements s ON s.id = spd.resolution_id
        UNION ALL
        SELECT 'Vote', b.short_name,
               '/scotparl/bills/' || p.sp_bill_id,
               p.created_at, p.created_at
        FROM sp_bill_pvc_polls p
        JOIN sp_bills b ON b.id = p.sp_bill_id
        UNION ALL
        SELECT 'Bill', b.short_name,
               '/scotparl/bills/' || b.id,
               b.created_at, b.created_at
        FROM sp_bills b
        UNION ALL
        SELECT 'Principle', np.title,
               '/scotparl/principles',
               np.created_at, np.created_at
        FROM nsp_principles np
        JOIN nsp_principle_sets nps ON nps.id = np.set_id
        JOIN nsp_topics nt          ON nt.id  = nps.topic_id
      ) t
      WHERE changed_at IS NOT NULL ${sinceClause}
      ORDER BY changed_at DESC
      ${limitClause}
    `);
    return rows;
  } catch {
    return [];
  }
}

function fmt(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function parseSince(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : raw;
}

const TYPE_COLOURS: Record<string, string> = {
  Proposal:  'bg-violet-500/10 text-violet-300 border-violet-500/20',
  Debate:    'bg-blue-500/10   text-blue-300   border-blue-500/20',
  Vote:      'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  Bill:      'bg-amber-500/10  text-amber-300   border-amber-500/20',
  Principle: 'bg-rose-500/10   text-rose-300    border-rose-500/20',
};

const METRIC_CONFIG = [
  { key: 'proposals' as keyof Counts,  label: 'Proposals',  href: '/scotparl/proposals', colour: 'text-violet-400',  bg: 'border-violet-800/30 bg-violet-500/5' },
  { key: 'debates'   as keyof Counts,  label: 'Debates',    href: '/scotparl/debates',   colour: 'text-blue-400',    bg: 'border-blue-800/30   bg-blue-500/5'   },
  { key: 'votes'     as keyof Counts,  label: 'Votes',      href: '/scotparl/bills',     colour: 'text-emerald-400', bg: 'border-emerald-800/30 bg-emerald-500/5' },
  { key: 'bills'     as keyof Counts,  label: 'Bills',      href: '/scotparl/bills',     colour: 'text-amber-400',   bg: 'border-amber-800/30  bg-amber-500/5'  },
  { key: 'principles'as keyof Counts,  label: 'Principles', href: '/scotparl/principles',colour: 'text-rose-400',    bg: 'border-rose-800/30   bg-rose-500/5'   },
];

export default async function ScotparlPage({
  searchParams,
}: {
  searchParams: Promise<{ since?: string }>;
}) {
  const { since: rawSince } = await searchParams;
  const since = parseSince(rawSince);

  const [totals, sinceCounts, updates] = await Promise.all([
    getTotals(),
    since ? getSinceCounts(since) : Promise.resolve(null),
    getRecentUpdates(since, 15),
  ]);

  const sinceLabel = since
    ? new Date(since).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Overview</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Activity across bills, debates, proposals, and principles.
          </p>
        </div>
        <DateFilter since={since ?? undefined} pathname="/scotparl" />
      </div>

      {/* Totals row */}
      <div>
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Totals</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
          {METRIC_CONFIG.map(m => (
            <Link
              key={m.key}
              href={m.href}
              className={`rounded-xl border px-3 py-3.5 text-center hover:opacity-80 transition-opacity ${m.bg}`}
            >
              <p className={`font-bold text-xl ${m.colour}`}>{totals[m.key]}</p>
              <p className="text-xs text-slate-500 mt-0.5">{m.label}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Since row */}
      {sinceCounts && sinceLabel && (
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Changes since {sinceLabel}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
            {METRIC_CONFIG.map(m => (
              <Link
                key={m.key}
                href={`${m.href}?since=${since}`}
                className={`rounded-xl border px-3 py-3.5 text-center hover:opacity-80 transition-opacity ${m.bg}`}
              >
                <p className={`font-bold text-xl ${m.colour}`}>{sinceCounts[m.key]}</p>
                <p className="text-xs text-slate-500 mt-0.5">{m.label}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent updates */}
      {updates.length > 0 && (
        <div className="card-dr">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-slate-100">
              {since ? `All changes since ${sinceLabel}` : 'Recent Updates'}
            </h2>
            {!since && <span className="text-xs text-slate-600">15 most recent</span>}
          </div>
          <ul className="divide-y divide-slate-800/60">
            {updates.map((u, i) => (
              <li key={i}>
                <Link
                  href={u.url}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/40 transition-colors"
                >
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium border ${TYPE_COLOURS[u.item_type] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                    {u.item_type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-200 truncate">{u.name}</p>
                  </div>
                  <div className="flex-shrink-0 text-right hidden sm:block">
                    <p className="text-xs text-slate-600">Created {fmt(u.created_at)}</p>
                    {u.changed_at !== u.created_at && (
                      <p className="text-xs text-slate-500">Updated {fmt(u.changed_at)}</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}

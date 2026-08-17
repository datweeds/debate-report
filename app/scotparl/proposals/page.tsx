import type { Metadata } from 'next';
import Link from 'next/link';
import pool, { tq } from '@/lib/db';
import { getSession } from '@/lib/auth';
import TopicDropdown from '@/components/scotparl/TopicDropdown';
import FavButton from '@/components/scotparl/FavButton';

export const metadata: Metadata = { title: 'Proposals' };
export const dynamic = 'force-dynamic';

type Proposal = {
  id: number;
  title: string;
  status: string;
  proposer_id: string;
  proposer_handle: string;
  rejection_reason: string | null;
  topic_id: number | null;
  topic_name: string | null;
  created_at: Date;
  updated_at: Date;
  resolution_id: string | null;
  debate_status: string | null;
  debate_votes_for: number;
  debate_votes_against: number;
  debate_request_count: number;
  pvc_poll_id: string | null;
  impact_score: number | null;
  impact_count: number;
};

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    proposed: { label: 'Proposed', cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
    rejected: { label: 'Rejected', cls: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' },
    amended:  { label: 'Amended',  cls: 'bg-violet-500/10 text-violet-300 border border-violet-500/20' },
    accepted: { label: 'Accepted', cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-slate-500/10 text-slate-400' };
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold leading-none ${cls}`}>{label}</span>;
}

function ProposalRow({ p, mine, isFav }: { p: Proposal; mine: boolean; isFav: boolean }) {
  return (
    <div className="card-dr hover:border-blue-600/40 transition-colors">
      <div className="flex items-start gap-1">
        <Link
          href={`/scotparl/proposals/${p.id}`}
          className="flex-1 min-w-0 px-4 py-3"
        >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-100 truncate">{p.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {p.topic_name && <span className="text-blue-400/80">{p.topic_name}</span>}
            {p.topic_name && <span>·</span>}
            {!mine && <span>@{p.proposer_handle}</span>}
            {!mine && <span>·</span>}
            <span>{new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {p.resolution_id && p.debate_status === 'active' && (
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300 border border-blue-500/20">
                Open Debate
                {(p.debate_votes_for > 0 || p.debate_votes_against > 0) && (
                  <span className="font-normal text-blue-300/70">· {p.debate_votes_for}/{p.debate_votes_against}</span>
                )}
              </span>
            )}
            {p.resolution_id && p.debate_status !== 'active' && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-600/30">
                Debate
                {(p.debate_votes_for > 0 || p.debate_votes_against > 0) && (
                  <span className="font-normal">· {p.debate_votes_for}/{p.debate_votes_against}</span>
                )}
              </span>
            )}
            {!p.resolution_id && p.debate_request_count > 0 && (
              <span className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400/80 border border-amber-500/20">
                {p.debate_request_count} {p.debate_request_count === 1 ? 'request' : 'requests'}
              </span>
            )}
            {p.pvc_poll_id && (
              <span className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/20">
                Vote
              </span>
            )}
            {p.impact_count > 0 && p.impact_score !== null && (
              <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                p.impact_score >= 7 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                p.impact_score >= 5 ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                'bg-rose-500/10 text-rose-300 border-rose-500/20'
              }`}>
                Impact {p.impact_score.toFixed(1)}
              </span>
            )}
          </div>
          {p.rejection_reason && mine && (
            <p className="mt-1.5 text-[11px] text-rose-400/80 line-clamp-1">
              Rejected: {p.rejection_reason}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">{statusBadge(p.status)}</div>
      </div>
        </Link>
        <div className="flex items-start pt-3 pr-2">
          <FavButton endpoint={`/api/scotparl/proposals/${p.id}/favourite`} initialValue={isFav} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, proposals, mine = false, favIds }: { title: string; proposals: Proposal[]; mine?: boolean; favIds: Set<number> }) {
  if (!proposals.length) return null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      <div className="space-y-2">
        {proposals.map(p => <ProposalRow key={p.id} p={p} mine={mine} isFav={favIds.has(p.id)} />)}
      </div>
    </section>
  );
}

type Props = { searchParams?: Promise<{ topic_id?: string }> };

export default async function ProposalsPage({ searchParams }: Props) {
  const [session, sp] = await Promise.all([
    getSession().catch(() => null),
    searchParams,
  ]);

  const topicIdRaw = sp?.topic_id;
  const topicId = topicIdRaw ? parseInt(topicIdRaw, 10) : null;

  // Load topics for filter bar
  const { rows: topicRows } = await tq<{ id: number; name: string }>(
    `SELECT id, name FROM nsp_topics ORDER BY sort_order, name`
  );

  // Load strapline for selected topic (first non-null across owners)
  let strapline: string | null = null;
  if (topicId) {
    const { rows: [sl] } = await tq<{ strapline: string }>(
      `SELECT strapline FROM topic_owners
       WHERE topic_id = $1 AND strapline IS NOT NULL AND strapline <> ''
       ORDER BY created_at LIMIT 1`,
      [topicId]
    );
    strapline = sl?.strapline ?? null;
  }

  const baseSelect = `
    SELECT p.id, p.title, p.status, p.proposer_id, p.proposer_handle,
           p.rejection_reason, p.topic_id, p.created_at, p.updated_at,
           p.pvc_poll_id,
           nt.name AS topic_name,
           pd.resolution_id, pd.debate_status, pd.debate_votes_for, pd.debate_votes_against,
           (SELECT COUNT(*)::int FROM sp_debate_requests sdr
            WHERE sdr.entity_type = 'proposal' AND sdr.entity_id = p.id) AS debate_request_count,
           ia.impact_score, ia.impact_count
    FROM proposals p
    LEFT JOIN nsp_topics nt ON nt.id = p.topic_id
    LEFT JOIN LATERAL (
      SELECT spd.resolution_id, s.stat_status AS debate_status,
             s.vote_total_for AS debate_votes_for, s.vote_total_against AS debate_votes_against
      FROM sp_proposal_debates spd
      JOIN statements s ON s.id = spd.resolution_id
      WHERE spd.proposal_id = p.id
      ORDER BY spd.created_at DESC LIMIT 1
    ) pd ON true
    LEFT JOIN LATERAL (
      SELECT ROUND(MAX(overall_score)::numeric, 1)::float AS impact_score, COUNT(*)::int AS impact_count
      FROM society_impact_analyses
      WHERE entity_type = 'proposal' AND entity_id = p.id AND status = 'done'
        AND tenant_id = current_setting('app.tenant_id')::int
    ) ia ON true`;

  const topicFilter = topicId ? ` AND p.topic_id = ${topicId}` : '';

  let rows: Proposal[] = [];
  if (session?.isSysAdmin) {
    const { rows: r } = await tq<Proposal>(
      `${baseSelect}
       WHERE true${topicFilter}
       ORDER BY
         CASE p.status WHEN 'amended' THEN 1 WHEN 'proposed' THEN 2
           WHEN 'accepted' THEN 3 WHEN 'rejected' THEN 4 END,
         p.updated_at DESC`
    );
    rows = r;
  } else if (session) {
    const { rows: r } = await tq<Proposal>(
      `${baseSelect}
       WHERE (p.status = 'accepted' OR p.proposer_id = $1)${topicFilter}
       ORDER BY p.updated_at DESC`,
      [session.sub]
    );
    rows = r;
  } else {
    const { rows: r } = await tq<Proposal>(
      `${baseSelect}
       WHERE p.status = 'accepted'${topicFilter}
       ORDER BY p.created_at DESC`
    );
    rows = r;
  }

  const needsReview = rows.filter(p => p.status === 'proposed' || p.status === 'amended');
  const accepted    = rows.filter(p => p.status === 'accepted');
  const rejected    = rows.filter(p => p.status === 'rejected');
  const mine        = session && !session.isSysAdmin ? rows.filter(p => p.proposer_id === session.sub && p.status !== 'accepted') : [];

  const favIds = new Set<number>(
    session
      ? await pool.query<{ proposal_id: number }>(`SELECT proposal_id FROM proposal_favs WHERE user_id = $1`, [session.sub])
          .then(r => r.rows.map(r => r.proposal_id))
          .catch(() => [])
      : []
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Proposals</h1>
          <p className="mt-1 text-sm text-slate-400">
            Community proposals for New Society principles and debates
          </p>
        </div>
        {session ? (
          <Link
            href="/scotparl/proposals/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            + New Proposal
          </Link>
        ) : (
          <Link
            href="/register"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600/50 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-300"
          >
            Register to make a Proposal →
          </Link>
        )}
      </div>

      {/* Topic filter */}
      {topicRows.length > 0 && (
        <div className="mb-5">
          <TopicDropdown topics={topicRows} selectedId={topicId} basePath="/scotparl/proposals" />
        </div>
      )}

      {/* Strapline */}
      {strapline && (
        <div className="mb-5 rounded-xl border border-blue-800/30 bg-blue-500/5 px-4 py-3 text-sm text-blue-200/80 italic">
          {strapline}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card-dr px-6 py-10 text-center text-slate-500">
          <p>No proposals yet{topicId ? ' in this topic' : ''}.</p>
          {session && (
            <p className="mt-2 text-sm">
              <Link href="/scotparl/proposals/new" className="text-blue-400 hover:underline">Be the first to submit one.</Link>
            </p>
          )}
          {!session && (
            <p className="mt-2 text-sm">
              <Link href="/login" className="text-blue-400 hover:underline">Log in</Link> to submit a proposal.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {session?.isSysAdmin && (
            <>
              <Section title="Needs Review" proposals={needsReview} favIds={favIds} />
              <Section title="Accepted" proposals={accepted} favIds={favIds} />
              <Section title="Rejected" proposals={rejected} favIds={favIds} />
            </>
          )}
          {session && !session.isSysAdmin && (
            <>
              <Section title="Your Proposals" proposals={mine as Proposal[]} mine favIds={favIds} />
              <Section title="Accepted Proposals" proposals={accepted} favIds={favIds} />
            </>
          )}
          {!session && (
            <Section title="Accepted Proposals" proposals={accepted} favIds={new Set()} />
          )}
        </div>
      )}
    </div>
  );
}

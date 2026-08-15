import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import ProposalActions from '@/components/proposals/ProposalActions';
import DebateRequestSection, { type DebateRequest as DR, type DebateLink } from '@/components/scotparl/DebateRequestSection';
import VoteSection, { type PollInfo } from '@/components/scotparl/VoteSection';

export const metadata: Metadata = { title: 'Proposal' };
export const dynamic = 'force-dynamic';

type Proposal = {
  id: number;
  title: string;
  description: string;
  status: string;
  proposer_id: string;
  proposer_handle: string;
  rejection_reason: string | null;
  next_action: string | null;
  next_action_statement: string | null;
  next_action_at: Date | null;
  topic_id: number | null;
  topic_name: string | null;
  created_at: Date;
  updated_at: Date;
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  proposed: { label: 'Proposed', cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  rejected: { label: 'Rejected', cls: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' },
  amended:  { label: 'Amended',  cls: 'bg-violet-500/10 text-violet-300 border border-violet-500/20' },
  accepted: { label: 'Accepted', cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
};

const RESOLUTION_LABEL: Record<string, { heading: string; borderCls: string; labelCls: string }> = {
  closed: { heading: 'Closed',          borderCls: 'border-slate-500/30',  labelCls: 'text-slate-400' },
  debate: { heading: 'Opened for Debate', borderCls: 'border-blue-500/30', labelCls: 'text-blue-400' },
  vote:   { heading: 'Put to Vote',     borderCls: 'border-amber-500/30',  labelCls: 'text-amber-400' },
};

function statusBadge(status: string) {
  const { label, cls } = STATUS_BADGE[status] ?? { label: status, cls: 'bg-slate-500/10 text-slate-400' };
  return <span className={`inline-flex items-center rounded px-2.5 py-1 text-xs font-semibold leading-none ${cls}`}>{label}</span>;
}

function canView(session: { sub: string; isSysAdmin: boolean } | null, p: Proposal): boolean {
  if (p.status === 'accepted') return true;
  if (!session) return false;
  if (session.isSysAdmin) return true;
  return session.sub === p.proposer_id;
}

type Params = { params: Promise<{ id: string }> };

export default async function ProposalDetailPage({ params }: Params) {
  const { id } = await params;
  const session = await getSession().catch(() => null);

  const [{ rows: [p] }, debatesRes, requestsRes, pollRes] = await Promise.all([
    pool.query<Proposal>(
      `SELECT p.*, nt.name AS topic_name
       FROM proposals p
       LEFT JOIN nsp_topics nt ON nt.id = p.topic_id
       WHERE p.id = $1`,
      [id]
    ),
    pool.query(
      `SELECT spd.resolution_id, s.stat_title, s.stat_status,
              s.vote_total_for, s.vote_total_against,
              (SELECT COUNT(*) FROM comments c WHERE c.statement_id = s.id
               AND c.comment_status = 'accepted' AND NOT c.is_deleted)::int AS debate_chat_count
       FROM sp_proposal_debates spd
       JOIN statements s ON s.id = spd.resolution_id
       WHERE spd.proposal_id = $1 ORDER BY spd.created_at DESC`,
      [id]
    ),
    session?.isSysAdmin
      ? pool.query(
          `SELECT r.id, r.requester_id, r.requester_handle, r.reason, r.status, r.created_at,
                  json_agg(json_build_object('action', a.action, 'actor_handle', a.actor_handle,
                    'note', a.note, 'resolution_id', a.resolution_id, 'created_at', a.created_at)
                    ORDER BY a.created_at) FILTER (WHERE a.id IS NOT NULL) AS history
           FROM sp_debate_requests r
           LEFT JOIN sp_debate_request_actions a ON a.request_id = r.id
           WHERE r.entity_type = 'proposal' AND r.entity_id = $1
           GROUP BY r.id ORDER BY r.created_at DESC`,
          [id]
        )
      : session
        ? pool.query(
            `SELECT id, reason, status, created_at FROM sp_debate_requests
             WHERE entity_type = 'proposal' AND entity_id = $1 AND requester_id = $2
             ORDER BY created_at DESC`,
            [id, session.sub]
          )
        : Promise.resolve({ rows: [] }),
    pool.query(`SELECT pvc_poll_id FROM proposals WHERE id = $1`, [id]),
  ]);

  if (!p || !canView(session, p)) notFound();

  const isOwner    = session?.sub === p.proposer_id;
  const isSysAdmin = session?.isSysAdmin ?? false;
  const resolution = p.next_action ? RESOLUTION_LABEL[p.next_action] : null;
  const propDebates  = debatesRes.rows as DebateLink[];
  const propRequests = requestsRes.rows as DR[];

  // Fetch live poll data from poll.voter.care public API
  const pvcPollId = (pollRes.rows[0] as { pvc_poll_id: string | null } | undefined)?.pvc_poll_id ?? null;
  let poll: PollInfo | null = null;
  if (pvcPollId) {
    try {
      const r = await fetch(`https://poll.voter.care/api/v1/voter/polls/${pvcPollId}`, { next: { revalidate: 60 } });
      if (r.ok) {
        const d = await r.json();
        poll = { poll_id: pvcPollId, title: d.title, status: d.status, vote_count: d.vote_count, result_visibility: d.result_visibility };
      }
    } catch { /* poll API unavailable */ }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5">
        <Link href="/scotparl/proposals" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          ← Proposals
        </Link>
      </div>

      <div className="card-dr px-6 py-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-xl font-bold text-slate-100 leading-snug">{p.title}</h1>
          {statusBadge(p.status)}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-5 pb-4 border-b border-blue-900/15">
          {p.topic_name && (
            <span className="inline-flex items-center rounded bg-blue-500/10 px-2 py-0.5 text-blue-300">
              {p.topic_name}
            </span>
          )}
          <span>Proposed by @{p.proposer_handle}</span>
          <span>·</span>
          <span>{new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          {p.updated_at > p.created_at && (
            <>
              <span>·</span>
              <span>Updated {new Date(p.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </>
          )}
        </div>

        <div className="prose prose-sm prose-invert max-w-none text-slate-300 whitespace-pre-wrap leading-relaxed">
          {p.description}
        </div>
      </div>

      {/* Resolution card — shown to everyone once resolved */}
      {resolution && p.next_action_statement && (
        <div className={`mt-4 card-dr px-5 py-4 border ${resolution.borderCls}`}>
          <p className={`mb-2 text-xs font-semibold uppercase tracking-wider ${resolution.labelCls}`}>
            {resolution.heading}
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {p.next_action_statement}
          </p>
          {p.next_action_at && (
            <p className="mt-2 text-xs text-slate-500">
              {new Date(p.next_action_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      )}

      <ProposalActions
        proposalId={p.id}
        status={p.status}
        title={p.title}
        description={p.description}
        rejectionReason={p.rejection_reason}
        nextAction={p.next_action}
        isOwner={isOwner}
        isSysAdmin={isSysAdmin}
      />

      {/* Vote section */}
      {p.status === 'accepted' && (poll || isSysAdmin) && (
        <div className="mt-4">
          <VoteSection
            poll={poll}
            entityType="proposal"
            entityId={p.id}
            isSysAdmin={isSysAdmin}
          />
        </div>
      )}

      {/* Debate section — visible once proposal is accepted */}
      {p.status === 'accepted' && (
        <div className="mt-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Debate</h2>
          {(session || propDebates.length > 0) && (
            <DebateRequestSection
              entityType="proposal"
              entityId={p.id}
              entityTitle={p.title}
              entityDescription={p.description}
              userId={session?.sub ?? null}
              isSysAdmin={isSysAdmin}
              initialRequests={propRequests}
              debates={propDebates}
            />
          )}
          {!session && (
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3 text-sm text-slate-400">
              <Link href="/register" className="text-blue-400 hover:text-blue-300 transition-colors">Register</Link> to request a debate.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import DebateRequestSection, { type DebateRequest, type DebateLink } from '@/components/scotparl/DebateRequestSection';
import VoteSection, { type PollInfo } from '@/components/scotparl/VoteSection';

export const dynamic = 'force-dynamic';

type Stage = { id: number; stage_name: string; stage_date: string | null; sequence: number };
type Bill = {
  id: number; reference: string | null; short_name: string; full_name: string;
  bill_type: string | null; sponsor_id: number | null; sponsor_name: string | null;
  sponsor_preferred: string | null; sponsor_photo: string | null;
  sponsor_party: string | null; third_party_organisation: string | null;
  synopsis: string | null; session_slug: string | null;
};

async function getData(id: number, userId: string | null, isSysAdmin: boolean) {
  try {
    const queries: Promise<{ rows: unknown[] }>[] = [
      pool.query(
        `SELECT b.id, b.reference, b.short_name, b.full_name,
                bt.name AS bill_type,
                m.person_id AS sponsor_id,
                m.parliamentary_name AS sponsor_name,
                m.preferred_name     AS sponsor_preferred,
                m.photo_url          AS sponsor_photo,
                b.synopsis,
                b.third_party_organisation,
                sess.session_slug,
                (SELECT p.preferred_name
                 FROM sp_member_parties mp
                 JOIN sp_parties p ON p.id = mp.party_id
                 WHERE mp.person_id = m.person_id
                 ORDER BY mp.valid_from DESC NULLS LAST LIMIT 1) AS sponsor_party
         FROM sp_bills b
         LEFT JOIN sp_bill_types bt ON bt.id = b.bill_type_id
         LEFT JOIN sp_members m     ON m.person_id = b.person_id
         LEFT JOIN LATERAL (
           SELECT LOWER(ss.short_name) AS session_slug
           FROM sp_bill_stages sbs
           JOIN sp_sessions ss ON sbs.stage_date BETWEEN ss.start_date AND COALESCE(ss.end_date, now())
           WHERE sbs.bill_id = b.id
           ORDER BY sbs.stage_date ASC NULLS LAST LIMIT 1
         ) sess ON true
         WHERE b.id = $1`,
        [id]
      ),
      pool.query(
        `SELECT bs.id, bst.name AS stage_name, bs.stage_date, bst.sequence
         FROM sp_bill_stages bs
         JOIN sp_bill_stage_types bst ON bst.id = bs.bill_stage_type_id
         WHERE bs.bill_id = $1
         ORDER BY bs.stage_date ASC NULLS LAST`,
        [id]
      ),
      pool.query(
        `SELECT sbd.resolution_id, s.stat_title, s.stat_status,
                s.vote_total_for, s.vote_total_against,
                (SELECT COUNT(*) FROM comments c WHERE c.statement_id = s.id
                 AND c.comment_status = 'accepted' AND NOT c.is_deleted)::int AS debate_chat_count
         FROM sp_bill_debates sbd
         JOIN statements s ON s.id = sbd.resolution_id
         WHERE sbd.sp_bill_id = $1
         ORDER BY sbd.created_at DESC`,
        [id]
      ),
    ];

    // Fetch debate requests (sysadmin sees all, user sees own)
    if (isSysAdmin) {
      queries.push(pool.query(
        `SELECT r.id, r.requester_id, r.requester_handle, r.reason, r.status, r.created_at,
                json_agg(json_build_object('action', a.action, 'actor_handle', a.actor_handle,
                  'note', a.note, 'resolution_id', a.resolution_id, 'created_at', a.created_at)
                  ORDER BY a.created_at) FILTER (WHERE a.id IS NOT NULL) AS history
         FROM sp_debate_requests r
         LEFT JOIN sp_debate_request_actions a ON a.request_id = r.id
         WHERE r.entity_type = 'bill' AND r.entity_id = $1
         GROUP BY r.id ORDER BY r.created_at DESC`,
        [id]
      ));
    } else if (userId) {
      queries.push(pool.query(
        `SELECT id, reason, status, created_at
         FROM sp_debate_requests
         WHERE entity_type = 'bill' AND entity_id = $1 AND requester_id = $2
         ORDER BY created_at DESC`,
        [id, userId]
      ));
    }

    // Fetch pvc_poll_id
    queries.push(pool.query(
      `SELECT pvc_poll_id FROM sp_bill_pvc_polls WHERE sp_bill_id = $1`,
      [id]
    ));

    const [billRes, stagesRes, debatesRes, requestsRes, pvcRes] = await Promise.all(queries);

    // Fetch live poll data from poll.voter.care public API
    const pvcPollId = (pvcRes?.rows[0] as { pvc_poll_id: string } | undefined)?.pvc_poll_id ?? null;
    let poll: PollInfo | null = null;
    if (pvcPollId) {
      try {
        const r = await fetch(`https://poll.voter.care/api/v1/voter/polls/${pvcPollId}`, { next: { revalidate: 60 } });
        if (r.ok) {
          const d = await r.json();
          poll = { poll_id: pvcPollId, title: d.title, status: d.status, vote_count: d.vote_count, result_visibility: d.result_visibility };
        }
      } catch { /* poll API unavailable — show no poll */ }
    }

    return {
      bill:     billRes.rows[0] as Bill | undefined,
      stages:   stagesRes.rows as Stage[],
      debates:  debatesRes.rows as DebateLink[],
      requests: (requestsRes?.rows ?? []) as DebateRequest[],
      poll,
    };
  } catch {
    return null;
  }
}

function fmt(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const STAGE_COLOURS: Record<string, string> = {
  'Introduced': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  'Stage 1':    'bg-sky-500/10 text-sky-300 border-sky-500/20',
  'Stage 2':    'bg-blue-500/10 text-blue-300 border-blue-500/20',
  'Stage 3':    'bg-violet-500/10 text-violet-300 border-violet-500/20',
  'Royal Assent': 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  'Passed':     'bg-teal-500/10 text-teal-300 border-teal-500/20',
};
function parliamentUrl(shortName: string, sessionSlug: string | null): string | null {
  if (!sessionSlug) return null;
  const slug = shortName
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://www.parliament.scot/bills-and-laws/bills/${sessionSlug}/${slug}`;
}

function stageCls(name: string) {
  for (const [k, v] of Object.entries(STAGE_COLOURS)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession().catch(() => null);
  const data = await getData(parseInt(id, 10), session?.sub ?? null, session?.isSysAdmin ?? false);
  return { title: data?.bill?.short_name ?? 'Bill' };
}

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession().catch(() => null);
  const data = await getData(parseInt(id, 10), session?.sub ?? null, session?.isSysAdmin ?? false);
  if (!data || !data.bill) notFound();
  const { bill, stages, debates, requests, poll } = data;

  const latestStage = stages.at(-1);

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/scotparl/bills" className="hover:text-slate-300 transition-colors">Bills</Link>
        <span>/</span>
        <span className="text-slate-400 truncate">{bill.short_name}</span>
      </div>

      {/* Header */}
      <div className="card-dr p-6 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            {bill.reference && <p className="text-xs text-slate-500 mb-1">{bill.reference}</p>}
            <h1 className="text-xl font-bold text-slate-100 leading-snug">{bill.full_name}</h1>
          </div>
          <div className="flex flex-shrink-0 items-start gap-2 flex-wrap">
            {parliamentUrl(bill.short_name, bill.session_slug) && (
              <a
                href={parliamentUrl(bill.short_name, bill.session_slug)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
              >
                Full Bill
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            {latestStage && (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${stageCls(latestStage.stage_name)}`}>
                {latestStage.stage_name}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
          {bill.bill_type && (
            <span><span className="text-slate-500">Type: </span>{bill.bill_type}</span>
          )}
          {bill.third_party_organisation && (
            <span><span className="text-slate-500">Organisation: </span>{bill.third_party_organisation}</span>
          )}
        </div>

        {/* Sponsor */}
        {bill.sponsor_id && (
          <div className="flex items-center gap-3 pt-1">
            {bill.sponsor_photo && (
              <img src={bill.sponsor_photo} alt="" className="h-9 w-9 rounded-full object-cover bg-slate-700" />
            )}
            <div>
              <Link href={`/scotparl/msps/${bill.sponsor_id}`} className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                {bill.sponsor_preferred ?? bill.sponsor_name?.split(',').reverse().join(' ').trim()}
              </Link>
              {bill.sponsor_party && (
                <p className="text-xs text-slate-500">{bill.sponsor_party}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Synopsis */}
      {bill.synopsis && (
        <div className="card-dr p-5">
          <p className="text-sm text-slate-300 leading-relaxed">{bill.synopsis}</p>
          <p className="text-xs text-slate-600 mt-2">AI-generated summary</p>
        </div>
      )}

      {/* Stage timeline */}
      {stages.length > 0 && (
        <div className="card-dr">
          <h2 className="text-sm font-semibold text-slate-300 px-5 py-4 border-b border-slate-800">Parliamentary Progress</h2>
          <div className="px-5 py-4 space-y-0">
            {stages.map((s, i) => (
              <div key={s.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`h-2.5 w-2.5 rounded-full mt-1 flex-shrink-0 ${i === stages.length - 1 ? 'bg-blue-400' : 'bg-slate-600'}`} />
                  {i < stages.length - 1 && <div className="w-px flex-1 bg-slate-800 my-1 min-h-[1.25rem]" />}
                </div>
                <div className="pb-4">
                  <p className="text-sm font-medium text-slate-200">{s.stage_name}</p>
                  {s.stage_date && <p className="text-xs text-slate-500 mt-0.5">{fmt(s.stage_date)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debates + request section */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider text-xs">Debate</h2>
        {(session || debates.length > 0) && (
          <DebateRequestSection
            entityType="bill"
            entityId={bill.id}
            entityTitle={bill.short_name}
            entityDescription={bill.synopsis ?? ''}
            userId={session?.sub ?? null}
            isSysAdmin={session?.isSysAdmin ?? false}
            initialRequests={requests}
            debates={debates}
          />
        )}
        {!session && (
          <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3 text-sm text-slate-400">
            <Link href="/register" className="text-blue-400 hover:text-blue-300 transition-colors">Register</Link> to request a debate.
          </div>
        )}
      </div>

      {/* Vote section */}
      {(poll || session?.isSysAdmin) && (
        <VoteSection
          poll={poll}
          entityType="bill"
          entityId={bill.id}
          isSysAdmin={session?.isSysAdmin ?? false}
        />
      )}

      {/* parliament.scot link */}
      {parliamentUrl(bill.short_name, bill.session_slug) && (
        <a
          href={parliamentUrl(bill.short_name, bill.session_slug)!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          View on parliament.scot
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}

      <p className="text-xs text-slate-600">
        Data sourced from{' '}
        <a href="https://www.parliament.scot" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 underline underline-offset-2">
          parliament.scot
        </a>
      </p>
    </div>
  );
}

import type { Metadata } from 'next';
import pool from '@/lib/db';
import DebateVoteList, { type DebateVoteItem } from '@/components/scotparl/DebateVoteList';

export const metadata: Metadata = { title: 'Debates & Votes' };
export const dynamic = 'force-dynamic';

export default async function DebatesPage() {
  let items: DebateVoteItem[] = [];

  try {
    const { rows } = await pool.query<DebateVoteItem>(`
      -- Bill debates
      SELECT
        s.id::text                                              AS id,
        'debate'                                               AS kind,
        s.stat_title                                           AS title,
        CASE WHEN s.stat_status = 'active' THEN 'open' ELSE 'closed' END AS status,
        COALESCE(s.vote_total_for,     0)                      AS votes_for,
        COALESCE(s.vote_total_against, 0)                      AS votes_against,
        (SELECT COUNT(*)::int FROM comments c
         WHERE c.statement_id = s.id
           AND c.comment_status = 'accepted' AND NOT c.is_deleted) AS chat_count,
        s.created_at::text                                     AS created_at,
        NULL::text                                             AS closes_at,
        'bill'                                                 AS entity_type,
        b.id::text                                             AS entity_id,
        b.short_name                                           AS entity_title

      FROM sp_bill_debates sbd
      JOIN statements s ON s.id = sbd.resolution_id
      JOIN sp_bills   b ON b.id = sbd.sp_bill_id

      UNION ALL

      -- Proposal debates
      SELECT
        s.id::text                                              AS id,
        'debate'                                               AS kind,
        s.stat_title                                           AS title,
        CASE WHEN s.stat_status = 'active' THEN 'open' ELSE 'closed' END AS status,
        COALESCE(s.vote_total_for,     0)                      AS votes_for,
        COALESCE(s.vote_total_against, 0)                      AS votes_against,
        (SELECT COUNT(*)::int FROM comments c
         WHERE c.statement_id = s.id
           AND c.comment_status = 'accepted' AND NOT c.is_deleted) AS chat_count,
        s.created_at::text                                     AS created_at,
        NULL::text                                             AS closes_at,
        'proposal'                                             AS entity_type,
        p.id::text                                             AS entity_id,
        p.title                                                AS entity_title

      FROM sp_proposal_debates spd
      JOIN statements  s ON s.id = spd.resolution_id
      JOIN proposals   p ON p.id = spd.proposal_id

      UNION ALL

      -- Bill votes (poll.voter.care)
      SELECT
        sbpp.pvc_poll_id                                       AS id,
        'vote'                                                 AS kind,
        b.short_name || ' — Vote'                              AS title,
        'open'                                                 AS status,
        0                                                      AS votes_for,
        0                                                      AS votes_against,
        0                                                      AS chat_count,
        sbpp.created_at::text                                  AS created_at,
        NULL::text                                             AS closes_at,
        'bill'                                                 AS entity_type,
        b.id::text                                             AS entity_id,
        b.short_name                                           AS entity_title

      FROM sp_bill_pvc_polls sbpp
      JOIN sp_bills b ON b.id = sbpp.sp_bill_id

      UNION ALL

      -- Proposal votes (poll.voter.care)
      SELECT
        p.pvc_poll_id                                          AS id,
        'vote'                                                 AS kind,
        p.title || ' — Vote'                                   AS title,
        'open'                                                 AS status,
        0                                                      AS votes_for,
        0                                                      AS votes_against,
        0                                                      AS chat_count,
        p.updated_at::text                                     AS created_at,
        NULL::text                                             AS closes_at,
        'proposal'                                             AS entity_type,
        p.id::text                                             AS entity_id,
        p.title                                                AS entity_title

      FROM proposals p
      WHERE p.pvc_poll_id IS NOT NULL

      ORDER BY created_at DESC
    `);
    items = rows;
  } catch {
    // tables not yet populated
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Debates &amp; Votes</h1>
        <p className="mt-1 text-sm text-slate-400">
          All ScotParl debates and formal votes, open and closed.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="card-dr py-16 text-center space-y-2">
          <p className="text-slate-400">No debates or votes yet.</p>
        </div>
      ) : (
        <DebateVoteList items={items} />
      )}
    </div>
  );
}

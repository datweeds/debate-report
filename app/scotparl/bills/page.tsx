import type { Metadata } from 'next';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import BillList, { type Bill } from '@/components/scotparl/BillList';

export const metadata: Metadata = { title: 'Bills' };
export const dynamic = 'force-dynamic';

export default async function BillsPage() {
  const session = await getSession().catch(() => null);

  let bills: Bill[] = [];
  let favIds: number[] = [];

  try {
    const [billsRes, favsRes] = await Promise.all([
      pool.query<Bill>(
        `SELECT
           b.id, b.reference, b.short_name, b.full_name,
           bt.name                  AS bill_type,
           m.parliamentary_name     AS sponsor_name,
           m.preferred_name         AS sponsor_preferred,
           b.third_party_organisation,
           b.synopsis,
           latest_stage.stage_name  AS current_stage,
           latest_stage.stage_date  AS latest_stage_date,
           sbd.resolution_id,
           sbd.debate_status,
           sbd.debate_votes_for,
           sbd.debate_votes_against,
           sbd.debate_chat_count,
           (SELECT COUNT(*)::int FROM sp_debate_requests sdr
            WHERE sdr.entity_type = 'bill' AND sdr.entity_id = b.id) AS debate_request_count,
           sbpp.pvc_poll_id,
           sess.session_slug
         FROM sp_bills b
         LEFT JOIN sp_bill_types bt ON bt.id = b.bill_type_id
         LEFT JOIN sp_members m     ON m.person_id = b.person_id
         LEFT JOIN LATERAL (
           SELECT bst.name AS stage_name, bs.stage_date
           FROM sp_bill_stages bs
           JOIN sp_bill_stage_types bst ON bst.id = bs.bill_stage_type_id
           WHERE bs.bill_id = b.id
           ORDER BY bs.stage_date DESC NULLS LAST
           LIMIT 1
         ) latest_stage ON true
         LEFT JOIN LATERAL (
           SELECT LOWER(ss.short_name) AS session_slug
           FROM sp_bill_stages sbs
           JOIN sp_sessions ss ON sbs.stage_date BETWEEN ss.start_date AND COALESCE(ss.end_date, now())
           WHERE sbs.bill_id = b.id
           ORDER BY sbs.stage_date ASC NULLS LAST LIMIT 1
         ) sess ON true
         LEFT JOIN LATERAL (
           SELECT sbd.resolution_id, s.stat_status AS debate_status,
                  s.vote_total_for AS debate_votes_for, s.vote_total_against AS debate_votes_against,
                  (SELECT COUNT(*) FROM comments c WHERE c.statement_id = s.id
                   AND c.comment_status = 'accepted' AND NOT c.is_deleted)::int AS debate_chat_count
           FROM sp_bill_debates sbd
           JOIN statements s ON s.id = sbd.resolution_id
           WHERE sbd.sp_bill_id = b.id
           ORDER BY sbd.created_at DESC LIMIT 1
         ) sbd ON true
         LEFT JOIN sp_bill_pvc_polls sbpp ON sbpp.sp_bill_id = b.id
         ORDER BY b.id DESC`
      ),
      session
        ? pool.query<{ bill_id: number }>(`SELECT bill_id FROM sp_bill_favs WHERE user_id = $1`, [session.sub])
        : Promise.resolve({ rows: [] }),
    ]);
    bills = billsRes.rows;
    favIds = favsRes.rows.map(r => r.bill_id);
  } catch {
    // table not yet populated
  }

  const types  = [...new Set(bills.map(b => b.bill_type).filter((t): t is string => !!t))].sort();
  const stages = [...new Set(bills.map(b => b.current_stage).filter((s): s is string => !!s))].sort();
  const years  = [...new Set(bills.map(b => b.latest_stage_date ? new Date(b.latest_stage_date).getFullYear() : null).filter((y): y is number => y !== null))].sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Bills &amp; Legislation</h1>
        <p className="text-slate-400 mt-1 text-sm">All bills introduced to the Scottish Parliament (Sessions 1–6).</p>
      </div>
      {bills.length === 0 ? (
        <div className="card-dr py-16 text-center space-y-2">
          <p className="text-slate-400">No data loaded yet.</p>
          <p className="text-sm text-slate-500">A ScotParl moderator needs to run the data sync first.</p>
        </div>
      ) : (
        <BillList
          bills={bills}
          types={types}
          stages={stages}
          years={years}
          userId={session?.sub ?? null}
          initialFavIds={favIds}
        />
      )}
    </div>
  );
}

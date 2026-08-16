import Link from 'next/link';
import type { Metadata } from 'next';
import pool, { tq } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canManageDebates } from '@/lib/roles';
import BillList, { type Bill, type Ssi, type Act } from '@/components/scotparl/BillList';

export const metadata: Metadata = { title: 'Laws' };
export const dynamic = 'force-dynamic';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

export default async function BillsPage() {
  const session = await getSession().catch(() => null);
  const isManager = session ? await canManageDebates(session, TENANT_ID) : false;

  let bills: Bill[] = [];
  let ssis:  Ssi[]  = [];
  let acts:  Act[]  = [];
  let favIds: number[] = [];
  let lightScores: Record<string, number> = {};
  let initialFlaggedKeys: string[] = [];

  try {
    const [billsRes, favsRes, ssiRes, actRes] = await Promise.all([
      tq<Bill>(
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
           sess.session_slug,
           ia.impact_score,
           COALESCE(ia.impact_count, 0) AS impact_count
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
         LEFT JOIN LATERAL (
           SELECT ROUND(MAX(overall_score)::numeric, 1)::float AS impact_score, COUNT(*)::int AS impact_count
           FROM society_impact_analyses
           WHERE entity_type = 'bill' AND entity_id = b.id AND status = 'done'
             AND tenant_id = current_setting('app.tenant_id')::int
         ) ia ON true
         ORDER BY b.id DESC`
      ),
      session
        ? pool.query<{ bill_id: number }>(`SELECT bill_id FROM sp_bill_favs WHERE user_id = $1`, [session.sub])
        : Promise.resolve({ rows: [] }),
      pool.query<Ssi>(
        `SELECT id, year, number, title, url, pdf_url, enacted_at, procedure, subject
         FROM sp_ssis ORDER BY year DESC, number DESC`
      ).catch(() => ({ rows: [] as Ssi[] })),
      pool.query<Act>(
        `SELECT id, year, number, title, url, pdf_url, enacted_at
         FROM sp_acts ORDER BY year DESC, number DESC`
      ).catch(() => ({ rows: [] as Act[] })),
    ]);
    bills  = billsRes.rows;
    favIds = favsRes.rows.map(r => r.bill_id);
    ssis   = ssiRes.rows;
    acts   = actRes.rows;

    // Light AI scores (table may not exist yet)
    try {
      const lsRes = await tq<{ entity_type: string; entity_id: number; light_score: number }>(
        `SELECT entity_type, entity_id, MAX(score)::int AS light_score
         FROM society_light_analyses GROUP BY entity_type, entity_id`
      );
      for (const r of lsRes.rows) lightScores[`${r.entity_type}:${r.entity_id}`] = r.light_score;
    } catch {}

    // Flags (table may not exist yet, only needed for managers)
    if (isManager) {
      try {
        const flRes = await pool.query<{ entity_type: string; entity_id: number }>(
          `SELECT entity_type, entity_id FROM society_interest_flags WHERE tenant_id = $1`, [TENANT_ID]
        );
        initialFlaggedKeys = flRes.rows.map(r => `${r.entity_type}:${r.entity_id}`);
      } catch {}
    }
  } catch {
    // tables not yet populated
  }

  const types  = [...new Set(bills.map(b => b.bill_type).filter((t): t is string => !!t))].sort();
  const stages = [...new Set(bills.map(b => b.current_stage).filter((s): s is string => !!s))].sort();

  const billYears = bills.map(b => b.latest_stage_date ? new Date(b.latest_stage_date).getFullYear() : null).filter((y): y is number => y !== null);
  const ssiYears  = ssis.map(s => s.year);
  const actYears  = acts.map(a => a.year);
  const years = [...new Set([...billYears, ...ssiYears, ...actYears])].sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Laws</h1>
          <p className="text-slate-400 mt-1 text-sm">Acts, Bills, and Scottish Statutory Instruments.</p>
        </div>
        <Link href="/scotparl/bills/msps" className="flex-shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors">
          MSPs →
        </Link>
      </div>
      {bills.length === 0 && ssis.length === 0 && acts.length === 0 ? (
        <div className="card-dr py-16 text-center space-y-2">
          <p className="text-slate-400">No data loaded yet.</p>
          <p className="text-sm text-slate-500">A ScotParl moderator needs to run the data sync first.</p>
        </div>
      ) : (
        <BillList
          bills={bills}
          ssis={ssis}
          acts={acts}
          types={types}
          stages={stages}
          years={years}
          userId={session?.sub ?? null}
          initialFavIds={favIds}
          lightScores={lightScores}
          initialFlaggedKeys={initialFlaggedKeys}
          isManager={isManager}
        />
      )}
    </div>
  );
}

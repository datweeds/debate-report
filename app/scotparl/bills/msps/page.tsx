import type { Metadata } from 'next';
import Link from 'next/link';
import pool from '@/lib/db';
import MspList, { type Msp } from '@/components/scotparl/MspList';

export const metadata: Metadata = { title: 'MSPs' };
export const dynamic = 'force-dynamic';

export default async function MspsPage() {
  let msps: Msp[] = [];
  try {
    const { rows } = await pool.query<Msp>(
      `SELECT
         m.person_id, m.parliamentary_name, m.preferred_name, m.photo_url, m.is_current,
         p.preferred_name          AS party_name,
         p.abbreviation            AS party_abbr,
         COUNT(DISTINCT b.id)::int AS bills_sponsored,
         mc.constituency_name
       FROM sp_members m
       LEFT JOIN LATERAL (
         SELECT mp.party_id
         FROM sp_member_parties mp
         WHERE mp.person_id = m.person_id
         ORDER BY mp.valid_from DESC NULLS LAST
         LIMIT 1
       ) latest_mp ON true
       LEFT JOIN sp_parties p               ON p.id = latest_mp.party_id
       LEFT JOIN sp_bills   b               ON b.person_id = m.person_id
       LEFT JOIN sp_member_constituencies mc ON mc.person_id = m.person_id
       GROUP BY m.person_id, m.parliamentary_name, m.preferred_name,
                m.photo_url, m.is_current, p.preferred_name, p.abbreviation,
                mc.constituency_name
       ORDER BY m.is_current DESC, m.parliamentary_name ASC`
    );
    msps = rows;
  } catch {
    // table not yet populated — show empty state via the client component
  }

  const parties        = [...new Set(msps.map(m => m.party_name).filter((p): p is string => !!p))].sort();
  const constituencies = [...new Set(msps.map(m => m.constituency_name).filter((c): c is string => !!c))].sort();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link href="/scotparl/bills" className="hover:text-slate-300 transition-colors">Bills</Link>
          <span>/</span>
          <span className="text-slate-400">MSPs</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">MSPs</h1>
        <p className="text-slate-400 mt-1 text-sm">Members of the Scottish Parliament.</p>
      </div>
      {msps.length === 0 ? (
        <div className="card-dr py-16 text-center">
          <p className="text-slate-400">No data loaded yet.</p>
        </div>
      ) : (
        <MspList msps={msps} parties={parties} constituencies={constituencies} />
      )}
    </div>
  );
}

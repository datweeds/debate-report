import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

async function getData(id: number) {
  try {
    const [memberRes, partiesRes, billsRes] = await Promise.all([
      pool.query(
        `SELECT m.person_id, m.parliamentary_name, m.preferred_name, m.photo_url, m.is_current,
                mc.constituency_name
         FROM sp_members m
         LEFT JOIN sp_member_constituencies mc ON mc.person_id = m.person_id
         WHERE m.person_id = $1`,
        [id]
      ),
      pool.query(
        `SELECT mp.valid_from, mp.valid_until, p.preferred_name AS party_name, p.abbreviation AS party_abbr
         FROM sp_member_parties mp
         JOIN sp_parties p ON p.id = mp.party_id
         WHERE mp.person_id = $1
         ORDER BY mp.valid_from DESC NULLS LAST`,
        [id]
      ),
      pool.query(
        `SELECT b.id, b.reference, b.short_name, bt.name AS bill_type,
                (SELECT bst.name FROM sp_bill_stages bs
                 JOIN sp_bill_stage_types bst ON bst.id = bs.bill_stage_type_id
                 WHERE bs.bill_id = b.id ORDER BY bs.stage_date DESC NULLS LAST LIMIT 1) AS current_stage,
                (SELECT bs.stage_date FROM sp_bill_stages bs
                 WHERE bs.bill_id = b.id ORDER BY bs.stage_date DESC NULLS LAST LIMIT 1) AS latest_date
         FROM sp_bills b
         LEFT JOIN sp_bill_types bt ON bt.id = b.bill_type_id
         WHERE b.person_id = $1 ORDER BY b.id DESC`,
        [id]
      ),
    ]);
    return { member: memberRes.rows[0], parties: partiesRes.rows, bills: billsRes.rows };
  } catch {
    return null;
  }
}

function displayName(m: { preferred_name: string | null; parliamentary_name: string }) {
  if (m.preferred_name && m.parliamentary_name.includes(',')) {
    const surname = m.parliamentary_name.split(',')[0].trim();
    return `${m.preferred_name} ${surname}`;
  }
  return m.parliamentary_name;
}

function fmt(date: string | null) {
  if (!date) return 'present';
  return new Date(date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getData(parseInt(id, 10));
  const name = data?.member ? displayName(data.member) : 'MSP';
  return { title: name };
}

export default async function MspDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getData(parseInt(id, 10));
  if (!data || !data.member) notFound();
  const { member, parties, bills } = data;
  const currentParty = parties[0];

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/scotparl/bills" className="hover:text-slate-300 transition-colors">Bills</Link>
        <span>/</span>
        <Link href="/scotparl/bills/msps" className="hover:text-slate-300 transition-colors">MSPs</Link>
        <span>/</span>
        <span className="text-slate-400">{displayName(member)}</span>
      </div>

      {/* Profile card */}
      <div className="card-dr p-6 flex items-start gap-5">
        {member.photo_url ? (
          <img src={member.photo_url} alt="" className="h-20 w-20 rounded-full object-cover flex-shrink-0 bg-slate-700" />
        ) : (
          <div className="h-20 w-20 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center">
            <span className="text-3xl text-slate-500">{displayName(member)[0]}</span>
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-slate-100">{displayName(member)}</h1>
          {currentParty && (
            <p className="text-sm text-slate-400 mt-0.5">{currentParty.party_name}</p>
          )}
          {member.constituency_name && (
            <p className="text-sm text-slate-500 mt-0.5">{member.constituency_name}</p>
          )}
          {!member.is_current && (
            <span className="inline-block mt-1 rounded-full px-2 py-0.5 text-xs text-slate-400 border border-slate-600 bg-slate-700/30">
              Former MSP
            </span>
          )}
        </div>
      </div>

      {/* Party history */}
      {parties.length > 0 && (
        <div className="card-dr">
          <h2 className="text-sm font-semibold text-slate-300 px-5 py-4 border-b border-slate-800">Party Membership</h2>
          <ul className="divide-y divide-slate-800/60">
            {parties.map((p, i) => (
              <li key={i} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-200">{p.party_name}</span>
                <span className="text-xs text-slate-500">
                  {fmt(p.valid_from)} – {fmt(p.valid_until)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sponsored bills */}
      {bills.length > 0 && (
        <div className="card-dr">
          <h2 className="text-sm font-semibold text-slate-300 px-5 py-4 border-b border-slate-800">
            Sponsored Bills ({bills.length})
          </h2>
          <ul className="divide-y divide-slate-800/60">
            {bills.map(b => (
              <li key={b.id}>
                <Link href={`/scotparl/bills/${b.id}`} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-800/40 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{b.short_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {b.bill_type && <span className="text-xs text-slate-500">{b.bill_type}</span>}
                      {b.reference  && <span className="text-xs text-slate-600">{b.reference}</span>}
                    </div>
                  </div>
                  {b.current_stage && (
                    <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs border bg-blue-500/10 text-blue-300 border-blue-500/20">
                      {b.current_stage}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
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

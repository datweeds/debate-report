import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export type ScotparlFavs = {
  bills: number[];
  proposals: number[];
  debates: string[];   // statement UUIDs
  principles: number[];
};

export async function GET() {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ bills: [], proposals: [], debates: [], principles: [] });

  const [billsRes, proposalsRes, debatesRes, principlesRes] = await Promise.all([
    pool.query<{ bill_id: number }>(
      `SELECT bill_id FROM sp_bill_favs WHERE user_id = $1`,
      [session.sub],
    ).catch(() => ({ rows: [] as { bill_id: number }[] })),
    pool.query<{ proposal_id: number }>(
      `SELECT proposal_id FROM proposal_favs WHERE user_id = $1`,
      [session.sub],
    ).catch(() => ({ rows: [] as { proposal_id: number }[] })),
    pool.query<{ statement_id: string }>(
      `SELECT statement_id FROM stat_favs WHERE created_by = $1`,
      [session.sub],
    ).catch(() => ({ rows: [] as { statement_id: string }[] })),
    pool.query<{ principle_id: number }>(
      `SELECT principle_id FROM nsp_principle_favs WHERE user_id = $1`,
      [session.sub],
    ).catch(() => ({ rows: [] as { principle_id: number }[] })),
  ]);

  return NextResponse.json({
    bills:      billsRes.rows.map(r => r.bill_id),
    proposals:  proposalsRes.rows.map(r => r.proposal_id),
    debates:    debatesRes.rows.map(r => r.statement_id),
    principles: principlesRes.rows.map(r => r.principle_id),
  } satisfies ScotparlFavs);
}

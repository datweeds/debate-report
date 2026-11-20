import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { listableResolutionSql } from '@/lib/debateAccess';

const TYPES = ['framework', 'claim', 'warrant', 'evidence', 'impact', 'rebuttal', 'turn'];

// GET ?since=YYYY-MM-DD — this Society's debates in numbers: debates, votes and
// statements of each type, in total and new since the date (default: 7 days
// ago). Only debates the viewer may see are counted.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const s = req.nextUrl.searchParams.get('since');
  const since = s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? s : null;
  const args = [a.societyId, a.session?.sub ?? null, since];
  const visible = `r.customer_id = $1 AND r.stat_type = 'resolution' AND r.stat_status <> 'deleted' AND ${listableResolutionSql('r', '$2::text')}`;
  const after = `COALESCE($3::date::timestamptz, now() - interval '7 days')`;
  const [{ rows: [d] }, { rows: [v] }, { rows: types }] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE r.created_at > ${after})::int AS recent FROM statements r WHERE ${visible}`, args),
    pool.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE sv.created_at > ${after})::int AS recent
                FROM stat_votes sv JOIN statements st ON st.id = sv.statement_id JOIN statements r ON r.id = COALESCE(st.resolution_id, st.id)
                WHERE ${visible}`, args),
    pool.query(`SELECT s.stat_type::text AS type, count(*)::int AS total, count(*) FILTER (WHERE s.created_at > ${after})::int AS recent
                FROM statements s JOIN statements r ON r.id = s.resolution_id
                WHERE ${visible} AND s.retracted_at IS NULL GROUP BY 1`, args),
  ]);
  const byType = Object.fromEntries(types.map(t => [t.type, { total: t.total, recent: t.recent }]));
  return NextResponse.json({
    debates: d, votes: v,
    statements: TYPES.map(t => ({ type: t, ...(byType[t] ?? { total: 0, recent: 0 }) })),
  });
}

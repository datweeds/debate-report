import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  // Verify debate exists and get age
  const { rows: [res] } = await pool.query(
    `SELECT id, created_at FROM statements WHERE id = $1 AND stat_type = 'resolution'`,
    [id],
  );
  if (!res) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ageMs = Date.now() - new Date(res.created_at).getTime();
  const threeMonthsMs = 90 * 24 * 60 * 60 * 1000;
  const timeUnit = ageMs < threeMonthsMs ? 'day' : 'month';
  const fmtPg = timeUnit === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';

  // Statements created over time, split by direction
  const { rows: stmtRows } = await pool.query(
    `SELECT
       TO_CHAR(DATE_TRUNC($2, s.created_at), $3)                 AS period,
       COALESCE(s.stat_direction::text, 'neutral')               AS direction,
       COUNT(*)::int                                              AS count
     FROM statements s
     WHERE s.resolution_id = $1 OR s.id = $1
     GROUP BY 1, 2
     ORDER BY 1`,
    [id, timeUnit, fmtPg],
  );

  // Chat messages created over time (all statements in this debate)
  const { rows: chatRows } = await pool.query(
    `SELECT
       TO_CHAR(DATE_TRUNC($2, c.created_at), $3) AS period,
       COUNT(*)::int                              AS count
     FROM comments c
     JOIN statements s ON s.id = c.statement_id
     WHERE (s.resolution_id = $1 OR s.id = $1)
       AND c.comment_status = 'accepted'
     GROUP BY 1
     ORDER BY 1`,
    [id, timeUnit, fmtPg],
  );

  // Build unified period list
  const allPeriods = Array.from(
    new Set([...stmtRows.map(r => r.period), ...chatRows.map(r => r.period)]),
  ).sort();

  // Pivot statements by period
  const stmtByPeriod: Record<string, { for: number; against: number; neutral: number }> = {};
  for (const r of stmtRows) {
    if (!stmtByPeriod[r.period]) stmtByPeriod[r.period] = { for: 0, against: 0, neutral: 0 };
    const k = r.direction === 'for' ? 'for' : r.direction === 'against' ? 'against' : 'neutral';
    stmtByPeriod[r.period][k] += r.count;
  }

  const chatByPeriod: Record<string, number> = {};
  for (const r of chatRows) chatByPeriod[r.period] = r.count;

  const statementSeries = allPeriods.map(p => ({
    period:   p,
    for:      stmtByPeriod[p]?.for     ?? 0,
    against:  stmtByPeriod[p]?.against ?? 0,
    neutral:  stmtByPeriod[p]?.neutral ?? 0,
  }));

  const chatSeries = allPeriods.map(p => ({
    period: p,
    count:  chatByPeriod[p] ?? 0,
  }));

  return NextResponse.json({ timeUnit, statementSeries, chatSeries });
}

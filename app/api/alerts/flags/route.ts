import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.tier !== 'moderator' && !session.isSysAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Each row = one flag event; group by statement to show total flag counts
  const { rows } = await pool.query(
    `SELECT
       sf.id, sf.stat_id, sf.reason, sf.created_at,
       flagger.user_handle  AS author_handle,
       s.stat_title         AS statement_title,
       s.resolution_id,
       res.stat_title       AS resolution_title,
       (SELECT COUNT(*)::int FROM stat_flags sf2 WHERE sf2.stat_id = sf.stat_id) AS total_flags
     FROM stat_flags sf
     LEFT JOIN users      flagger ON flagger.id = sf.flagged_by
     LEFT JOIN statements s       ON s.id       = sf.stat_id
     LEFT JOIN statements res     ON res.id      = s.resolution_id
     ORDER BY sf.created_at DESC
     LIMIT 200`,
  );

  return NextResponse.json({ flags: rows, total: rows.length });
}

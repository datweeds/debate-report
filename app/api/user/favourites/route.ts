import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT s.id, s.stat_title, s.subject_area, s.created_at, f.created_at AS favourited_at,
            s.vote_for, s.vote_against,
            (SELECT COUNT(*) FROM comments c WHERE c.statement_id = s.id) AS chat_count,
            (SELECT COUNT(*) FROM statements ch WHERE ch.resolution_id = s.id) AS statement_count,
            (SELECT COUNT(*) FROM statements ch WHERE ch.resolution_id = s.id AND ch.science_analysis_id IS NOT NULL) AS science_count
     FROM stat_favs f
     JOIN statements s ON s.id = f.statement_id
     WHERE f.created_by = $1
       AND s.stat_type = 'resolution'
     ORDER BY f.created_at DESC
     LIMIT 20`,
    [session.sub],
  );

  return NextResponse.json(rows);
}

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT
       sv.id,
       sv.vote,
       sv.vote_debate_impact                        AS impact,
       sv.vote_rationale                            AS rationale,
       sv.updated_at,
       s.id                                         AS statement_id,
       s.stat_title,
       s.stat_type,
       s.stat_direction,
       COALESCE(s.forum_title_cache, f.forum_title) AS forum_title,
       COALESCE(r.stat_title, s.stat_title)         AS resolution_title,
       COALESCE(s.resolution_id, s.id)              AS resolution_id,
       u.user_handle                                AS author_handle
     FROM stat_votes sv
     JOIN statements s   ON s.id  = sv.statement_id
     LEFT JOIN statements r ON r.id = s.resolution_id
     LEFT JOIN debate_forums f ON f.id = COALESCE(s.forum_id, r.forum_id)
     LEFT JOIN users u   ON u.id  = s.created_by
     WHERE sv.created_by = $1
     ORDER BY sv.updated_at DESC`,
    [session.sub],
  );

  return NextResponse.json({ votes: rows });
}

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  const userId = session?.sub ?? null;

  // Debates visible in the Switchboard:
  // (a) Public House forum (forum_type = 'public')
  // (b) Apply-type private forums (anyone can see to apply)
  // (c) Invite-type private forums where the user is an active member
  // Legacy: debates with no forum_id and forum_visibility = 'public'
  const { rows } = await pool.query(
    `SELECT s.id, s.stat_title, s.subject_area, s.forum_id,
            COALESCE(f.forum_type::text, 'public')       AS forum_type,
            COALESCE(f.forum_visibility::text, 'public') AS forum_visibility,
            f.forum_title,
            s.vote_for, s.vote_against,
            COUNT(DISTINCT ch.id)::int AS child_count,
            COUNT(DISTINCT ch.id) FILTER (WHERE ch.science_analysis_id IS NOT NULL)::int AS science_count,
            COUNT(DISTINCT cm.id)::int AS chat_count
     FROM   statements s
     LEFT   JOIN debate_forums f  ON f.id = s.forum_id
     LEFT   JOIN users u          ON u.id = s.created_by
     LEFT   JOIN statements ch    ON ch.resolution_id = s.id
     LEFT   JOIN comments cm      ON cm.statement_id = s.id
     WHERE  s.stat_type = 'resolution'
       AND  s.stat_status IN ('active', 'closed')
       AND  s.stat_hidden IS NOT TRUE
       AND  (
              (s.forum_id IS NULL AND s.forum_visibility = 'public')
           OR f.forum_type = 'public'
           OR f.forum_visibility = 'apply'
           OR ($1::uuid IS NOT NULL AND f.forum_visibility = 'invite' AND EXISTS (
                SELECT 1 FROM forum_members fm
                WHERE fm.forum_id = f.id
                  AND fm.user_id = $1::uuid
                  AND fm.member_status = 'active'
              ))
            )
     GROUP  BY s.id, s.vote_for, s.vote_against, f.id
     ORDER  BY s.created_at DESC`,
    [userId]
  );

  return NextResponse.json(rows);
}

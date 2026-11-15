import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { listableResolutionSql } from '@/lib/debateAccess';

// Switch Debate lists debates across Societies, regardless of which one the
// visitor currently has selected. Who sees what is the shared rule in
// lib/debateAccess.ts (Society visibility, then debate visibility; the
// creator and the Society's moderators see everything). SysAdmin sees all,
// as the platform's takedown backstop.
export async function GET() {
  const session = await getSession();
  const userId = session?.sub ?? null;
  const isSysAdmin = !!session?.isSysAdmin;

  const { rows } = await pool.query(
    `SELECT s.id, s.stat_title, s.subject_area, s.customer_id, s.debate_visibility,
            s.vote_for, s.vote_against,
            c.name AS society_name,
            COUNT(DISTINCT ch.id)::int AS child_count,
            COUNT(DISTINCT ch.id) FILTER (WHERE ch.science_analysis_id IS NOT NULL)::int AS science_count,
            COUNT(DISTINCT cm.id)::int AS chat_count
     FROM   statements s
     LEFT   JOIN customers c      ON c.id = s.customer_id
     LEFT   JOIN statements ch    ON ch.resolution_id = s.id
     LEFT   JOIN comments cm      ON cm.statement_id = s.id
     WHERE  s.stat_type = 'resolution'
       AND  s.stat_status IN ('active', 'closed')
       AND  s.stat_hidden IS NOT TRUE
       AND  ($2::boolean IS TRUE OR ${listableResolutionSql('s', '$1::text')})
     GROUP  BY s.id, s.vote_for, s.vote_against, c.name
     ORDER  BY s.created_at DESC`,
    [userId, isSysAdmin]
  );

  return NextResponse.json(rows);
}

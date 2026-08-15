import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const { rows } = await pool.query(
    `SELECT s.id, s.stat_title, s.subject_area,
            s.vote_for, s.vote_against,
            COUNT(DISTINCT c.id)   AS chat_count,
            COUNT(DISTINCT ch.id)  AS statement_count,
            COUNT(DISTINCT ch.id) FILTER (WHERE ch.science_analysis_id IS NOT NULL) AS science_count,
            GREATEST(
              s.created_at,
              COALESCE(MAX(v.created_at), s.created_at),
              COALESCE(MAX(c.created_at), s.created_at)
            ) AS last_activity
     FROM statements s
     LEFT JOIN stat_votes v  ON v.statement_id = s.id
     LEFT JOIN comments   c  ON c.statement_id = s.id
     LEFT JOIN statements ch ON ch.resolution_id = s.id
     WHERE s.stat_type = 'resolution'
       AND s.retracted_at IS NULL
     GROUP BY s.id, s.stat_title, s.created_at, s.vote_for, s.vote_against
     ORDER BY last_activity DESC
     LIMIT 20`,
  );

  return NextResponse.json(rows);
}

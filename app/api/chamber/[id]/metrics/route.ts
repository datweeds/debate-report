import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();

  // Verify debate exists
  const { rows: [res] } = await pool.query(
    `SELECT id, forum_visibility FROM statements WHERE id = $1 AND stat_type = 'resolution'`,
    [id],
  );
  if (!res) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (res.forum_visibility !== 'public' && !session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const userId = session?.sub ?? null;

  // Single query: all statements with metrics, using recursive CTE for weight counts
  const { rows } = await pool.query(
    `WITH RECURSIVE
      -- All statements in this debate (resolution + children)
      all_stmts AS (
        SELECT id, stat_direction FROM statements
        WHERE resolution_id = $1 OR id = $1
      ),
      -- Ancestor→descendant pairs for weight computation
      desc_pairs(anc_id, desc_id) AS (
        SELECT id AS anc_id, id AS desc_id FROM all_stmts
        UNION ALL
        SELECT dp.anc_id, r.stat_id_supported_by AS desc_id
        FROM desc_pairs dp
        JOIN stat_relationships r ON r.stat_id_supported = dp.desc_id
        JOIN all_stmts a ON a.id = r.stat_id_supported_by
      ),
      -- Weight per statement (count of downstream statements by direction, excluding self)
      weights AS (
        SELECT
          dp.anc_id AS statement_id,
          COUNT(*) FILTER (WHERE a.stat_direction = 'for'     AND dp.desc_id != dp.anc_id) AS weight_for,
          COUNT(*) FILTER (WHERE a.stat_direction = 'against' AND dp.desc_id != dp.anc_id) AS weight_against
        FROM desc_pairs dp
        JOIN all_stmts a ON a.id = dp.desc_id
        GROUP BY dp.anc_id
      )
      SELECT
        s.id,
        s.stat_title,
        s.stat_type,
        s.stat_direction,
        s.updated_at,
        s.retracted_at,
        s.science_analysis_id IS NOT NULL AS has_analysis,
        s.vote_for     AS agree_count,
        s.vote_against AS disagree_count,
        s.vote_total_for,
        s.vote_total_against,
        COALESCE(w.weight_for,     0)::int AS weight_for,
        COALESCE(w.weight_against, 0)::int AS weight_against,
        -- User's vote (null if not logged in)
        (SELECT sv.vote FROM stat_votes sv
         WHERE sv.statement_id = s.id AND sv.created_by = $2
         LIMIT 1) AS user_vote,
        -- Chat message count (non-deleted, accepted)
        (SELECT COUNT(*) FROM comments c
         WHERE c.statement_id = s.id
           AND c.comment_status = 'accepted'
           AND NOT c.is_deleted) AS chat_count,
        -- Flag count
        (SELECT COUNT(*) FROM stat_flags sf WHERE sf.stat_id = s.id)::int AS flag_count
      FROM statements s
      LEFT JOIN weights w ON w.statement_id = s.id
      WHERE s.resolution_id = $1 OR s.id = $1
      ORDER BY s.created_at ASC`,
    [id, userId],
  );

  return NextResponse.json({ metrics: rows });
}

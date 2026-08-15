import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// GET — current user's vote + statement totals
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();

  const { rows: [stmt] } = await pool.query(
    `SELECT s.id, s.stat_direction, s.vote_for, s.vote_against,
            s.vote_total_for, s.vote_total_against
     FROM statements s WHERE s.id = $1`,
    [id],
  );
  if (!stmt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let userVote: 'agree' | 'disagree' | null = null;
  let userImpact: number | null = null;
  let userRationale: string | null = null;
  if (session?.sub) {
    const { rows: [v] } = await pool.query(
      'SELECT vote, vote_debate_impact, vote_rationale FROM stat_votes WHERE statement_id = $1 AND created_by = $2',
      [id, session.sub],
    );
    userVote      = (v?.vote as 'agree' | 'disagree') ?? null;
    userImpact    = v?.vote_debate_impact ?? null;
    userRationale = v?.vote_rationale ?? null;
  }

  return NextResponse.json({
    userVote, userImpact, userRationale,
    agreeCount:    stmt.vote_for    ?? 0,
    disagreeCount: stmt.vote_against ?? 0,
    totalFor:      stmt.vote_total_for    ?? 0,
    totalAgainst:  stmt.vote_total_against ?? 0,
  });
}

// POST — cast, change, or remove a vote
// Body: { vote: 'agree' | 'disagree' | null, impact?: number, rationale?: string }
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const vote: 'agree' | 'disagree' | null = body.vote ?? null;
  const impact: number | null = (body.impact != null && body.impact >= 1 && body.impact <= 10)
    ? Math.round(body.impact) : null;
  const rationale: string | null = body.rationale?.trim() || null;

  if (vote !== null && vote !== 'agree' && vote !== 'disagree') {
    return NextResponse.json({ error: 'Invalid vote value' }, { status: 400 });
  }

  const { rows: [stmt] } = await pool.query(
    'SELECT id FROM statements WHERE id = $1',
    [id],
  );
  if (!stmt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert or delete the vote
    if (vote === null) {
      await client.query(
        'DELETE FROM stat_votes WHERE statement_id = $1 AND created_by = $2',
        [id, session.sub],
      );
    } else {
      await client.query(
        `INSERT INTO stat_votes (statement_id, created_by, vote, vote_debate_impact, vote_rationale)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (statement_id, created_by) DO UPDATE
           SET vote = $3, vote_debate_impact = $4, vote_rationale = $5, updated_at = NOW()`,
        [id, session.sub, vote, impact, rationale],
      );
    }

    // Update per-statement counts
    await client.query(
      `UPDATE statements SET
        vote_for     = (SELECT COUNT(*) FROM stat_votes WHERE statement_id = $1 AND vote = 'agree'),
        vote_against = (SELECT COUNT(*) FROM stat_votes WHERE statement_id = $1 AND vote = 'disagree')
       WHERE id = $1`,
      [id],
    );

    // Update cumulative totals for all ancestor statements (including this one).
    // Ancestors = statements that this statement (directly/transitively) supports.
    // For each ancestor, totals = direction-adjusted sum of all its descendants' votes.
    await client.query(
      `WITH RECURSIVE
        ancestors(id) AS (
          SELECT $1::uuid
          UNION ALL
          SELECT r.stat_id_supported
          FROM stat_relationships r
          JOIN ancestors a ON r.stat_id_supported_by = a.id
        ),
        descendants(anc_id, desc_id) AS (
          SELECT id AS anc_id, id AS desc_id FROM ancestors
          UNION ALL
          SELECT d.anc_id, r.stat_id_supported_by
          FROM descendants d
          JOIN stat_relationships r ON r.stat_id_supported = d.desc_id
        ),
        totals AS (
          SELECT
            d.anc_id,
            COALESCE(SUM(CASE
              WHEN sv.vote = 'agree'    AND (s.stat_direction = 'for'     OR s.stat_direction IS NULL) THEN 1
              WHEN sv.vote = 'disagree' AND (s.stat_direction = 'against' OR s.stat_direction IS NULL) THEN 1
              ELSE 0 END), 0)::int AS total_for,
            COALESCE(SUM(CASE
              WHEN sv.vote = 'agree'    AND s.stat_direction = 'against'  THEN 1
              WHEN sv.vote = 'disagree' AND (s.stat_direction = 'for'     OR s.stat_direction IS NULL) THEN 1
              ELSE 0 END), 0)::int AS total_against
          FROM descendants d
          JOIN statements s ON s.id = d.desc_id
          LEFT JOIN stat_votes sv ON sv.statement_id = d.desc_id
          GROUP BY d.anc_id
        )
        UPDATE statements s SET
          vote_total_for     = t.total_for,
          vote_total_against = t.total_against
        FROM totals t
        WHERE s.id = t.anc_id`,
      [id],
    );

    await client.query('COMMIT');

    // Return updated counts for the voted statement
    const { rows: [updated] } = await client.query(
      'SELECT vote_for, vote_against, vote_total_for, vote_total_against FROM statements WHERE id = $1',
      [id],
    );

    return NextResponse.json({
      userVote:      vote,
      agreeCount:    updated.vote_for,
      disagreeCount: updated.vote_against,
      totalFor:      updated.vote_total_for,
      totalAgainst:  updated.vote_total_against,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Vote failed:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  } finally {
    client.release();
  }
}

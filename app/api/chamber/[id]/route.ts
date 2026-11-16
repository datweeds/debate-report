import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getDebateAccess } from '@/lib/debateAccess';
import { canSetDebateVisibility } from '@/lib/roles';
import { openDeep } from '@/lib/societyCrypto';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const { rows: resRows } = await pool.query(
    `SELECT s.id, s.stat_title, s.stat_description, s.subject_area,
            s.customer_id, s.debate_visibility, s.image_path, s.created_at, s.created_by,
            s.stat_status, s.resolution_decision, s.closing_statement,
            s.vote_total_for, s.vote_total_against,
            u.user_handle AS creator_handle,
            c.is_public AS society_is_public
     FROM   statements s
     LEFT   JOIN users u ON u.id = s.created_by
     LEFT   JOIN customers c ON c.id = s.customer_id
     WHERE  s.id = $1 AND s.stat_type = 'resolution'`,
    [id]
  );
  const resolution = resRows[0] ?? null;
  if (!resolution) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const session = await getSession();
  const access = await getDebateAccess(session, resolution);
  if (!access.viewable) {
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    return NextResponse.json({
      error: 'Access denied',
      debateVisibility: resolution.debate_visibility,
    }, { status: 403 });
  }

  resolution.can_set_visibility = !!session && resolution.customer_id != null
    && await canSetDebateVisibility(session, resolution.customer_id);

  const { rows: statements } = await pool.query(
    `SELECT s.id, s.stat_type, s.stat_title, s.stat_direction, s.stat_ref,
            s.stat_description, s.created_at, s.created_by,
            s.retracted_at,
            u.user_handle AS creator_handle,
            COALESCE(agg.agree_count,    0)::int AS agree_count,
            COALESCE(agg.disagree_count, 0)::int AS disagree_count
     FROM   statements s
     LEFT   JOIN users u ON u.id = s.created_by
     LEFT   JOIN (
       SELECT statement_id,
              COUNT(*) FILTER (WHERE vote = 'agree')    AS agree_count,
              COUNT(*) FILTER (WHERE vote = 'disagree') AS disagree_count
       FROM   stat_votes GROUP BY statement_id
     ) agg ON agg.statement_id = s.id
     WHERE  s.resolution_id = $1
     ORDER  BY s.created_at ASC`,
    [id]
  );

  const { rows: relationships } = await pool.query(
    `SELECT sr.stat_id_supported, sr.stat_id_supported_by
     FROM   stat_relationships sr
     WHERE  sr.stat_id_supported = $1
        OR  sr.stat_id_supported_by IN (SELECT id FROM statements WHERE resolution_id = $1)
        OR  sr.stat_id_supported    IN (SELECT id FROM statements WHERE resolution_id = $1)`,
    [id]
  );

  await openDeep([resolution, statements]);
  return NextResponse.json({ resolution, statements, relationships });
}
